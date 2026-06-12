# 方向决策:为什么做 ChainPilot(安全执行层)

> 调研来源:deep-research workflow(103 agents,21 源,19 确认 / 6 证伪),2026-06-11。
> 原始完整调研 + 三次方向迭代记录留在 scratch:`/root/code/experiments/scratch/docs/2026-06-11-agentic-builders-hackathon-direction.md`

## 决策结论

**Cobo Track · 链上自动化的安全执行层(ChainPilot)。**
"给你的交易策略 / agent 一个不会跑路的保险箱。" CAW 的 Pact/policy/MPC == 产品本身 == 商业价值。
不做 x402 单笔支付,不做自运转对冲基金,不做自然语言 chat-to-DeFi 平台,不选 Z.AI 赛道。

## 三次方向迭代(为什么最终是"安全",不是另两个)

两个备选方向各有一个**根因级**致命伤,且根因相同:**都把卖点押错了东西。**

| 方向 | 真资产 | 卖点 | 致命伤(根因) |
|---|---|---|---|
| 自运转对冲基金 | CAW 贴合极深、差异化好、demo 视觉强 | **卖 alpha**(AI 帮你赚钱) | 不可信。48h 证明不了盈利;理性的人不会信"让 AI 拿真钱炒币赚钱" |
| 自然语言多链平台 | 商业故事好讲、受众广 | **卖 UX**(操作更简单) | 伪需求 + 同质化。Web3 用户不来不是因为 swap/桥难(早傻瓜化了);"很多但没一个跑出来"正因为卖的是表层 UX |
| **安全执行层(最终)** | 继承对冲基金的 CAW 深度 + 差异化 | **卖安全**(敢把执行权委托出去) | —— 真刚需,见下 |

**关键洞察**:Web3 自动化里值钱的第三样东西是"安全地把执行权委托出去"。它既不是 alpha 也不是 UX,而正是 CAW 要解决的问题、也是 Cobo 赛道的核心。把对冲基金的资产(CAW 深度 + 差异化 + 风控 demo)保住,只把卖点从"赚钱"换成"安全",两个备选的致命伤同时消失。

## 为什么"安全"是真刚需(不是臆想)

- 现在跑链上 bot(套利 / 再平衡 / 跟单 / 定投 / 批量空投)的人,**几乎全是裸私钥放在服务器上** —— 被黑、被卷、脚本失控,资损是行业日常痛点。
- 想避险只能上 Gnosis Safe 多签 —— 但它慢、不 agentic,自动化策略用不了。
- **"agent 自主执行 + 硬安全边界"这个中间态,市面上是空的。CAW 的 Pact/policy/MPC 正好就是它。**

## 商业化(硬版)

- **对标 Fireblocks(机构托管,估值 ~80 亿美金)/ Gnosis Safe** —— 卖的就是安全/托管,被市场验证的大生意。不是 LI.FI(那是卖路由)。
- **付费模型**:按托管资产规模 / 订阅 / 按防护额度。受众:散户跑 bot、量化小队、DAO 金库、agent 开发者。
- **moat**:CAW 的 Pact/MPC 安全边界,别人 7 天搭不出来;"agent 自主 + 硬边界"中间态无人占。
- **CAW 关键性 == 商业价值**:安全本身就是产品,CAW 提供安全 → CAW 不可替换。商业化与评分同向。

**一句话 pitch**:
> "agent 帮你 24h 执行链上策略,但它亏不超过你设的边界、超界即停、私钥永远拿不到 —— 给你的自动化一个不会跑路的保险箱。"

> ⚠️ 校正:Cobo 评分表无"商业化"独立项(看场景贴合/CAW关键性/资金流程/可演示/风险边界)。商业化撑起"场景贴合度"+ 说服力,但 demo 能跑 + CAW 关键 + 安全对比惊艳才是拿奖直接抓手。

## 三个硬事实(调研结论,支撑选题)

### 1. x402 + 钱包 = 饱和死路
SF Agentic Commerce x402 + Consensus Miami EasyA(2026-05)头名几乎全是 x402+USDC on Base。Cobo 赛道继续做没差异化,预计一半选手撞这。来源:CoinDesk 2026-05-08、SKALE recap。

### 2. CAW 真护城河 = Pact + MPC + policy + role 分工
- **Pact**:四要素可执行协议(Intent/Execution Plan/Policies/Completion Conditions)。"A Pact Is Not a Permission. It's an Enforceable Agreement."
- **2/2 MPC 双组**:`Agent+Cobo` 自动执行,`Human+Cobo` 审批高额
- **三 preset role**:Drafting / Execution / Observer
- **深度 policy engine**:per-tx caps、rolling budgets(日累计)、chain allowlists、contract whitelists,`deny_if.amount_gt` 即安全边界原语 —— **本项目的核心就建在这上面**
- ⚠️ 评分用 Pact/MPC/policy 官方语言,别套 track 包装词

### 3. 评审品味:偏好"基础设施 / 持续运转的 agent 系统"
SF x402 头名 = AI agent 自主玩 MMORPG;二名 Legasi = agent 信用+收益基础设施层。本项目"agentic execution 的安全基础设施"正中这个审美。注:本场真实评审名单未公开,SF x402 品味迁移是合理推断。

## 差异化加分层(时间够再叠,不 all-in)

ERC-8183 Evaluator Hook(EF dAI + Virtuals 2026-02 的 Job 原语)做"委托执行的链上验收/争议"。黑客松几乎零采用。但工具薄(无 Foundry 模板/审计/indexer),先主线扎实,8183 当 bonus。spec:`eips.ethereum.org/EIPS/eip-8183`。

## H4 决策门 / Fallback

若 CAW testnet 跑不通(KYC/key/faucet 卡住 > 4h),切 **Z.AI 赛道方向 C**:GLM-5.1 长程合约审计/开发 agent(无外部链上依赖)。
⚠️ Z.AI 坑:GLM-5.1 benchmark 全自报,"8h 自主执行"宣传被调研 vote 1-2 证伪。仅作兜底,非首选。
