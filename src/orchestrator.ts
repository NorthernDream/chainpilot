/**
 * Orchestrator —— 主 loop + 事件总线 + live market。
 * 策略设定 → Pact 编译 → live market 喂价 → Strategy Agent 自主决策 → Executor 执行 → 事件广播。
 *
 * live market:内置振荡 walk 反复穿越止盈线,让 agent 真实地周期性自主下单。
 * 边沿触发:仅在价格穿入触发区那一刻执行一次;busy 锁避免上一笔未完成时重入。
 */
import { ScriptedPriceFeed } from './market/prices.js';
import { ETH_REPLAY } from './market/eth-replay.js';
import { parseStrategy, type StopLossStrategy } from './strategy/parse.js';
import { evaluateTrigger } from './strategy/triggers.js';
import { StrategyAgent } from './strategy/agent.js';
import { Executor } from './executor.js';
import type { ChainPilotEvent } from './events.js';

export interface OrchestratorConfig {
  apiKey: string;
  apiUrl: string;
  walletId: string;
  destination: string;
}

/** 用户在 cockpit 设的只是「安全契约」—— entry/止盈位来自真实行情数据,不由用户填。 */
export interface DelegateInput {
  sellPerTx: string; // 每笔卖出量(token)
  perTxCap: string; // 单笔上限
  dailyCap: string; // 日累计上限
}

export class Orchestrator {
  private readonly cfg: OrchestratorConfig;
  private readonly feed = new ScriptedPriceFeed();
  private readonly listeners = new Set<(e: ChainPilotEvent) => void>();
  private readonly history: ChainPilotEvent[] = [];

  private strategy?: StopLossStrategy;
  private agent?: StrategyAgent;
  private executor?: Executor;
  private lastTriggered = false;
  private frozen = false;
  private busy = false;
  private marketTimer?: ReturnType<typeof setInterval>;
  private t = 0;

  constructor(cfg: OrchestratorConfig) {
    this.cfg = cfg;
  }

  onEvent(fn: (e: ChainPilotEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getHistory(): ChainPilotEvent[] {
    return [...this.history];
  }

  private emit(e: ChainPilotEvent): void {
    this.history.push(e);
    for (const fn of this.listeners) fn(e);
  }

  private tpLine(): number {
    return this.strategy ? this.strategy.entryPrice * (1 + this.strategy.takeProfitPct) : 0;
  }

  /** 授权:用户只给安全契约;entry/止盈位取自真实 ETH 行情数据。重新授权先静默撤旧 pact。 */
  async setStrategy(d: DelegateInput): Promise<void> {
    this.stopMarket();
    if (this.executor) await this.executor.revokeQuietly();
    this.frozen = false;
    this.lastTriggered = false;
    this.t = 0;
    this.strategy = parseStrategy({
      chainId: 'SETH',
      tokenId: 'SETH',
      entryPrice: ETH_REPLAY.entry, // 真实行情起点
      takeProfitPct: ETH_REPLAY.tpPct, // 真实数据反复穿越的止盈位
      stopLossPct: 0.03,
      positionSize: d.sellPerTx, // sellFraction=1 → 每次卖 sellPerTx
      sellFraction: 1,
      perTxCap: d.perTxCap,
      dailyCap: d.dailyCap,
    });
    this.emit({
      type: 'strategy.set',
      text: `ETH≥${ETH_REPLAY.tpLine} 止盈卖 ${d.sellPerTx} · 单笔≤${d.perTxCap} · 日累计≤${d.dailyCap}`,
      rules: { sellPerTx: d.sellPerTx },
      bounds: { ...this.strategy.bounds },
    });

    this.executor = new Executor({
      apiKey: this.cfg.apiKey,
      apiUrl: this.cfg.apiUrl,
      walletId: this.cfg.walletId,
      bounds: this.strategy.bounds,
      onEvent: (e) => this.emit(e),
    });
    this.agent = new StrategyAgent({
      feed: this.feed,
      strategy: this.strategy,
      destination: this.cfg.destination,
      onEvent: (e) => this.emit(e),
    });

    await this.executor.ensurePact();
  }

  /** 单点注入价格(手动/精确控制)。 */
  async injectPrice(price: number): Promise<void> {
    if (!this.strategy) throw new Error('先 setStrategy');
    await this.onTick(price);
  }

  /** live market:振荡 walk 反复穿越止盈线,agent 周期性自主下单。 */
  startMarket(intervalMs = 800): void {
    if (this.marketTimer || !this.strategy) return;
    this.t = 0;
    // 回放真实 ETH/USD 行情(非合成):逐点喂价,跑完循环
    const closes = ETH_REPLAY.closes;
    this.marketTimer = setInterval(() => {
      const price = closes[this.t % closes.length];
      this.t += 1;
      void this.onTick(price);
    }, intervalMs);
  }

  stopMarket(): void {
    if (this.marketTimer) clearInterval(this.marketTimer);
    this.marketTimer = undefined;
  }

  /** 每个价格点:推 market.tick + 边沿触发执行(busy 锁防重入)。 */
  private async onTick(price: number): Promise<void> {
    this.feed.setPrice(this.strategy!.tokenId, price);
    this.emit({ type: 'market.tick', price, tpLine: this.tpLine() });

    if (this.frozen || !this.agent || !this.executor) return;
    const triggered = evaluateTrigger(this.strategy!, price) != null;

    if (triggered && !this.lastTriggered && !this.busy) {
      this.busy = true;
      this.lastTriggered = true;
      try {
        const decision = this.agent.tick(price);
        if (decision) {
          const result = await this.executor.execute(decision);
          // 当日预算被摁停 → agent 退场,停 market(否则每次穿越都触发无限 DENIED)
          if (result.outcome === 'denied') this.stopMarket();
        }
      } finally {
        this.busy = false;
      }
    } else if (!this.busy) {
      this.lastTriggered = triggered;
    }
  }

  /** 一键冻结:停 market + revokePact。 */
  async freeze(): Promise<void> {
    this.frozen = true;
    this.stopMarket();
    if (this.executor) await this.executor.freeze();
  }
}
