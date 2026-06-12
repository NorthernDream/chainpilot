# ChainPilot — 项目指令

> 参加 **AI × Web3 Agentic Builders Hackathon**(Cobo Track)的 demo 项目。
> 截止:**2026-06-13 12:00 UTC+8** | Demo Day:6/14 | 奖池:Cobo Track 3500 USDT。

## 一句话定位

**链上自动化的安全执行层** —— 给你的交易策略 / agent 一个"不会跑路的保险箱"。
你用自然语言设定策略,执行 agent 24h 自主跑,但每一笔都被 **Cobo Agentic Wallet (CAW)** 的 Pact policy 硬约束:**亏不超过你设的边界、超界即停、私钥它永远拿不到、可审计、可一键冻结**。

完整方向 + 商业化论证 + 为什么不是另两个方向,见 `docs/00-direction.md`。

## 核心洞察(项目灵魂,别丢)

Web3 自动化里,**值钱的不是 alpha(赚钱),也不是 UX(降门槛),而是"安全地把执行权委托出去"**:
- 卖 alpha(自运转对冲基金)= 不可信,48h 证明不了盈利
- 卖 UX(自然语言 chat-to-DeFi)= 伪需求 + 同质化烂大街,Web3 用户不来不是因为操作难
- **卖安全(本项目)= 真刚需**:跑链上 bot 的人全是裸私钥放服务器,资损是行业日常痛点;Safe 多签又慢又不 agentic。"agent 自主执行 + 硬安全边界"这个中间态市面是空的,而 CAW 正好是它。

**CAW 关键性 == 商业价值**:整个产品就是 CAW 的 Pact/policy/MPC,拿掉就不存在 → Cobo 评分"不可替换"直接拉满。

## 商业化

- **对标 Fireblocks(机构托管,估值 ~80 亿美金)/ Gnosis Safe** —— 卖安全/托管,模式已验证。不是 LI.FI(那是卖路由)。
- **受众**:散户跑套利/再平衡/跟单 bot、量化小队、DAO 金库、agent 开发者
- **付费**:按托管资产规模 / 订阅 / 按防护额度
- **差异化**:市面缺"agent 自主执行 + 硬安全边界"的中间态;CAW 填这个空

## 技术栈(已定)

- **全 TypeScript**,Node.js 22。理由:避开系统 Python 3.10 < CAW SDK 要求 3.11;前后端同语言。
- CAW 接入:`@cobo/agentic-wallet`(TS SDK)+ `caw` CLI
- 后端:Node + TS,Strategy Agent(LLM 决策 + 市场监控)+ CAW 执行层 + WebSocket
- 前端:Next.js 安全面板(双栏"裸私钥 vs CAW 托管"对比 + 拦截红框 + 审计回放)
- testnet:Sepolia / Base Sepolia,链 ID `SETH`

## 系统组件

| 组件 | 职责 | CAW 角色 |
|---|---|---|
| **Strategy Agent** | 理解自然语言策略 → 监控触发条件 → 自主决定操作(agentic depth) | — (LLM) |
| **Pact 编译层** | 把策略边界编译成 CAW pact policy(单笔上限/日累计/白名单/超界停) | Drafting |
| **Executor** | agent 每笔操作走 CAW:合规→执行真实 tx,超界→拦截 | Execution |
| **Auditor / 安全面板** | 审计回放 + "拦了哪些"安全证明 + 一键冻结 | Observer |

## 评分目标(Cobo 5 标准)

| 标准 | 命中路径 |
|---|---|
| 场景贴合度 | 真刚需(防资损)+ 受众明确,不卖虚 alpha/伪 UX |
| **CAW 关键性** | 整个产品 = Pact/policy/MPC,不可替换 |
| 资金流程完整度 | 策略→编译 pact→agent 自主执行→CAW 校验→审计全闭环 |
| 可演示性 | money shot(见下) |
| 风险边界 | CAW policy `deny_if` 拦截 + MPC 审批 + 一键冻结 = 产品核心本身 |

**money shot(30s)**:双栏对比 —— 左"裸私钥 bot"(理论能卷走全部),右"CAW 托管同一 agent"。agent 触发一笔超限操作 → **CAW policy 当场拦截弹红框** → "它跑不了"。配合真实链上 tx hash(合规操作)+ 拦截记录(403 结构化 denial)+ 一键冻结。

## 开干第一步

1. 读 `docs/01-caw-onboarding.md`,跑通 CAW CLI 拿凭证 + testnet 币(**H0-4 决策门**)
2. 读 `docs/02-architecture-and-build-plan.md` 架构 + 时间分配 + 风险退路
3. 读 `docs/03-caw-sdk-cheatsheet.md` 真实 SDK API(别凭印象编 API)
4. CAW 原始官方文档存档在 `docs/caw-reference/`

## 工作约定

- demo 优先:速度 + 视觉效果 > 工程完备性
- 真实 testnet 执行,**不要 mock 掉 CAW** —— "CAW 关键性"是评分核心 + 商业价值本身;合规操作要有真实 tx hash,拦截要有真实 403 denial
- 凭证进 `.env`,永不提交(见 `.gitignore`)
- **H4 决策门**:CAW testnet 跑不通 → fallback 见 `docs/00-direction.md`
- 代码起来后本目录跑 `codegraph init -i`
