/**
 * 共享类型 + 环境加载。
 * 所有 CAW 字段名对齐 @cobo/agentic-wallet v0.1.x 真实导出(OpenAPI 1.3.0)。
 */
import 'dotenv/config';

export interface CawEnv {
  apiUrl: string;
  apiKey: string;
  walletId: string;
  destination: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`缺少环境变量 ${name} —— 见 docs/01-caw-onboarding.md`);
  return v;
}

export function loadCawEnv(): CawEnv {
  return {
    apiUrl: process.env.AGENT_WALLET_API_URL ?? 'https://api.agenticwallet.cobo.com',
    apiKey: requireEnv('AGENT_WALLET_API_KEY'),
    walletId: requireEnv('AGENT_WALLET_WALLET_ID'),
    destination:
      process.env.CAW_DESTINATION ?? '0x1111111111111111111111111111111111111111',
  };
}

/**
 * 安全边界 —— ChainPilot 的产品核心:用户设的策略边界,编译进 CAW pact policy。
 * 字段对应 docs/caw-reference/pact-policies.md 的 transfer policy 真实 schema。
 */
export interface SafetyBounds {
  chainId: string; // when.chain_in,e.g. 'SETH' (Sepolia)
  tokenId: string; // when.token_in,e.g. 'SETH'
  perTxCap: string; // deny_if.amount_gt —— 单笔上限,超过即 deny
  dailyCap?: string; // deny_if.usage_limits.rolling_24h.amount_gt —— 滚动 24h 累计上限
  dailyTxCountCap?: number; // rolling_24h.tx_count_gt —— 滚动 24h 笔数上限
  reviewOver?: string; // review_if.amount_gt —— 超过即 MPC 审批(需 pair,默认不设)
  destinations?: string[]; // when.destination_address_in —— 目的地白名单(默认不限)
}

/**
 * pact 自动终止条件(满足任一即 revoke)。见 pact-policies.md completion conditions。
 */
export interface PactCompletion {
  type: 'time_elapsed' | 'tx_count' | 'amount_spent' | 'amount_spent_usd';
  threshold: string; // time_elapsed=秒,tx_count=整数,amount_spent=代币数量
}
