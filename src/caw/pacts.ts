/**
 * 策略边界 → CAW pact policy 编译。
 * 这是 ChainPilot 的核心:把"亏不超过 X / 日累计 ≤ Y / 只在某链某币 / 超界停"
 * 翻译成 CAW 服务端强制的 policy。字段严格对齐 docs/caw-reference/pact-policies.md。
 *
 * 真实类型(@cobo/agentic-wallet):
 *   PactSubmitRequest { wallet_id, intent, spec: PactSpecInput }
 *   PactSpecInput { policies?: InlinePolicyCreate[], completion_conditions?, execution_plan? }
 *   InlinePolicyCreate { name, type: PolicyType, rules?: {[k]:any} }
 *   PolicyType ∈ transfer | contract_call | payment | recipe | rate_limit | fallback | default
 */
import type { PactSubmitRequest, PactSpecInput } from '@cobo/agentic-wallet';
import type { SafetyBounds, PactCompletion } from './types.js';

const DEFAULT_COMPLETION: PactCompletion = { type: 'time_elapsed', threshold: '86400' };

/** rolling_24h 限额块,仅在设了日累计 / 日笔数时生成。 */
function buildRolling24h(bounds: SafetyBounds): Record<string, unknown> | undefined {
  const rolling: Record<string, unknown> = {};
  if (bounds.dailyCap) rolling.amount_gt = bounds.dailyCap;
  if (bounds.dailyTxCountCap !== undefined) rolling.tx_count_gt = bounds.dailyTxCountCap;
  return Object.keys(rolling).length ? rolling : undefined;
}

/**
 * 构造一个 transfer pact:允许在 chain/token(/目的地)内转账,
 * 单笔 > perTxCap 或 滚动 24h 累计 > dailyCap 即被拒;超 reviewOver 触发 MPC 审批。
 * rules 是 freeform object(OpenAPI 定义为 {[k]:any}),结构见 pact-policies.md。
 */
export function buildTransferPact(
  walletId: string,
  bounds: SafetyBounds,
  opts: { intent?: string; completion?: PactCompletion } = {},
): PactSubmitRequest {
  const intent =
    opts.intent ?? 'ChainPilot 安全执行:转账保持在策略边界内(单笔/日累计/链币白名单)';

  // when —— 白名单(fail-closed:不匹配即默认拒)
  const when: Record<string, unknown> = {
    chain_in: [bounds.chainId],
    token_in: [{ chain_id: bounds.chainId, token_id: bounds.tokenId }],
  };
  if (bounds.destinations?.length) {
    when.destination_address_in = bounds.destinations.map((address) => ({
      chain_id: bounds.chainId,
      address,
    }));
  }

  // deny_if —— 硬拦截(单笔上限 + 滚动 24h 累计)
  const denyIf: Record<string, unknown> = { amount_gt: bounds.perTxCap };
  const rolling24h = buildRolling24h(bounds);
  if (rolling24h) denyIf.usage_limits = { rolling_24h: rolling24h };

  const rules: Record<string, unknown> = { effect: 'allow', when, deny_if: denyIf };

  // review_if —— 软拦截(超阈值转 MPC 审批,需钱包已 pair)
  if (bounds.reviewOver) {
    rules.review_if = { amount_gt: bounds.reviewOver };
  }

  const spec: PactSpecInput = {
    policies: [{ name: 'chainpilot-transfer-bounds', type: 'transfer', rules }],
    completion_conditions: [opts.completion ?? DEFAULT_COMPLETION],
  };

  return { wallet_id: walletId, intent, spec };
}
