# ChainPilot

> **链上自动化的安全执行层** —— 给你的交易策略 / agent 一个「不会跑路的保险箱」。
> agent 帮你 24h 自主执行,但每一笔都被 **Cobo Agentic Wallet (CAW)** 的 Pact policy 硬约束:
> 亏不超过你设的边界、超界即停、私钥它永远拿不到(MPC)、可审计、可一键冻结。
>
> 🏆 AI × Web3 Agentic Builders Hackathon · **Cobo Track**

---

## 一句话

你把「安全契约」(单笔上限 / 日累计上限)委托给一个自主交易 agent,ChainPilot 把它编译成 CAW 的 **Pact policy**;agent 24h 自主盯盘下单,但**每一笔提交前都过 CAW 服务端策略校验**:合规 → 真实链上执行;越界 → 当场被 **403 拦截**。私钥始终在 CAW 的 MPC 里,agent 永远拿不到。

## 为什么是「安全」,不是「赚钱」或「降门槛」

Web3 自动化里,真正值钱的不是 alpha,也不是 UX,而是**安全地把执行权委托出去**:

- 卖 alpha(AI 帮你炒币赚钱)= 不可信,demo 证明不了盈利
- 卖 UX(自然语言降门槛)= 伪需求 + 同质化
- **卖安全 = 真刚需**:跑链上 bot 的人几乎都是**裸私钥放服务器**,资损是行业日常痛点;Safe 多签又慢又不 agentic。「agent 自主执行 + 硬安全边界」这个中间态市面是空的,而 CAW 正好是它。

**关键洞察 —— 边界的「执行位置」决定一切:**

| | 裸私钥 bot | ChainPilot + CAW |
|---|---|---|
| 私钥 | 明文在服务器 | 在 CAW MPC,永不可导出 |
| 限额写在哪 | agent 自己代码里(和私钥同一信任域) | CAW 服务端 policy(agent 够不到) |
| agent 被劫持 / 出 bug / 被注入 | 限额能被改掉或绕过 → 资产可被卷走 | **越不过那道线** —— policy 在 agent 之外强制 |

> **CAW = 商业价值本身**,拿掉这套 Pact/policy/MPC 产品就不存在 —— 这正是 Cobo Track 评分的核心。

---

## 产品形态:自主 agent 托管驾驶舱

一个跑 bot 的人会长期待着的安全操作面(单页 cockpit):

- **金库主区**:受保护资产 + 「私钥 ∈ CAW MPC · 永不可导出」+ agent 自主状态
- **CAW 实时执行**:日累计预算 gauge(实时消耗)+ 单笔硬顶,标 `deny_if`
- **实时行情 + CAW 裁决流**:真实 ETH 行情驱动 agent;每笔操作实时显示 ✓合规放行(真 tx hash↗)/ ✕拒绝·403
- **链上铁证**:合规交易真 etherscan hash + 403 denial 记录
- **一键冻结** kill switch:`revokePact` 撤销授权,agent 立即失能

### money shot(demo 命门,真实涌现)

agent 用真实 ETH 行情触发,连续做合规的止盈卖出(**真实链上 tx**);日累计预算逐笔填满;当下一笔会超出日累计上限时,**CAW 当场返回真实 `403 DAILY_VALUE_LIMIT_EXCEEDED`** —— 红光高光 + 「当日预算已用尽」。

不是前端假装:这是真 testnet、真 CAW policy、真 403。配一句对照:

> 限额若写在 bot 自己代码里,被劫持/出 bug 就能绕过;CAW 这道在 agent 够不到的 MPC 层。

---

## 架构

```
┌──────────────────────────────────────────────────────────┐
│  前端 Cockpit  (Vite + React, web/)                        │
│  金库 · 边界 gauge · 实时行情 · CAW 裁决流 · 铁证 · 冻结     │
│  ▲ WebSocket 事件流  + HTTP 命令                            │
└───────────────────────────┬──────────────────────────────┘
                            │  :8787
┌───────────────────────────┴──────────────────────────────┐
│  后端 Orchestrator  (Node + TS, src/)                      │
│   Strategy Agent(自主决策) → Executor → 事件总线           │
│   live market(真实 ETH 行情回放)驱动 agent 周期性下单       │
└───────────────────────────┬──────────────────────────────┘
                            │  @cobo/agentic-wallet SDK
┌───────────────────────────┴──────────────────────────────┐
│  Cobo Agentic Wallet  (Sepolia testnet)                    │
│  Pact 授权 · policy deny_if(单笔/日累计)· MPC · audit       │
└──────────────────────────────────────────────────────────┘
```

## CAW 关键性 —— 看这几个文件

| 文件 | 作用 | CAW 角色 |
|---|---|---|
| **`src/caw/pacts.ts`** | 安全边界 → CAW Pact policy 编译(`when` 白名单 + `deny_if` 单笔上限 + `usage_limits.rolling_24h` 日累计) | Drafting |
| **`src/executor.ts`** | 每笔走 CAW:`ensurePact` → `transferTokens`(合规真 tx)/ catch 403(`parseDenial`)→ 拦截;`freeze` = `revokePact` | Execution |
| `src/caw/client.ts` | CAW OpenAPI 客户端封装 + `waitForPactActive` / `resolveSourceAddr` / 网络重试 | — |
| `src/orchestrator.ts` | 主 loop + live market + 事件总线 + 一键冻结 | — |

policy 真实结构见 `docs/caw-reference/pact-policies.md`;CAW 接入命令见 `docs/01-caw-onboarding.md`。

---

## 本地运行(真实 CAW)

需要 Node.js ≥ 18(推荐 22)。

### 1. 接入 CAW 拿凭证

```bash
# 装 caw CLI(交互式,无需注册,内置 testnet faucet)
curl -fsSL https://raw.githubusercontent.com/CoboGlobal/cobo-agentic-wallet/master/install.sh | bash
export PATH="$HOME/.cobo-agentic-wallet/bin:$PATH"

caw onboard --wait                                   # 创建+激活钱包
caw address list                                     # 取 ETH 地址
caw faucet deposit --token-id SETH --address <ETH地址>   # 领 testnet 币
caw wallet current --show-api-key                    # 拿 api_key / wallet_uuid
```

详见 `docs/01-caw-onboarding.md`。

### 2. 后端

```bash
cp .env.example .env        # 填入 api_url / api_key / wallet_uuid(见下)
npm install
npm run hello               # 可选:连通自检(一笔合规 + 一笔超界 403)
npm run dev                 # 启动 HTTP + WebSocket 后端,:8787
```

`.env` 三个值:
```
AGENT_WALLET_API_URL=https://api.agenticwallet.cobo.com
AGENT_WALLET_API_KEY=<api_key>
AGENT_WALLET_WALLET_ID=<wallet_uuid>
```

### 3. 前端

```bash
cd web
npm install
npm run dev                 # Vite 开发服务器,:5173
```

打开 `http://localhost:5173` → 点「授权并启动 agent」→ 看 agent 自主交易、预算涨满、CAW 当场 403 摁停、一键冻结。

---

## 部署

> ⚠️ **后端是长驻有状态进程**(WebSocket server + 内存 orchestrator + 行情循环 + 连 CAW),**不能跑在 Vercel / 任何 serverless 上**。

| 部分 | 部署到 | 说明 |
|---|---|---|
| **前端** | **Vercel**(已配 `vercel.json`) | 导入仓库即可,自动构建 `web/`。无后端时优雅降级到「演示模式」(完整 UI + 示例数据 + 可点的 etherscan hash),评委打开公开 URL 即可看到产品 |
| **后端** | 本地 / Railway / Render / Fly | 真实 CAW demo:本地 `npm run dev`(录屏/现场);要公开 live 后端就上支持常驻 Node+WS 的平台,填入 CAW secrets |

前端连后端的地址用环境变量 `VITE_API_BASE`(默认 `http://localhost:8787`):
- Vercel 纯展示:不设 → 自动演示模式
- 接公开后端:在 Vercel 项目设 `VITE_API_BASE=https://<你的后端域名>`

---

## 显示层 vs 执行层(对评委透明)

界面展示金额做了**演示放大**(金库 1000 ETH、单笔卖出 1 ETH、日累计 5 ETH)以便观感体面;**真实 testnet 执行为对应小额**(0.001 / 0.005 ETH),tx hash 链上可查。**机制完全真实** —— 真 Pact、真 policy、真 403 denial,只是金额数量级不同。

## 技术栈

全 TypeScript · Node.js 22 · `@cobo/agentic-wallet`(CAW SDK)· Vite + React(cockpit)· `ws`(WebSocket)· Sepolia testnet

## 目录结构

```
chainpilot/
├── src/                    # 后端
│   ├── caw/                # CAW 接入:client / pacts(策略→policy)/ types
│   ├── strategy/           # Strategy Agent:parse / triggers / agent
│   ├── market/             # 行情:真实 ETH 数据回放 eth-replay.ts
│   ├── executor.ts         # 每笔走 CAW(合规执行 / 403 拦截 / 冻结)
│   ├── orchestrator.ts     # 主 loop + live market + 事件总线
│   ├── server.ts           # HTTP + WebSocket
│   └── events.ts           # 前后端共享事件契约
├── web/                    # 前端 cockpit(Vite + React)
├── scripts/hello-world.ts  # CAW 连通自检
├── docs/                   # 方向 / 接入 / 架构 / CAW SDK 速查 / 官方文档存档
└── vercel.json             # 前端 Vercel 部署配置
```

## Cobo Track 评分对照

| 标准 | 命中 |
|---|---|
| 场景贴合度 | 真刚需(防资损)+ 受众明确(散户跑 bot / 量化 / DAO 金库 / agent 开发者),不卖虚 alpha / 伪 UX |
| **CAW 关键性** | 整个产品 = Pact / policy / MPC,拿掉就不存在(`src/caw/pacts.ts` + `src/executor.ts`) |
| 资金流程完整度 | 授权 → 编译 pact → agent 自主执行 → CAW 校验 → 审计/冻结,真实闭环 |
| 可演示性 | money shot:预算耗尽 → 真实 403 摁停,红光高光 + 真 tx hash |
| 风险边界 | CAW `deny_if`(单笔 + 日累计 rolling_24h)+ MPC + 一键冻结 = 产品核心本身 |

## 商业模式

对标 **Fireblocks**(机构托管,~80 亿美金)/ Gnosis Safe —— 卖安全/托管,模式已验证。受众:散户跑 bot、量化小队、DAO 金库、agent 开发者。付费:按托管资产规模 / 订阅 / 按防护额度。
