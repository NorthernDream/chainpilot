> ## Documentation Index
> Fetch the complete documentation index at: https://cobo.com/products/agentic-wallet/manual/llms.txt
> Use this file to discover all available pages before exploring further.

# Python SDK

> Canonical 5-minute Python SDK quickstart: submit a pact, execute an onchain action, handle policy denial, and verify in audit logs.

This is the canonical developer path for Cobo Agentic Wallet.

## 5-minute outcome

In one run, you will:

1. Submit a pact requesting scoped onchain permissions
2. Wait for owner approval
3. Execute one allowed onchain action using the pact-scoped API key
4. Trigger one policy denial and inspect the structured error
5. Verify in audit logs

## Prerequisites

* Python 3.11+
* A wallet already onboarded and paired via `caw onboard` (see [CLI quickstart](/products/agentic-wallet/manual/developer/cli))
* Testnet tokens on your wallet address (use `caw faucet deposit` to request Sepolia ETH)
* Your agent's API key and wallet UUID set as environment variables

## Step 1: Install SDK

```bash theme={null}
pip install cobo-agentic-wallet
```

## Step 2: Set environment variables

Set `AGENT_WALLET_API_URL` to your CAW API endpoint.

```bash theme={null}
export AGENT_WALLET_API_URL=https://api.agenticwallet.cobo.com
export AGENT_WALLET_API_KEY=your-agent-api-key
export AGENT_WALLET_WALLET_ID=your-wallet-uuid
```

## Step 3: Run the end-to-end script

```python title="quickstart.py" theme={null}
import asyncio
import os
import time

from cobo_agentic_wallet.client import WalletAPIClient
from cobo_agentic_wallet.errors import PolicyDeniedError

CHAIN_ID = "SETH"
TOKEN_ID = "SETH"
ALLOWED_AMOUNT = "0.001"
DENIED_AMOUNT = "0.005"
DENY_THRESHOLD = "0.002"

PACT_SPEC = {
    "policies": [
        {
            "name": "max-tx-limit",
            "type": "transfer",
            "rules": {
                "effect": "allow",
                "when": {
                    "chain_in": [CHAIN_ID],
                    "token_in": [{"chain_id": CHAIN_ID, "token_id": TOKEN_ID}],
                },
                "deny_if": {"amount_gt": DENY_THRESHOLD},
            },
        }
    ],
    "completion_conditions": [{"type": "time_elapsed", "threshold": "86400"}],
}


def print_tx(tag: str, tx: dict) -> None:
    print(
        f"      {tag}: tx_id={tx.get('id')} status={tx.get('status')} "
        f"({tx.get('status_display') or '-'}) request_id={tx.get('request_id')} "
        f"hash={tx.get('transaction_hash') or '-'}"
    )


async def main() -> None:
    api_url = os.environ["AGENT_WALLET_API_URL"]
    api_key = os.environ["AGENT_WALLET_API_KEY"]
    wallet_id = os.environ["AGENT_WALLET_WALLET_ID"]
    destination = os.environ.get("CAW_DESTINATION", "0x1111111111111111111111111111111111111111")

    async with WalletAPIClient(base_url=api_url, api_key=api_key) as client:
        # Step 1: Submit a pact requesting transfer permissions for 24 hours.
        print(
            f"[1/6] Submitting pact (allow {CHAIN_ID}/{TOKEN_ID} transfers, "
            f"deny if amount > {DENY_THRESHOLD})..."
        )
        pact_resp = await client.submit_pact(
            wallet_id=wallet_id,
            intent="Transfer tokens for integration testing",
            spec=PACT_SPEC,
        )
        pact_id = pact_resp["pact_id"]
        print(f"      pact submitted: id={pact_id}")

        # Step 2: Poll until the owner approves the pact.
        print("[2/6] Waiting for owner approval in the Cobo Agentic Wallet app...")
        started = time.monotonic()
        last_status = None
        while True:
            pact = await client.get_pact(pact_id)
            status = pact.get("status", "")
            if status != last_status:
                elapsed = int(time.monotonic() - started)
                print(f"      pact status -> {status} (elapsed {elapsed}s)")
                last_status = status
            if status == "active":
                break
            if status in ("rejected", "expired", "revoked", "completed"):
                raise RuntimeError(f"Pact reached terminal status before use: {status}")
            await asyncio.sleep(5)

        # Step 3: Use the pact-scoped API key for all subsequent calls.
        print("[3/6] Pact is active; switching to pact-scoped API key.")
        async with WalletAPIClient(base_url=api_url, api_key=pact["api_key"]) as pact_client:
            # Step 4: Execute an allowed transfer (within the deny threshold).
            print(f"[4/6] Submitting allowed transfer: {ALLOWED_AMOUNT} {TOKEN_ID} -> {destination}")
            allowed = await pact_client.transfer_tokens(
                wallet_id,
                chain_id=CHAIN_ID,
                dst_addr=destination,
                token_id=TOKEN_ID,
                amount=ALLOWED_AMOUNT,
            )
            print_tx("ALLOWED", allowed)

            # Step 5: Trigger a policy denial, then retry with a compliant amount.
            print(
                f"[5/6] Submitting transfer that should be blocked: "
                f"{DENIED_AMOUNT} {TOKEN_ID} -> {destination}"
            )
            try:
                await pact_client.transfer_tokens(
                    wallet_id,
                    chain_id=CHAIN_ID,
                    dst_addr=destination,
                    token_id=TOKEN_ID,
                    amount=DENIED_AMOUNT,
                )
            except PolicyDeniedError as exc:
                denial = exc.denial
                print(
                    f"      DENIED as expected: http={exc.status_code} "
                    f"code={denial.code} reason={denial.reason}"
                )
                if denial.details:
                    print(f"      details: {denial.details}")
                if denial.suggestion:
                    print(f"      suggestion: {denial.suggestion}")

                print(f"      retrying with compliant amount {ALLOWED_AMOUNT} {TOKEN_ID}...")
                retry = await pact_client.transfer_tokens(
                    wallet_id,
                    chain_id=CHAIN_ID,
                    dst_addr=destination,
                    token_id=TOKEN_ID,
                    amount=ALLOWED_AMOUNT,
                )
                print_tx("RETRY ALLOWED", retry)

        # Step 6: Verify allowed and denied events in audit logs.
        print("[6/6] Fetching recent audit entries for this wallet...")
        logs = await client.list_audit_logs(wallet_id=wallet_id, limit=20)
        items = logs.get("items", [])
        allowed_count = sum(1 for item in items if item.get("result") == "allowed")
        denied_count = sum(1 for item in items if item.get("result") == "denied")
        print(f"      audit (last {len(items)} entries): allowed={allowed_count}, denied={denied_count}")


asyncio.run(main())
```

## Step 4: Validate output

You should see:

```text theme={null}
[1/6] Submitting pact (allow SETH/SETH transfers, deny if amount > 0.002)...
      pact submitted: id=<pact-id>
[2/6] Waiting for owner approval in the Cobo Agentic Wallet app...
      pact status -> active (elapsed 0s)
[3/6] Pact is active; switching to pact-scoped API key.
[4/6] Submitting allowed transfer: 0.001 SETH -> 0x1111111111111111111111111111111111111111
      ALLOWED: tx_id=<tx-id> status=400 (Processing) request_id=<request-id> hash=-
[5/6] Submitting transfer that should be blocked: 0.005 SETH -> 0x1111111111111111111111111111111111111111
      DENIED as expected: http=403 code=TRANSFER_LIMIT_EXCEEDED reason=matched_pact_transfer_deny_if
      details: {'reason': 'matched_pact_transfer_deny_if', 'chain_id': 'SETH', 'token_id': 'SETH', 'dst_addr': '0x1111111111111111111111111111111111111111', 'tier': 'pact', 'policy_type': 'transfer', 'policy_id': '<policy-id>'}
      suggestion: Operation denied by active transfer policy. Adjust parameters or request owner policy updates.
      retrying with compliant amount 0.001 SETH...
      RETRY ALLOWED: tx_id=<tx-id> status=400 (Processing) request_id=<request-id> hash=-
[6/6] Fetching recent audit entries for this wallet...
      audit (last 20 entries): allowed=19, denied=1
```

## Broaden beyond transfers

The same pact-and-policy flow also applies to smart-contract interaction and payments. Once the transfer hello-world works, the next canonical expansion is `contract_call` plus durable tracking by `request_id`:

```python theme={null}
fee = await pact_client.estimate_contract_call_fee(
    wallet_id,
    chain_id="BASE_ETH",
    contract_addr="0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    calldata="0x38ed1739...",
    value="0",
)
print("CALL FEE:", fee)

call_result = await pact_client.contract_call(
    wallet_id,
    chain_id="BASE_ETH",
    contract_addr="0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    calldata="0x38ed1739...",
    value="0",
    request_id="swap-2026-001",
)
print("CALL:", call_result.get("status", "unknown"))
```

Use [Contract Calls](/products/agentic-wallet/manual/developer/contract-calls) when your runtime automates swaps, staking, vault deposits, or other protocol interaction.

## Go further

`WalletAPIClient` is a direct API wrapper — it gives you full control. You can build on top of it in several ways:

* **Write custom tool functions** — wrap `WalletAPIClient` calls in domain-specific functions that encode your business logic (e.g. `transfer_with_price_check`, `batch_payout`), then expose those as agent tools.
* **Use framework integrations** — `AgentWalletToolkit` exposes the widened runtime toolkit as native LangChain or OpenAI Agents SDK tools. Use it for the canonical wallet/pact/onchain surface, and add your own custom tools alongside it for extended functionality.
* **Pair with the CLI** — use `caw` for onboarding, debugging, and one-off operations; use `WalletAPIClient` for programmatic agent logic. They share the same config and credentials.
* **Design around presets** — even if you later expose CAW through an agent framework, keep your runtime logic split into Pact Drafting, Execution, and Observer responsibilities.

<CardGroup cols={2}>
  <Card title="Handle Policy Denial" icon="triangle-exclamation" href="/products/agentic-wallet/manual/developer/handle-policy-denial">
    Production retry loop patterns and structured denial fields.
  </Card>

  <Card title="LangChain" href="/products/agentic-wallet/manual/developer/langchain">
    Add wallet tools to a LangChain agent with one toolkit call.
  </Card>

  <Card title="CLI" href="/products/agentic-wallet/manual/developer/cli">
    Pair with CLI for onboarding and debugging.
  </Card>
</CardGroup>
