/**
 * Strategy Agent —— 监控市场 + 自主决策(止盈止损)。
 *
 * agentic depth:agent 自己跑监控 loop,条件命中时自主决定"卖多少",
 * 但跑在 CAW 画死的边界里 —— 它决出的量若超 perTxCap,Executor 走 CAW 会被 policy 拦截(money shot)。
 * 不接真 LLM:决策是确定性规则(止盈止损阈值 + 卖出比例),可控、可复现。
 * 本类只**决策**,不执行;执行由 Executor(Stage 3)接 ActionDecision 走 CAW。
 */
import type { PriceFeed } from '../market/prices.js';
import type { ChainPilotEvent } from '../events.js';
import type { StopLossStrategy } from './parse.js';
import { evaluateTrigger, type TriggerSignal } from './triggers.js';

const AGENT_NAME = 'stop-loss-agent';

/** agent 自主决出的一笔操作(交给 Executor 走 CAW)。 */
export interface ActionDecision {
  agent: string;
  action: 'sell';
  trigger: TriggerSignal;
  amount: string; // 卖出量(token 计)= positionSize × sellFraction
  tokenId: string;
  chainId: string;
  destination: string;
}

export interface StrategyAgentDeps {
  feed: PriceFeed;
  strategy: StopLossStrategy;
  destination: string; // 卖出目的地(demo)
  onEvent: (e: ChainPilotEvent) => void;
}

export class StrategyAgent {
  private readonly deps: StrategyAgentDeps;

  constructor(deps: StrategyAgentDeps) {
    this.deps = deps;
  }

  /** 卖出量 = 持仓 × 卖出比例,定点 6 位避免浮点尾噪。 */
  private sellAmount(): string {
    const { positionSize, sellFraction } = this.deps.strategy;
    return (Number(positionSize) * sellFraction).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  }

  /**
   * 评估单个价格点:命中触发则发 trigger.fired + action.decided,返回决策;否则 null。
   */
  tick(marketPrice: number): ActionDecision | null {
    const { strategy, onEvent, destination } = this.deps;
    const signal = evaluateTrigger(strategy, marketPrice);
    if (!signal) return null;

    onEvent({
      type: 'trigger.fired',
      condition: signal.condition,
      marketValue: String(signal.marketPrice),
    });

    const amount = this.sellAmount();
    const decision: ActionDecision = {
      agent: AGENT_NAME,
      action: 'sell',
      trigger: signal,
      amount,
      tokenId: strategy.tokenId,
      chainId: strategy.chainId,
      destination,
    };

    onEvent({
      type: 'action.decided',
      agent: AGENT_NAME,
      action: `${signal.kind} → sell ${amount} ${strategy.tokenId}`,
      amount,
      token: strategy.tokenId,
      chain: strategy.chainId,
    });

    return decision;
  }

  /**
   * 监控 loop:每 intervalMs 拉一次价,首次触发即返回决策并停。
   * stop() 通过 shouldStop 注入(orchestrator 的一键冻结也走它)。
   */
  async monitor(opts: {
    intervalMs?: number;
    maxTicks?: number;
    shouldStop?: () => boolean;
  } = {}): Promise<ActionDecision | null> {
    const intervalMs = opts.intervalMs ?? 2000;
    const maxTicks = opts.maxTicks ?? 60;
    for (let i = 0; i < maxTicks; i++) {
      if (opts.shouldStop?.()) return null;
      const price = await this.deps.feed.getPrice(this.deps.strategy.tokenId);
      const decision = this.tick(price);
      if (decision) return decision;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return null;
  }
}
