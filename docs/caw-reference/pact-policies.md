> ## Documentation Index
> Fetch the complete documentation index at: https://cobo.com/products/agentic-wallet/manual/llms.txt
> Use this file to discover all available pages before exploring further.

# Pact policies and completion conditions

> JSON reference for the two required arrays in every pact submission: completion conditions that auto-terminate the pact, and policies that constrain which operations the agent can perform.

Every pact submission includes two top-level JSON arrays:

```json theme={null}
{
  "completion_conditions": [ ... ],
  "policies": [ ... ]
}
```

**Completion conditions** define when the pact automatically ends — time elapsed, transactions executed, or amount spent. The pact is revoked as soon as any one condition is met.

**Policies** define what the agent is allowed to do while the pact is active — which chains, tokens, contracts, or message types are permitted, and what limits apply.

***

## Completion conditions

Completion conditions determine when a pact automatically ends. At least one is required. The pact completes when **any** condition is satisfied, after which access is revoked immediately. Types cannot be duplicated within a pact.

| Type               | Threshold        | Description                                                                       |
| ------------------ | ---------------- | --------------------------------------------------------------------------------- |
| `tx_count`         | string (integer) | Complete after N successful transactions — e.g. `"1"` for a one-time operation    |
| `amount_spent`     | string (decimal) | Complete after cumulative token amount reaches this — e.g. `"1000"` for 1000 USDC |
| `amount_spent_usd` | string (decimal) | Complete after cumulative USD spend reaches this — e.g. `"500"`                   |
| `time_elapsed`     | string (seconds) | Complete after N seconds from pact activation — e.g. `"2592000"` for 30 days      |

```json theme={null}
[
  {"type": "tx_count", "threshold": "12"},
  {"type": "time_elapsed", "threshold": "7776000"}
]
```

This pact ends after 12 transactions or 90 days, whichever comes first.

***

## Policies

Policies are the rules that constrain what an agent can do within a pact. Every operation the runtime submits is evaluated against the policies you define.

### How the engine works

The policy engine evaluates every operation against all applicable policies and outputs one of three decisions: **allow**, **require\_approval**, or **deny**.

#### Evaluation order (within a policy)

1. Match `when` conditions — if not matched, the policy is skipped
2. Check `deny_if` — if hit, deny immediately
3. Check `review_if` / `always_review` — if hit, pause for owner approval
4. Otherwise, allow

#### Default-deny semantics

Pact-level policies use **fail-closed** semantics: if the operation does not match any policy's `when` conditions, it is automatically denied. Every operation the agent needs to perform must be explicitly covered by a policy.

#### Final decision

When multiple policies apply:

* Any deny → **deny**
* No deny, but any review triggered → **require\_approval**
* Otherwise → **allow**

### Policy structure

Each policy in the `policies` array has this shape:

```json theme={null}
{
  "name": "<human-readable name>",
  "type": "transfer | contract_call | message_sign",
  "rules": {
    "effect": "allow",
    "when": { ... },
    "deny_if": { ... },
    "review_if": { ... },
    "always_review": true | false
  }
}
```

| Field                 | Required                           | Description                                                                            |
| --------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| `name`                | Yes                                | Human-readable label for this policy                                                   |
| `type`                | Yes                                | Operation type: `transfer`, `contract_call`, or `message_sign`                         |
| `rules.effect`        | Yes                                | Always `"allow"` for pact-level policies                                               |
| `rules.when`          | Yes (unless `always_review: true`) | Allowlist conditions — which chains, tokens, or contracts are permitted                |
| `rules.deny_if`       | No                                 | Hard-block conditions — operations that exceed these limits are denied                 |
| `rules.review_if`     | No                                 | Soft-block conditions — operations exceeding these thresholds pause for owner approval |
| `rules.always_review` | No                                 | When `true`, every matched operation requires owner approval                           |

**Constraints:**

* `deny_if` takes priority over `review_if` / `always_review`
* `deny` effect policies cannot have `review_if` or `always_review`
* `allow` + `review_if` requires a non-empty `when`
* `allow` requires either a non-empty `when` or `always_review: true`

***

## Transfer policies

Use `"type": "transfer"` to control token transfers.

### `when` — allowlist conditions

All fields are AND conditions. All specified fields must match.

| Field                    | Type                | Description                                                                                   |
| ------------------------ | ------------------- | --------------------------------------------------------------------------------------------- |
| `chain_in`               | `string[]`          | Restrict to specific chains, e.g. `["BASE_ETH", "ETH"]`                                       |
| `token_in`               | `ChainTokenRef[]`   | Restrict to specific tokens — `[{"chain_id": "BASE_ETH", "token_id": "BASE_USDC"}]`           |
| `destination_address_in` | `ChainAddressRef[]` | Restrict to specific destination addresses — `[{"chain_id": "BASE_ETH", "address": "0x..."}]` |

### `deny_if` — hard-block limits

| Field                      | Type             | Description                                           |
| -------------------------- | ---------------- | ----------------------------------------------------- |
| `amount_gt`                | string (decimal) | Deny if a single transfer's token amount exceeds this |
| `amount_usd_gt`            | string (decimal) | Deny if a single transfer's USD value exceeds this    |
| `usage_limits.rolling_1h`  | object           | Rolling 1-hour window limits                          |
| `usage_limits.rolling_24h` | object           | Rolling 24-hour window limits                         |
| `usage_limits.rolling_7d`  | object           | Rolling 7-day window limits                           |
| `usage_limits.rolling_30d` | object           | Rolling 30-day window limits                          |

Each rolling window supports: `amount_gt`, `amount_usd_gt`, `tx_count_gt`.

### `review_if` — approval thresholds

Supports the same fields as `when` (`chain_in`, `token_in`, `destination_address_in`), plus:

| Field           | Type             | Description                                   |
| --------------- | ---------------- | --------------------------------------------- |
| `amount_gt`     | string (decimal) | Require approval if token amount exceeds this |
| `amount_usd_gt` | string (decimal) | Require approval if USD value exceeds this    |

### Examples

<CodeGroup>
  ```json Allowlist by chain and token theme={null}
  {
    "name": "usdc-on-base",
    "type": "transfer",
    "rules": {
      "effect": "allow",
      "when": {
        "chain_in": ["BASE_ETH"],
        "token_in": [{"chain_id": "BASE_ETH", "token_id": "BASE_USDC"}]
      }
    }
  }
  ```

  ```json Spend cap with approval threshold theme={null}
  {
    "name": "usdc-transfer",
    "type": "transfer",
    "rules": {
      "effect": "allow",
      "when": {
        "chain_in": ["BASE_ETH"],
        "token_in": [{"chain_id": "BASE_ETH", "token_id": "BASE_USDC"}],
        "destination_address_in": [{"chain_id": "BASE_ETH", "address": "0xRecipient..."}]
      },
      "review_if": {
        "amount_usd_gt": "100"
      },
      "deny_if": {
        "amount_usd_gt": "110",
        "usage_limits": {
          "rolling_24h": {"amount_usd_gt": "500", "tx_count_gt": 10}
        }
      }
    }
  }
  ```

  ```json Rolling window limits theme={null}
  {
    "name": "daily-budget",
    "type": "transfer",
    "rules": {
      "effect": "allow",
      "when": {"chain_in": ["SETH"]},
      "deny_if": {
        "usage_limits": {
          "rolling_1h":  {"tx_count_gt": 5},
          "rolling_24h": {"amount_usd_gt": "10000", "tx_count_gt": 20},
          "rolling_7d":  {"amount_usd_gt": "50000"},
          "rolling_30d": {"amount_usd_gt": "150000"}
        }
      }
    }
  }
  ```

  ```json Always require approval theme={null}
  {
    "name": "always-review",
    "type": "transfer",
    "rules": {
      "effect": "allow",
      "always_review": true
    }
  }
  ```
</CodeGroup>

***

## Contract call policies

Use `"type": "contract_call"` to control smart contract interactions. EVM and Solana use different target fields.

### `when` — allowlist conditions (EVM)

| Field          | Type                  | Description                                                                                                                                                                                                  |
| -------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chain_in`     | `string[]`            | Restrict to specific chains                                                                                                                                                                                  |
| `target_in`    | `ContractTargetRef[]` | Allowlist by contract address and optionally function selector — `[{"chain_id": "SETH", "contract_addr": "0x...", "function_id": "0x38ed1739"}]`. Omit `function_id` to allow all functions on the contract. |
| `params_match` | `ParamMatchRule[]`    | Match on decoded calldata parameters (EVM only — requires `function_abis`)                                                                                                                                   |

### `when` — allowlist conditions (Solana)

| Field            | Type           | Description                                                           |
| ---------------- | -------------- | --------------------------------------------------------------------- |
| `chain_in`       | `string[]`     | Restrict to specific chains                                           |
| `program_in`     | `ProgramRef[]` | Allow if the transaction involves **any** of the listed programs      |
| `program_all_in` | `ProgramRef[]` | Allow only if the transaction involves **all** of the listed programs |

### `params_match` rule

Used to match on decoded function parameters. Requires `function_abis` to be set.

| Field        | Type   | Description                                           |
| ------------ | ------ | ----------------------------------------------------- |
| `param_name` | string | Parameter name as defined in the ABI                  |
| `op`         | string | `eq`, `neq`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte` |
| `value`      | any    | Value to compare against                              |

`params_match` is only supported on EVM chains. Multiple rules are AND conditions.

### `function_abis`

Required when using `params_match`. Provide the ABI fragment for each function selector you reference:

```json theme={null}
"function_abis": [
  {
    "type": "function",
    "selector": "0x38ed1739",
    "inputs": [
      {"name": "amountIn", "type": "uint256"},
      {"name": "recipient", "type": "address"}
    ]
  }
]
```

### `deny_if` — hard-block limits

| Field           | Type   | Description                                                                                                                                                       |
| --------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `amount_gt`     | string | Deny if the operation's native value exceeds this                                                                                                                 |
| `amount_usd_gt` | string | Deny if the USD value exceeds this                                                                                                                                |
| `usage_limits`  | object | Same rolling window structure as transfer (`rolling_1h`, `rolling_24h`, `rolling_7d`, `rolling_30d`), each supporting `amount_gt`, `amount_usd_gt`, `tx_count_gt` |

### `review_if` — approval thresholds

Supports the same fields as `when` (`chain_in`, `target_in`, `program_in`, `params_match`), plus `amount_gt` and `amount_usd_gt`.

### Examples

<CodeGroup>
  ```json EVM contract allowlist theme={null}
  {
    "name": "uniswap-swap",
    "type": "contract_call",
    "rules": {
      "effect": "allow",
      "when": {
        "chain_in": ["BASE_ETH"],
        "target_in": [{"chain_id": "BASE_ETH", "contract_addr": "0x2626664c2603336E57B271c5C0b26F421741e481"}]
      },
      "deny_if": {
        "usage_limits": {"rolling_24h": {"tx_count_gt": 5}}
      }
    }
  }
  ```

  ```json Function selector + param matching theme={null}
  {
    "name": "swap-with-min-amount",
    "type": "contract_call",
    "rules": {
      "effect": "allow",
      "when": {
        "target_in": [{"chain_id": "SETH", "contract_addr": "0xrouter...", "function_id": "0x38ed1739"}],
        "params_match": [
          {"param_name": "amountIn", "op": "gte", "value": "1000000000000000000"}
        ]
      },
      "review_if": {
        "target_in": [{"chain_id": "SETH", "contract_addr": "0xrouter...", "function_id": "0x38ed1739"}],
        "params_match": [
          {"param_name": "amountIn", "op": "gt", "value": "50000000000000000000"}
        ]
      },
      "function_abis": [
        {
          "type": "function",
          "selector": "0x38ed1739",
          "inputs": [
            {"name": "amountIn", "type": "uint256"},
            {"name": "recipient", "type": "address"}
          ]
        }
      ]
    }
  }
  ```

  ```json Solana program allowlist theme={null}
  {
    "name": "jupiter-swap",
    "type": "contract_call",
    "rules": {
      "effect": "allow",
      "when": {
        "program_in": [
          {"chain_id": "SOL", "program_id": "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"}
        ]
      }
    }
  }
  ```
</CodeGroup>

***

## Message sign policies

Use `"type": "message_sign"` to control EIP-712 typed-data signing. There are no `amount_gt` / `amount_usd_gt` fields — rate limits use `request_count_gt` instead.

### `when` — allowlist conditions

| Field               | Type                | Description                                                                            |
| ------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `chain_in`          | `string[]`          | Restrict to specific chains                                                            |
| `primary_type_in`   | `string[]`          | Match on the EIP-712 `primaryType` field, e.g. `["PermitSingle", "PermitBatch"]`       |
| `source_address_in` | `ChainAddressRef[]` | Restrict to specific signing addresses. EVM: case-insensitive. Solana: case-sensitive. |
| `domain_match`      | `MatchRule[]`       | Match on EIP-712 `domain` fields                                                       |
| `message_match`     | `MatchRule[]`       | Match on EIP-712 `message` fields                                                      |

All `when` fields are AND conditions.

### Path syntax for `domain_match` and `message_match`

Use dot notation to address nested fields:

| Syntax    | Meaning               | Example            |
| --------- | --------------------- | ------------------ |
| `.`       | Nested field          | `details.spender`  |
| `[N]`     | Array index (0-based) | `path[0].tokenIn`  |
| `*`       | All array elements    | `items.*.token`    |
| `.length` | Array length          | `transfers.length` |

**Wildcard semantics** — for multi-value paths like `items.*.token`:

* `eq`, `in`, `gt`, `gte`, `lt`, `lte`: matches if **any** element satisfies the condition
* `neq`, `not_in`: matches only if **all** elements satisfy the condition

**Supported operators:** `eq`, `neq`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`

#### Path resolution failures

When a path cannot be resolved, the rule does not match:

| Situation                                          | Result             |
| -------------------------------------------------- | ------------------ |
| Intermediate field missing or `null`               | No match           |
| `*` applied to a non-array                         | No match           |
| `[N]` index out of bounds                          | No match           |
| `.length` applied to a non-array                   | No match           |
| Empty array + `eq`, `in`, `gt`, `gte`, `lt`, `lte` | `false` (no match) |
| Empty array + `neq`, `not_in`                      | `true` (matches)   |

### `deny_if` — rate limits

| Field                                       | Type    | Description                                              |
| ------------------------------------------- | ------- | -------------------------------------------------------- |
| `usage_limits.rolling_1h.request_count_gt`  | integer | Deny if signing requests in the past hour exceed this    |
| `usage_limits.rolling_24h.request_count_gt` | integer | Deny if signing requests in the past 24h exceed this     |
| `usage_limits.rolling_7d.request_count_gt`  | integer | Deny if signing requests in the past 7 days exceed this  |
| `usage_limits.rolling_30d.request_count_gt` | integer | Deny if signing requests in the past 30 days exceed this |

### `review_if` — approval thresholds

Supports the same fields as `when` (`chain_in`, `primary_type_in`, `source_address_in`, `domain_match`, `message_match`).

### Chain ID validation

For EVM chains, the engine checks that the request `chain_id` matches `domain.chainId` in the typed data. A mismatch results in an immediate deny with reason `eip712_domain_chain_id_mismatch`.

### Examples

<CodeGroup>
  ```json Permit2 — restrict spender and token theme={null}
  {
    "name": "permit2-allowlist",
    "type": "message_sign",
    "rules": {
      "effect": "allow",
      "when": {
        "chain_in": ["SETH"],
        "primary_type_in": ["PermitSingle", "PermitBatch"],
        "domain_match": [
          {"param_name": "name", "op": "eq", "value": "Permit2"},
          {"param_name": "verifyingContract", "op": "eq", "value": "0x000000000022d473030f116ddee9f6b43ac78ba3"}
        ],
        "message_match": [
          {"param_name": "details.spender", "op": "in", "value": ["0xabc...", "0xdef..."]},
          {"param_name": "details.token",   "op": "in", "value": ["0x111...", "0x222..."]}
        ]
      },
      "review_if": {
        "message_match": [
          {"param_name": "details.amount", "op": "gt", "value": "1000000000000000000"}
        ]
      },
      "deny_if": {
        "usage_limits": {
          "rolling_1h":  {"request_count_gt": 10},
          "rolling_24h": {"request_count_gt": 100}
        }
      }
    }
  }
  ```

  ```json Always require approval theme={null}
  {
    "name": "review-all-signatures",
    "type": "message_sign",
    "rules": {
      "effect": "allow",
      "always_review": true
    }
  }
  ```

  ```json Limit batch size theme={null}
  {
    "name": "batch-size-limit",
    "type": "message_sign",
    "rules": {
      "effect": "allow",
      "when": {
        "chain_in": ["SETH"],
        "primary_type_in": ["BatchTransfer"],
        "message_match": [
          {"param_name": "transfers.length", "op": "lte", "value": 10}
        ]
      }
    }
  }
  ```
</CodeGroup>

***

## Amount units

`amount_gt`, `amount_spent`, and related fields use the **token's transfer unit** — the same unit passed when submitting a transfer:

* `"1.5"` for USDC means 1.5 USDC (not 1,500,000 micro-USDC)
* `"0.01"` for ETH means 0.01 ETH (not wei)

<Note>
  USD-based conditions (`amount_usd_gt`, `amount_spent_usd`) only apply to tokens with available price data. For tokens without price data, use token-denominated limits (`amount_gt`, `amount_spent`) instead.
</Note>
