> ## Documentation Index
> Fetch the complete documentation index at: https://cobo.com/products/agentic-wallet/manual/llms.txt
> Use this file to discover all available pages before exploring further.

# CLI

> Set up and operate a wallet from the terminal using the caw CLI.

Use this path when you want the fastest way to get from download to a first working CAW integration.

## Install

The `caw` CLI is a standalone binary.

```bash theme={null}
curl -fsSL https://raw.githubusercontent.com/CoboGlobal/cobo-agentic-wallet/master/install.sh | bash
```

This downloads the `caw` binary to `~/.cobo-agentic-wallet/bin/caw`. Add it to your PATH:

```bash theme={null}
export PATH="$HOME/.cobo-agentic-wallet/bin:$PATH"
```

Verify the installation:

```bash theme={null}
caw --version
```

## Onboard and pair with the wallet owner

Run the interactive onboarding wizard.

```bash theme={null}
caw onboard --wait
```

The wizard runs through several phases until wallet `status` becomes `active`.

Once the wallet is active, generate an 8-digit pairing token for the wallet owner:

```bash theme={null}
caw wallet pair --code-only
```

Wallet owner need download the `Cobo Agentic Wallet` App, then enter the token to complete ownership pairing. Check pairing status with:

```bash theme={null}
caw wallet pair-status
```

## Claim testnet tokens

The examples below run on Sepolia testnet and use native `SETH`. Request it from the built-in faucet:

```bash theme={null}
# List or generate a Sepolia address for your wallet
caw address list

# Request native Sepolia ETH
caw faucet deposit --token-id SETH --address <your-seth-address>
```

Check the balance with `caw wallet balance`. Continue once the tokens arrive.

## Get credentials

```bash theme={null}
caw wallet current --show-api-key
```

Note the `api_url`, `api_key`, and `wallet_uuid` values from the output.

## First hello-world flow

Before executing blockchain actions, submit a pact to request delegated access from the wallet owner. The owner approves the pact in the Cobo Agentic Wallet app.

* Submit a pact requesting transfer permissions

```bash theme={null}
caw pact submit --intent "Test ETH transfer on Sepolia" --execution-plan "Transfer 1 ETH on Sepolia for testing." --policies '[{"name":"allow-transfer","type":"transfer","rules":{"effect":"allow","when":{"chain_in":["SETH"],"token_in":[{"chain_id": "SETH", "token_id": "SETH"}]},"deny_if":{"amount_gt":"1"}}}]' --completion-conditions '[{"type":"tx_count","threshold":"1"}]'
```

* Once active, get the pact ID and check its status:

```bash theme={null}
caw pact status --pact-id <PACT_ID>
```

<Note>Required flags are `--intent`, `--execution-plan`, `--policies`, and `--completion-conditions`. See [Submit and manage pacts](/products/agentic-wallet/manual/developer/pacts) for the full pact lifecycle and [Pact policy reference](/products/agentic-wallet/manual/reference/pact-policies) for the policy schema and all available rule fields.</Note>

## Explore your wallet

```bash theme={null}
# List accessible wallets
caw wallet get

# Check balance
caw wallet balance

# List addresses
caw address list
```

## Transfer tokens

```bash theme={null}
PACT_ID=<pact-id>
DST=0x1111111111111111111111111111111111111111

# Allowed transfer
caw tx transfer --pact-id "$PACT_ID" --dst-address "$DST" --token-id SETH --amount 1 --chain-id SETH

# Oversized transfer — triggers policy denial
caw tx transfer --pact-id "$PACT_ID" --dst-address "$DST" --token-id SETH --amount 500 --chain-id SETH
```

On denial, output includes `code`, `reason`, `details`, and `suggestion`.

## Check audit logs

Audit logs are accessible via the Python SDK. See [Audit and Activity Logs](/products/agentic-wallet/manual/developer/audit) for the full query interface.

```python theme={null}
from cobo_agentic_wallet import WalletAPIClient
import asyncio

API_URL = "<api_url>"
API_KEY = "<api_key>"
WALLET_UUID = "<wallet_uuid>"

async def main():
    client = WalletAPIClient(base_url=API_URL, api_key=API_KEY)
    logs = await client.list_audit_logs(wallet_id=WALLET_UUID, result="denied")
    for entry in logs.get("items", []):
        print(entry["action"], entry["result"])
    await client.close()

asyncio.run(main())
```

## Go further

Once the CLI path works, move to an SDK if you want to keep the same flow inside application code:

* **Python SDK** — same flow, async client, better for custom logic and long-running runtimes.
* **TypeScript SDK** — same flow, typed Node.js client for backend services and agent runtimes.
* **Custom Skill** — good when your runtime already supports skill files and you want the lightest path.

<CardGroup cols={2}>
  <Card title="Python SDK" href="/products/agentic-wallet/manual/developer/api-client-python">
    Move the same flow into Python application code.
  </Card>

  <Card title="TypeScript SDK" href="/products/agentic-wallet/manual/developer/api-client-typescript">
    Move the same flow into Node.js or TypeScript application code.
  </Card>

  <Card title="CLI Reference" icon="terminal" href="/products/agentic-wallet/manual/reference/cli">
    Full command surface, options, and error handling.
  </Card>
</CardGroup>
