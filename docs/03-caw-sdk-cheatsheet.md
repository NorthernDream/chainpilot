# CAW TypeScript SDK 速查(真实 API)

> 全部来自官方 quickstart 存档 `docs/caw-reference/ts-sdk.md`。**别凭印象编 API**,以此为准。
> 包:`@cobo/agentic-wallet`(Node.js 18+)。policy schema 详见 `docs/caw-reference/pact-policies.md`。

## 安装 + 环境

```bash
npm install @cobo/agentic-wallet
```
```bash
export AGENT_WALLET_API_URL=https://api.agenticwallet.cobo.com
export AGENT_WALLET_API_KEY=<owner-api-key>
export AGENT_WALLET_WALLET_ID=<wallet-uuid>
```

## 核心对象

```typescript
import {
  AuditApi, Configuration, type PactSpecInput,
  PactsApi, TransactionsApi,
} from '@cobo/agentic-wallet';

const config = new Configuration({ apiKey, basePath });  // basePath = API_URL
const pactsApi = new PactsApi(config);
const txApi    = new TransactionsApi(config);
const auditApi = new AuditApi(config);
```

## Pact 生命周期

```typescript
// 提交 pact(owner key)
const pactResp = await pactsApi.submitPact({
  wallet_id, intent: '...', spec: PACT_SPEC,
});
const pactId = pactResp.data.result.pact_id;

// 轮询直到 active,拿 pact-scoped key
const pact = (await pactsApi.getPact(pactId)).data.result;
// pact.status ∈ active | rejected | expired | revoked | completed
// active 时 pact.api_key 就是该 pact 的 scoped key

// 之后所有链上操作用 pact-scoped key 新建 TransactionsApi
const txApi = new TransactionsApi(new Configuration({ apiKey: pact.api_key, basePath }));
```

## Pact spec(风控核心就在这)

```typescript
const PACT_SPEC: PactSpecInput = {
  policies: [{
    name: 'max-tx-limit',
    type: 'transfer',
    rules: {
      effect: 'allow',
      when: {
        chain_in: ['SETH'],
        token_in: [{ chain_id: 'SETH', token_id: 'SETH' }],
      },
      deny_if: { amount_gt: '0.002' },   // ← Risk agent 的拦截阈值就是这个
    },
  }],
  completion_conditions: [{ type: 'time_elapsed', threshold: '86400' }],
  // 也支持 { type: 'tx_count', threshold: '1' }
};
```

## 转账 + 拦截(money shot 的核心交互)

> ⚠️ 实测:这个 API 版本(OpenAPI 1.3.0)的 transfer **必须显式传 `src_addr`**。
> model 里 `src_addr` 标为 optional(声称缺省时服务端自动选有余额的地址),但 agent-owned
> 钱包实际会返回 422 `src_addr Field required`。源地址用 `resolveSourceAddr`(`src/caw/client.ts`)
> 从 `listBalances` 里挑该链该币有余额的地址。

```typescript
// allowed(src_addr 必填)
const allowed = (await txApi.transferTokens(walletId, {
  chain_id: 'SETH', src_addr, dst_addr, token_id: 'SETH', amount: '0.001',
})).data.result;

// 超限 → 抛错,在 catch 里读结构化 denial
try {
  await txApi.transferTokens(walletId, {
    chain_id: 'SETH', src_addr, dst_addr, token_id: 'SETH', amount: '0.005',
  });
} catch (error) {
  const resp = (error as any)?.response;
  const e = resp?.data?.error;
  // e.code     = 'TRANSFER_LIMIT_EXCEEDED'
  // e.reason   = 'matched_pact_transfer_deny_if'
  // e.details  = { chain_id, token_id, dst_addr, tier:'pact', policy_type, policy_id }
  // resp.data.suggestion = 人类可读建议
}
```

## 合约调用(接 DeFi recipe:Hyperliquid/Aave/Uniswap)

```typescript
const fee = await txApi.estimateContractCallFee(walletId, {
  chain_id: 'BASE_ETH', contract_addr, calldata, value: '0',
});
const call = (await txApi.contractCall(walletId, {
  chain_id: 'BASE_ETH', contract_addr, calldata, value: '0',
  request_id: 'swap-2026-001',   // 幂等追踪
})).data.result;
```

## 审计日志(Observer agent + 仪表盘数据源)

```typescript
const logs = await auditApi.listAuditLogs(
  walletId,
  undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, 20,  // 最后一个位置参数 = limit
);
const items = (logs.data.result as any)?.items ?? [];
// 每条含 { action, result: 'allowed'|'denied', ... }
```

## tx status 注意

quickstart 实测输出里 allowed transfer 的 `status=400 (Processing)` 是**正常**的(链上 pending),不是 HTTP 400。HTTP 403 才是 policy denied。

## 三 role → 工具映射(架构落地)

| role | 用到的 API | 对应 agent |
|---|---|---|
| Pact Drafting | `submitPact` / `getPact` / `listPacts` | 每个 agent 起草自己的授权 |
| Execution | `transferTokens` / `contractCall` / `estimate*Fee` | Trading / Treasury |
| Observer | `listWallets` / `getBalance` / `listAuditLogs` | Research / Risk / 仪表盘 |

> per-agent 收窄:env `AGENT_WALLET_INCLUDE_TOOLS` 或 SDK include/exclude tools。
