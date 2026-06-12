> ## Documentation Index
> Fetch the complete documentation index at: https://cobo.com/products/agentic-wallet/manual/llms.txt
> Use this file to discover all available pages before exploring further.

# TypeScript SDK

> Canonical 5-minute TypeScript SDK quickstart: submit a pact, execute an onchain action, handle policy denial, and verify in audit logs.

This is the canonical TypeScript path for Cobo Agentic Wallet.

## 5-minute outcome

In one run, you will:

1. Submit a pact requesting scoped onchain permissions
2. Wait for owner approval
3. Execute one allowed onchain action using the pact-scoped API key
4. Trigger one policy denial and inspect the structured error
5. Verify the result in audit logs

## Prerequisites

* Node.js 18+
* A wallet already onboarded and paired via `caw onboard` (see [CLI quickstart](/products/agentic-wallet/manual/developer/cli))
* Testnet tokens on your wallet address (use `caw faucet deposit` to request Sepolia ETH)
* Your runtime API key and wallet UUID set as environment variables

## Step 1: Install SDK

```bash theme={null}
npm install @cobo/agentic-wallet
```

## Step 2: Set environment variables

Set `AGENT_WALLET_API_URL` to your CAW API endpoint.

```bash theme={null}
export AGENT_WALLET_API_URL=https://api.agenticwallet.cobo.com
export AGENT_WALLET_API_KEY=your-agent-api-key
export AGENT_WALLET_WALLET_ID=your-wallet-uuid
```

## Step 3: Run the end-to-end script

```typescript title="quickstart.ts" theme={null}
import {
  AuditApi,
  Configuration,
  type PactSpecInput,
  PactsApi,
  TransactionsApi,
} from '@cobo/agentic-wallet';

// ─── Env ─────────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const env = {
  basePath: requireEnv('AGENT_WALLET_API_URL'),
  ownerKey: requireEnv('AGENT_WALLET_API_KEY'),
  walletId: requireEnv('AGENT_WALLET_WALLET_ID'),
  destination: process.env.CAW_DESTINATION ?? '0x1111111111111111111111111111111111111111',
};

// ─── Demo constants ──────────────────────────────────────────────────────────

const CHAIN_ID = 'SETH';
const TOKEN_ID = 'SETH';
const ALLOWED_AMOUNT = '0.001';
const DENIED_AMOUNT = '0.005';
const DENY_THRESHOLD = '0.002';

const PACT_SPEC: PactSpecInput = {
  policies: [
    {
      name: 'max-tx-limit',
      type: 'transfer',
      rules: {
        effect: 'allow',
        when: {
          chain_in: [CHAIN_ID],
          token_in: [{ chain_id: CHAIN_ID, token_id: TOKEN_ID }],
        },
        deny_if: { amount_gt: DENY_THRESHOLD },
      },
    },
  ],
  completion_conditions: [{ type: 'time_elapsed', threshold: '86400' }],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

interface TransferResult {
  id?: string;
  status?: unknown;
  status_display?: string | null;
  request_id?: string;
  transaction_hash?: string | null;
}

function printTx(tag: string, tx: TransferResult): void {
  console.log(
    `      ${tag}: tx_id=${tx.id} status=${tx.status} (${tx.status_display ?? '-'}) ` +
      `request_id=${tx.request_id} hash=${tx.transaction_hash ?? '-'}`,
  );
}

async function waitForPactActivation(pactsApi: PactsApi, pactId: string): Promise<string> {
  const terminal = new Set(['rejected', 'expired', 'revoked', 'completed']);
  const started = Date.now();
  let lastStatus: string | undefined;
  for (;;) {
    const pact = (await pactsApi.getPact(pactId)).data.result;
    const status = pact.status ?? '';
    if (status !== lastStatus) {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      console.log(`      pact status -> ${status} (elapsed ${elapsed}s)`);
      lastStatus = status;
    }
    if (status === 'active' && pact.api_key) return pact.api_key;
    if (terminal.has(status)) throw new Error(`Pact reached terminal status before use: ${status}`);
    await sleep(5_000);
  }
}

// ─── Main flow ───────────────────────────────────────────────────────────────

const ownerConfig = new Configuration({ apiKey: env.ownerKey, basePath: env.basePath });
const pactsApi = new PactsApi(ownerConfig);
const auditApi = new AuditApi(ownerConfig);

// Step 1: submit the pact.
console.log(
  `[1/6] Submitting pact (allow ${CHAIN_ID}/${TOKEN_ID} transfers, ` +
    `deny if amount > ${DENY_THRESHOLD})...`,
);
const pactResp = await pactsApi.submitPact({
  wallet_id: env.walletId,
  intent: 'Transfer tokens for integration testing',
  spec: PACT_SPEC,
});
const pactId = pactResp.data.result.pact_id;
console.log(`      pact submitted: id=${pactId}`);

// Step 2: poll until active.
console.log('[2/6] Waiting for owner approval in the Cobo Agentic Wallet app...');
const pactApiKey = await waitForPactActivation(pactsApi, pactId);

// Step 3: use the pact-scoped key.
console.log('[3/6] Pact is active; switching to pact-scoped API key.');
const txApi = new TransactionsApi(new Configuration({ apiKey: pactApiKey, basePath: env.basePath }));

// Step 4: compliant transfer.
console.log(`[4/6] Submitting allowed transfer: ${ALLOWED_AMOUNT} ${TOKEN_ID} -> ${env.destination}`);
const allowed = (
  await txApi.transferTokens(env.walletId, {
    chain_id: CHAIN_ID,
    dst_addr: env.destination,
    token_id: TOKEN_ID,
    amount: ALLOWED_AMOUNT,
  })
).data.result;
printTx('ALLOWED', allowed);

// Step 5: trigger a denial, then retry inside the policy cap.
console.log(
  `[5/6] Submitting transfer that should be blocked: ` +
    `${DENIED_AMOUNT} ${TOKEN_ID} -> ${env.destination}`,
);
try {
  await txApi.transferTokens(env.walletId, {
    chain_id: CHAIN_ID,
    dst_addr: env.destination,
    token_id: TOKEN_ID,
    amount: DENIED_AMOUNT,
  });
} catch (error) {
  const resp = (error as {
    response?: {
      status?: number;
      data?: { error?: { code?: string; reason?: string; details?: unknown }; suggestion?: string };
    };
  })?.response;
  const errBody = resp?.data?.error;
  console.log(
    `      DENIED as expected: http=${resp?.status ?? '-'} ` +
      `code=${errBody?.code ?? '-'} reason=${errBody?.reason ?? '-'}`,
  );
  if (errBody?.details) console.log(`      details: ${JSON.stringify(errBody.details)}`);
  if (resp?.data?.suggestion) console.log(`      suggestion: ${resp.data.suggestion}`);

  console.log(`      retrying with compliant amount ${ALLOWED_AMOUNT} ${TOKEN_ID}...`);
  const retry = (
    await txApi.transferTokens(env.walletId, {
      chain_id: CHAIN_ID,
      dst_addr: env.destination,
      token_id: TOKEN_ID,
      amount: ALLOWED_AMOUNT,
    })
  ).data.result;
  printTx('RETRY ALLOWED', retry);
}

// Step 6: audit-log summary.
console.log('[6/6] Fetching recent audit entries for this wallet...');
const logs = await auditApi.listAuditLogs(
  env.walletId,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  20,
);
const items = (logs.data.result as { items?: Array<{ result?: string }> })?.items ?? [];
console.log(
  `      audit (last ${items.length} entries): ` +
    `allowed=${items.filter(it => it.result === 'allowed').length}, ` +
    `denied=${items.filter(it => it.result === 'denied').length}`,
);
```

## Step 4: Validate output

You should see:

```text theme={null}
[1/6] Submitting pact (allow SETH/SETH transfers, deny if amount > 0.002)...
(Use `node --trace-warnings ...` to show where the warning was created)
      pact submitted: id=<pact-id>
[2/6] Waiting for owner approval in the Cobo Agentic Wallet app...
      pact status -> active (elapsed 0s)
[3/6] Pact is active; switching to pact-scoped API key.
[4/6] Submitting allowed transfer: 0.001 SETH -> 0x1111111111111111111111111111111111111111
      ALLOWED: tx_id=<tx-id> status=400 (Processing) request_id=<request-id> hash=-
[5/6] Submitting transfer that should be blocked: 0.005 SETH -> 0x1111111111111111111111111111111111111111
      DENIED as expected: http=403 code=TRANSFER_LIMIT_EXCEEDED reason=matched_pact_transfer_deny_if
      details: {"reason":"matched_pact_transfer_deny_if","chain_id":"SETH","token_id":"SETH","dst_addr":"0x1111111111111111111111111111111111111111","tier":"pact","policy_type":"transfer","policy_id":"<policy-id>"}
      suggestion: Operation denied by active transfer policy. Adjust parameters or request owner policy updates.
      retrying with compliant amount 0.001 SETH...
      RETRY ALLOWED: tx_id=<tx-id> status=400 (Processing) request_id=<request-id> hash=-
[6/6] Fetching recent audit entries for this wallet...
      audit (last 20 entries): allowed=18, denied=2
```

## Broaden beyond transfers

The same pact model also works for contract execution, payments, and broader blockchain automation. After the transfer hello-world works, the next canonical expansion is `contractCall` plus durable tracking by `request_id`:

```typescript theme={null}
const callFee = await txApi.estimateContractCallFee(walletId, {
  chain_id: 'BASE_ETH',
  contract_addr: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  calldata: '0x38ed1739...',
  value: '0',
});
console.log('CALL FEE:', callFee.data.result);

const callResult = await txApi.contractCall(walletId, {
  chain_id: 'BASE_ETH',
  contract_addr: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  calldata: '0x38ed1739...',
  value: '0',
  request_id: 'swap-2026-001',
});
console.log('CALL:', callResult.data.result.status);
```

Use [Contract Calls](/products/agentic-wallet/manual/developer/contract-calls) when your runtime automates swaps, vault deposits, staking, or other protocol interaction.

## Go further

The TypeScript SDK gives you direct typed access to the CAW API surface. Build on top of it by:

* wrapping API calls in domain-specific helpers for your runtime
* designing around Pact Drafting, Execution, and Observer responsibilities so each runtime path stays scoped
* combining it with your own tool-calling or orchestration layer
* using the CLI for pairing and debugging while keeping application logic in Node.js

<CardGroup cols={2}>
  <Card title="Handle Policy Denial" icon="triangle-exclamation" href="/products/agentic-wallet/manual/developer/handle-policy-denial">
    Production retry loop patterns and structured denial fields.
  </Card>

  <Card title="OpenAI Agents SDK" href="/products/agentic-wallet/manual/developer/openai">
    Use the TypeScript SDK inside an OpenAI Agents tool layer.
  </Card>

  <Card title="Python SDK" href="/products/agentic-wallet/manual/developer/api-client-python">
    The equivalent end-to-end flow in Python.
  </Card>
</CardGroup>
