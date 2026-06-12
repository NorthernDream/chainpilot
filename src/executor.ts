/**
 * Executor —— ChainPilot 的执行层,把 agent 的决策走 CAW。
 *
 * 这是 money shot 的后端核心:
 *   · 合规(≤ 边界)→ CAW 链上执行,真实 tx hash
 *   · 超界(> perTxCap / 日累计)→ CAW policy deny_if 拦截,HTTP 403 结构化 denial
 * 私钥永远在 CAW MPC 里,Executor 只持 pact-scoped key,且 key 的权限被 pact policy 锁死。
 * 一键冻结 = revokePact(owner key),撤销 pact + 失效 scoped key。
 */
import {
  makeApis,
  waitForPactActive,
  waitForTxHash,
  resolveSourceAddr,
  parseDenial,
  type CawApis,
} from './caw/client.js';
import { buildTransferPact } from './caw/pacts.js';
import type { SafetyBounds, PactCompletion } from './caw/types.js';
import type { ChainPilotEvent } from './events.js';
import type { ActionDecision } from './strategy/agent.js';

export interface ExecutorDeps {
  apiKey: string; // owner key
  apiUrl: string;
  walletId: string;
  bounds: SafetyBounds;
  onEvent: (e: ChainPilotEvent) => void;
  completion?: PactCompletion;
}

export type ExecResult =
  | { outcome: 'allowed'; txId: string; hash: string | null; amount: string }
  | { outcome: 'denied'; code: string; reason: string; attempted: string };

export class Executor {
  private readonly owner: CawApis;
  private readonly deps: ExecutorDeps;
  private pactId?: string;
  private scoped?: CawApis;
  private dailyUsed = 0;
  private totalUsed = 0;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
    this.owner = makeApis(deps.apiKey, deps.apiUrl);
  }

  /** 编译并激活 pact,拿 pact-scoped key。发 pact.compiled + pact.activated。 */
  async ensurePact(): Promise<string> {
    if (this.pactId && this.scoped) return this.pactId;
    const { walletId, bounds, apiUrl, onEvent, completion } = this.deps;
    const req = buildTransferPact(walletId, bounds, completion ? { completion } : {});
    // CAW 偶发 5xx;submitPact 5xx 几乎必然建 pact 前失败,重试 2 次安全
    let submitted;
    for (let attempt = 0; ; attempt++) {
      try {
        submitted = (await this.owner.pacts.submitPact(req)).data.result;
        break;
      } catch (e) {
        const status = (e as { response?: { status?: number } })?.response?.status ?? 0;
        if (status >= 500 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    this.pactId = submitted.pact_id;
    onEvent({ type: 'pact.compiled', pactId: submitted.pact_id, policies: req.spec.policies ?? [] });

    const key = await waitForPactActive(this.owner.pacts, submitted.pact_id);
    this.scoped = makeApis(key, apiUrl);
    onEvent({ type: 'pact.activated', pactId: submitted.pact_id });
    return submitted.pact_id;
  }

  /**
   * 执行 agent 决策:合规 → 真实 tx + tx.allowed;超界 → CAW 403 + tx.denied(红框)。
   */
  async execute(decision: ActionDecision): Promise<ExecResult> {
    if (!this.scoped) await this.ensurePact();
    const scoped = this.scoped!;
    const { walletId, bounds, onEvent } = this.deps;

    const srcAddr = await resolveSourceAddr(
      this.owner.balance,
      walletId,
      decision.chainId,
      decision.tokenId,
    );
    // demo 可持续:占位目的地时改自转,合规交易只耗 gas 不丢本金(仍计入日累计)
    const PLACEHOLDER = '0x1111111111111111111111111111111111111111';
    const dstAddr = decision.destination === PLACEHOLDER ? srcAddr : decision.destination;

    try {
      const tx = (
        await scoped.tx.transferTokens(walletId, {
          chain_id: decision.chainId,
          token_id: decision.tokenId,
          src_addr: srcAddr,
          dst_addr: dstAddr,
          amount: decision.amount,
        })
      ).data.result;

      const txId = tx.id;
      if (!txId) throw new Error('transferTokens 返回无 tx id');

      // 立即放行(不阻塞 market loop);真实 hash 后台异步补发 tx.hash
      onEvent({ type: 'tx.allowed', txId, hash: null, amount: decision.amount });
      void waitForTxHash(this.owner.records, walletId, txId).then((hash) => {
        if (hash) onEvent({ type: 'tx.hash', txId, hash });
      });

      this.dailyUsed += Number(decision.amount);
      this.totalUsed += Number(decision.amount);
      onEvent({
        type: 'budget.updated',
        dailyUsed: String(this.dailyUsed),
        dailyCap: bounds.dailyCap ?? '',
        totalUsed: String(this.totalUsed),
      });

      return { outcome: 'allowed', txId, hash: null, amount: decision.amount };
    } catch (error) {
      const d = parseDenial(error);
      if (d?.httpStatus === 403) {
        const code = d.code ?? 'DENIED';
        const reason = d.reason ?? 'matched_pact_transfer_deny_if';
        // 日累计拦截报日累计上限,单笔拦截报单笔上限
        const threshold = code.includes('DAILY') ? bounds.dailyCap ?? '' : bounds.perTxCap;
        onEvent({ type: 'tx.denied', code, reason, threshold, attempted: decision.amount });
        return { outcome: 'denied', code, reason, attempted: decision.amount };
      }
      throw error;
    }
  }

  /** 一键冻结:撤销 pact(owner key),失效 scoped key,agent 再也发不出 tx。 */
  async freeze(): Promise<void> {
    if (!this.pactId) return;
    await this.owner.pacts.revokePact(this.pactId);
    this.scoped = undefined;
    this.deps.onEvent({ type: 'freeze.triggered', by: 'user' });
  }

  /** 静默撤销 pact(re-delegate 时清理旧 pact,不发 freeze 事件,失败忽略)。 */
  async revokeQuietly(): Promise<void> {
    if (!this.pactId) return;
    try {
      await this.owner.pacts.revokePact(this.pactId);
    } catch {
      /* 旧 pact 撤销失败不阻塞新授权 */
    }
    this.scoped = undefined;
  }
}
