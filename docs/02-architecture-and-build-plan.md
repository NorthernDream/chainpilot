# 架构 + 开发计划

## 用户流程(设策略 → 编译边界 → 自主执行 → 安全证明)

```
用户设策略(自然语言或表单)
  "ETH 涨 5% 就卖 10%,单笔 ≤ 0.5 ETH,日累计 ≤ 2 ETH,只在 Base"
        │
        ▼
  ① Pact 编译层      策略边界 → CAW pact policy
        │            (per-tx cap / rolling budget / chain+token 白名单 / 超界停)
        ▼
  ② Strategy Agent   监控市场/条件 → 条件触发时自主决定操作 ← agentic depth
        │            (LLM + 价格/行情数据)
        ▼
  ③ Executor (CAW)   每笔走 CAW:
        │            · 合规 → 链上执行,真实 tx hash
        │            · 超界 → policy deny_if 拦截 + 红框(+可选 MPC 审批)
        ▼
  ④ 安全面板 / Auditor   执行记录 + 拦截记录 + 预算用量 + 一键冻结
        │
        ▼
  仪表盘实时展示(WebSocket 推每步事件)
```

核心叙事:**agent 一直在自主跑,但跑在 CAW 画死的边界里。** 安全不是事后审计,是执行前每一笔的硬约束。

## 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│  Next.js 安全面板(前端)                                        │
│  · 策略设定输入        · 双栏对比:裸私钥 bot vs CAW 托管        │
│  · 实时执行流          · 超界拦截红框(403 denial)             │
│  · 预算用量条(日累计/总额)  · 审计回放 + 一键冻结              │
│  ▲ WebSocket 实时事件                                           │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────┴──────────────────────────────────┐
│  Orchestrator (Node + TS)                                      │
│   Pact 编译 → Strategy Agent 监控loop → Executor → 安全面板事件 │
└───────────────────────────┬──────────────────────────────────┘
                            │ @cobo/agentic-wallet SDK
┌───────────────────────────┴──────────────────────────────────┐
│  Cobo Agentic Wallet (Sepolia / Base Sepolia testnet)         │
│  Pact 授权 · policy deny_if(单笔/日累计/白名单)· MPC · audit  │
└──────────────────────────────────────────────────────────────┘
```

## 目录结构(建议,新对话搭)

```
chainpilot/
├── package.json
├── .env                      # 凭证,不提交
├── src/
│   ├── caw/
│   │   ├── client.ts         # 封装 @cobo/agentic-wallet
│   │   ├── pacts.ts          # 策略边界 → pact policy 编译(核心)
│   │   └── types.ts
│   ├── strategy/
│   │   ├── agent.ts          # Strategy Agent:监控 + 自主决策(LLM)
│   │   ├── parse.ts          # 自然语言策略 → 结构化规则 + 边界
│   │   └── triggers.ts       # 条件监控(价格/时间/持仓)
│   ├── market/
│   │   └── prices.ts         # 价格/行情数据源(触发判断用)
│   ├── executor.ts           # agent 操作 → CAW 执行 / 拦截
│   ├── orchestrator.ts       # 主 loop + 事件总线
│   ├── server.ts             # HTTP + WebSocket
│   └── events.ts             # 事件类型(前后端共享)
├── web/                      # Next.js 安全面板 + 双栏对比
└── scripts/
    └── hello-world.ts        # CAW 连通性自检(docs/03)
```

## 事件流(前端动画靠这些)

```
strategy.set          { text, rules, bounds }
pact.compiled         { pactId, policies }                     ← 边界编译
pact.activated        { pactId }
trigger.fired         { condition, marketValue }               ← agent 自主触发
action.decided        { agent, action, amount, token, chain }  ← agent 决策
tx.allowed            { txId, hash, amount }                   ← 真实链上证据(合规)
tx.denied             { code, reason, threshold, attempted }   ← 红框(超界)
approval.escalated    { amount }                               ← MPC 审批
budget.updated        { dailyUsed, dailyCap, totalUsed }       ← 预算条
freeze.triggered      { by:'user' }                            ← 一键冻结
audit.replay          { entries }
```

## 时间分配(从零,空壳,48-60h)

| 阶段 | 时长 | 产出 | 决策门 |
|---|---|---|---|
| 0. CAW 接入 | 4h | onboard + faucet + hello-world 跑通 | **H4:跑不通切 Z.AI** |
| 1. caw/client + pact 编译 | 7h | client 封装 + 策略边界→policy 编译,连通自检过 | |
| 2. Strategy Agent | 10h | 1 个杀手策略(止盈止损 或 再平衡):监控+自主决策 | |
| 3. Executor + 拦截 | 8h | 合规执行真实 tx + 超界 policy 拦截(403 denial) | |
| 4. 安全面板前端 | 14h | 双栏对比 + 实时执行流 + 拦截红框 + 预算条 + 一键冻结(money shot) | money shot 必须稳 |
| 5. 审计回放 | 3h | audit logs 回放 + 拦截记录 | |
| 6. demo + README | 6h | 3-5min 录屏 + README + tx hash 证据 | |
| buffer | 4h | 必爆 | |

> 杀手策略选 1 个就够(推荐**止盈止损**:触发直观、demo 好演、超界拦截自然)。别铺多策略。

## 关键风险点 + 退路

1. **真实市场触发难录制**:等 ETH 真涨 5% 不现实。
   → **退路**:策略阈值设成贴近当前价(或用可控的 mock 价格 feed 注入一个触发),agent 决策逻辑真实,触发信号 demo 时手动/脚本注入。重点是"触发后 agent 自主走 CAW"这段真实。

2. **超界拦截是 demo 核心,必须稳**:
   → 这块用 CAW policy `deny_if` 硬实现(不是前端假装)。一笔合规 tx(真 hash)+ 一笔超界(真 403 denial),两条都要真。参考 `docs/03` hello-world。

3. **MPC 审批演示**:需 pair App。
   → **退路**:来不及配对就用 policy 硬拦截展示边界(http 403 + 结构化 denial),叙事仍完整。MPC 审批作为"还能升级人审"的口述加分。

4. **双栏"裸私钥 bot"对比**:左栏不用真跑危险代码。
   → 左栏是叙事可视化(标注"私钥在服务器,理论可被卷走全部"),右栏是真实 CAW 托管执行。对比靠 UI 讲清楚,不需真的写个会跑路的 bot。

5. **LLM 决策跑偏**:Strategy Agent 不稳。
   → demo 录制固定 1 个策略的 happy path,agent 决策作底层,录制走可控触发。

## 提交物料(Cobo 要求对照)

- GitHub Repo + README(背景/架构/运行/CAW 用法)
- 3-5min demo 视频(走 money shot:策略→编译 pact→agent 触发→合规执行→超界拦截红框→一键冻结)
- 使用 CAW 的关键代码说明 → 指向 `src/caw/pacts.ts`(边界编译)+ `src/executor.ts`
- 链上证据:testnet 地址 + tx hash(合规)+ 403 denial 记录(拦截)+ Agent Wallet 地址 + 流程截图
