/**
 * CAW API 客户端工厂 + 常用 helper。
 * 直接用 @cobo/agentic-wallet 的 OpenAPI 客户端(无高层 SDK wrapper)。
 */
import axios, { type AxiosInstance } from 'axios';
import {
  Configuration,
  PactsApi,
  TransactionsApi,
  TransactionRecordsApi,
  AuditApi,
  FaucetApi,
  BalanceApi,
  PactStatus,
} from '@cobo/agentic-wallet';

/** CAW API 偶发 TLS ECONNRESET/超时,这类网络错(无 HTTP response)重试 3 次,退避 0.5/1/1.5s。
 *  403 denial 有 response、不属网络错,绝不会被重试。 */
const RETRIABLE = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'ERR_NETWORK']);
const MAX_RETRY = 3;

const IDEMPOTENT = new Set(['get', 'head']);

function createHttp(): AxiosInstance {
  const http = axios.create();
  http.interceptors.response.use(undefined, async (error) => {
    const cfg = error?.config as (typeof error.config & { __retry?: number }) | undefined;
    if (!cfg || (cfg.__retry ?? 0) >= MAX_RETRY) return Promise.reject(error);
    const method = (cfg.method ?? 'get').toLowerCase();
    const networkErr = !error.response && RETRIABLE.has(error.code);
    // 5xx 仅重试幂等 GET/HEAD —— POST(submitPact/transfer)不重试,避免重复 pact/双花
    const server5xx = error.response?.status >= 500 && IDEMPOTENT.has(method);
    if (networkErr || server5xx) {
      cfg.__retry = (cfg.__retry ?? 0) + 1;
      await new Promise((r) => setTimeout(r, 500 * cfg.__retry!));
      return http(cfg);
    }
    return Promise.reject(error);
  });
  return http;
}

export interface CawApis {
  config: Configuration;
  pacts: PactsApi;
  tx: TransactionsApi;
  records: TransactionRecordsApi;
  audit: AuditApi;
  faucet: FaucetApi;
  balance: BalanceApi;
}

export function makeApis(apiKey: string, basePath: string): CawApis {
  const config = new Configuration({ apiKey, basePath });
  const http = createHttp();
  return {
    config,
    pacts: new PactsApi(config, undefined, http),
    tx: new TransactionsApi(config, undefined, http),
    records: new TransactionRecordsApi(config, undefined, http),
    audit: new AuditApi(config, undefined, http),
    faucet: new FaucetApi(config, undefined, http),
    balance: new BalanceApi(config, undefined, http),
  };
}

/**
 * 解析出"该链该币有余额"的源地址。
 * 这个 CAW API 版本的 transfer 必须显式传 src_addr(不会自动选),
 * Executor 执行真实 tx 时也走这里。挑 amount > 0 的第一个匹配地址。
 */
export async function resolveSourceAddr(
  balance: BalanceApi,
  walletId: string,
  chainId: string,
  tokenId: string,
): Promise<string> {
  const rows = ((await balance.listBalances(walletId)).data.result ?? []) as Array<{
    address?: string;
    chain_id?: string;
    token_id?: string;
    amount?: string;
  }>;
  const hit = rows.find(
    (r) =>
      r.chain_id === chainId &&
      r.token_id === tokenId &&
      r.address &&
      Number(r.amount ?? '0') > 0,
  );
  if (!hit?.address) {
    throw new Error(
      `钱包 ${walletId} 在 ${chainId}/${tokenId} 无有余额的地址 —— 先 faucet 充值`,
    );
  }
  return hit.address;
}

const TERMINAL: ReadonlySet<string> = new Set([
  PactStatus.rejected,
  PactStatus.completed,
  PactStatus.expired,
  PactStatus.revoked,
  PactStatus.withdrawn,
]);

/**
 * 轮询 pact 直到 active,返回 pact-scoped api_key。
 * 未配对的钱包通常立即 active;已配对的需 owner 在 App 审批。
 */
export async function waitForPactActive(
  pacts: PactsApi,
  pactId: string,
  opts: { intervalMs?: number; onStatus?: (s: string) => void } = {},
): Promise<string> {
  const intervalMs = opts.intervalMs ?? 5_000;
  let last = '';
  for (;;) {
    const pact = (await pacts.getPact(pactId)).data.result;
    const status = pact.status ?? '';
    if (status !== last) {
      opts.onStatus?.(status);
      last = status;
    }
    if (status === PactStatus.active) {
      if (!pact.api_key) throw new Error(`pact ${pactId} active 但无 api_key`);
      return pact.api_key;
    }
    if (TERMINAL.has(status)) {
      throw new Error(`pact ${pactId} 进入终态 ${status},无法使用`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * 轮询 tx record 直到拿到真实链上 hash(allowed 转账初始 status=Processing、hash 为空)。
 * 拿到 hash 是 money shot 的"合规操作真实链上证据"。超时返回 null,不抛错。
 */
export async function waitForTxHash(
  records: TransactionRecordsApi,
  walletId: string,
  txId: string,
  opts: { intervalMs?: number; maxTries?: number } = {},
): Promise<string | null> {
  const intervalMs = opts.intervalMs ?? 4_000;
  const maxTries = opts.maxTries ?? 15;
  for (let i = 0; i < maxTries; i++) {
    try {
      const rec = (await records.getUserTransaction(walletId, txId)).data.result as {
        transaction_hash?: string;
      };
      if (rec?.transaction_hash) return rec.transaction_hash;
    } catch {
      // 抖动/尚未可查,继续
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/**
 * 从 axios error 里抽出 CAW 的结构化 denial。policy 拦截时 HTTP 403。
 */
export interface CawDenial {
  httpStatus?: number;
  code?: string;
  reason?: string;
  details?: unknown;
  suggestion?: string;
}

export function parseDenial(error: unknown): CawDenial | null {
  const resp = (error as { response?: { status?: number; data?: any } })?.response;
  if (!resp) return null;
  const data = resp.data ?? {};
  const err = data.error ?? data;
  return {
    httpStatus: resp.status,
    code: err?.code,
    reason: err?.reason,
    details: err?.details,
    suggestion: data?.suggestion ?? err?.suggestion,
  };
}
