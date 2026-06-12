/**
 * 事件类型 —— 前后端共享的执行流契约。
 * Orchestrator 产出这些事件,经 WebSocket 推给安全面板做实时动画(双栏对比 / 红框 / 预算条)。
 * 字段对应 docs/02-architecture-and-build-plan.md 的"事件流"。
 */

/** 实时市场价格 tick —— agent 自主盯盘的输入,前端画 sparkline。 */
export interface MarketTickEvent {
  type: 'market.tick';
  price: number;
  tpLine: number; // 止盈线(前端标注穿越)
}

/** 用户设的策略(自然语言 + 解析后的结构化规则 + 边界)。 */
export interface StrategySetEvent {
  type: 'strategy.set';
  text: string;
  rules: Record<string, unknown>;
  bounds: Record<string, unknown>;
}

/** 边界编译成 pact policy。 */
export interface PactCompiledEvent {
  type: 'pact.compiled';
  pactId: string;
  policies: unknown[];
}

export interface PactActivatedEvent {
  type: 'pact.activated';
  pactId: string;
}

/** agent 自主触发(市场条件命中)。 */
export interface TriggerFiredEvent {
  type: 'trigger.fired';
  condition: string;
  marketValue: string;
}

/** agent 决策出一笔操作。 */
export interface ActionDecidedEvent {
  type: 'action.decided';
  agent: string;
  action: string;
  amount: string;
  token: string;
  chain: string;
}

/** 合规执行 —— 真实链上证据。hash 初始可能为 null(链上 pending),随后 tx.hash 补发。 */
export interface TxAllowedEvent {
  type: 'tx.allowed';
  txId: string;
  hash: string | null;
  amount: string;
}

/** 真实链上 hash 补发(异步轮询拿到后)。 */
export interface TxHashEvent {
  type: 'tx.hash';
  txId: string;
  hash: string;
}

/** 超界拦截 —— money shot 红框(CAW 403 结构化 denial)。 */
export interface TxDeniedEvent {
  type: 'tx.denied';
  code: string;
  reason: string;
  threshold: string;
  attempted: string;
}

/** 超阈值升级 MPC 审批。 */
export interface ApprovalEscalatedEvent {
  type: 'approval.escalated';
  amount: string;
}

/** 预算用量条(日累计 / 总额)。 */
export interface BudgetUpdatedEvent {
  type: 'budget.updated';
  dailyUsed: string;
  dailyCap: string;
  totalUsed: string;
}

/** 一键冻结。 */
export interface FreezeTriggeredEvent {
  type: 'freeze.triggered';
  by: 'user';
}

/** 审计回放。 */
export interface AuditReplayEvent {
  type: 'audit.replay';
  entries: unknown[];
}

export type ChainPilotEvent =
  | MarketTickEvent
  | StrategySetEvent
  | PactCompiledEvent
  | PactActivatedEvent
  | TriggerFiredEvent
  | ActionDecidedEvent
  | TxAllowedEvent
  | TxHashEvent
  | TxDeniedEvent
  | ApprovalEscalatedEvent
  | BudgetUpdatedEvent
  | FreezeTriggeredEvent
  | AuditReplayEvent;

export type ChainPilotEventType = ChainPilotEvent['type'];
