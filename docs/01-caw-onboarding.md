# CAW 接入 Runbook(实测命令)

> 全部命令来自 Cobo 官方文档存档(`docs/caw-reference/cli.md`)。
> **关键认知:CAW 不需要注册/审批**。官方原话 "No account or sign-up required" —— 一条脚本本地生成钱包,内置 testnet faucet。

## 你要拿到的三个值

最终目标是拿到这三个,填进 `.env`:
- `api_url` → `https://api.agenticwallet.cobo.com`
- `api_key`
- `wallet_uuid`

## 步骤(Sepolia 测试网,链 ID = `SETH`)

```bash
# (1) 装 caw CLI(standalone binary)
curl -fsSL https://raw.githubusercontent.com/CoboGlobal/cobo-agentic-wallet/master/install.sh | bash
export PATH="$HOME/.cobo-agentic-wallet/bin:$PATH"
caw --version

# (2) 一条命令创建+激活钱包(跑到 status=active,无需注册)
caw onboard --wait

# (3) 领 testnet 币(内置 faucet,不用外部水龙头)
caw address list                                   # 拿 SETH 地址
caw faucet deposit --token-id SETH --address <你的SETH地址>
caw wallet balance                                 # 等币到账后继续

# (4) 拿凭证 → 填进 .env
caw wallet current --show-api-key
# 记下 api_url / api_key / wallet_uuid
```

## Pairing(决定 demo 能否展示 MPC 审批)

- **测试阶段可跳过 pair**:不 pair 时 agent 自己是 owner,无限制,适合快速联调。
- **录 demo 要 pair**:money shot 的"Risk 拦截 + MPC 审批介入"那一幕,需要 owner 审批流。
  ```bash
  caw wallet pair --code-only      # 生成 8 位 pairing token
  caw wallet pair-status           # 查配对状态
  ```
  owner 下载 `Cobo Agentic Wallet` App,输入 token 完成配对。over-limit 交易会 pause 等 App 里点审批。

## H0-4 决策门(必须过)

跑通以下即视为 CAW 路打通,继续主线开发:
1. `caw onboard --wait` → wallet active
2. faucet 到账,`caw wallet balance` 有 SETH
3. `caw wallet current --show-api-key` 拿到三个值
4. 一笔 allowed transfer 成功 + 一笔超限 transfer 被 policy deny(用 `docs/03-caw-sdk-cheatsheet.md` 的 hello-world)

**若 4 步内卡住超过 4 小时**(install 失败 / onboard 不 active / faucet 不到账 / API 报错)→ 切 Z.AI fallback(`docs/00-direction.md` 方向 C)。

## 钱包结构(ChainPilot)

ChainPilot 只有 **Executor** 真正持钱并执行;Strategy Agent 只做决策(不持钱,LLM),Auditor 是 Observer(读审计)。所以:
- **MVP**:单钱包(`EXECUTOR_WALLET_ID`)+ 多 pact(每个意图一个 pact,policy 限额在 pact 里)。够 demo。
- **要展示真·多链**(视觉更强):CAW 一个钱包本身支持多链地址(Sepolia / Base Sepolia / Solana devnet),`caw address list` 各链生成地址即可;不必每条链开独立钱包。跨链归集 demo 用这个多链地址簿。
- 真要多钱包(如分账场景)再重复 `caw onboard`,把 wallet_uuid 填进 `.env`。
