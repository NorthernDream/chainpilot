/**
 * 镜像后端 src/events.ts 的 ChainPilotEvent 契约。
 * 后端改了这里要同步(demo 规模手动同步即可)。
 */
export interface MarketTickEvent {
  type: 'market.tick';
  price: number;
  tpLine: number;
}
export interface StrategySetEvent {
  type: 'strategy.set';
  text: string;
  rules: Record<string, unknown>;
  bounds: Record<string, unknown>;
}
export interface PactCompiledEvent {
  type: 'pact.compiled';
  pactId: string;
  policies: unknown[];
}
export interface PactActivatedEvent {
  type: 'pact.activated';
  pactId: string;
}
export interface TriggerFiredEvent {
  type: 'trigger.fired';
  condition: string;
  marketValue: string;
}
export interface ActionDecidedEvent {
  type: 'action.decided';
  agent: string;
  action: string;
  amount: string;
  token: string;
  chain: string;
}
export interface TxAllowedEvent {
  type: 'tx.allowed';
  txId: string;
  hash: string | null;
  amount: string;
}
export interface TxHashEvent {
  type: 'tx.hash';
  txId: string;
  hash: string;
}
export interface TxDeniedEvent {
  type: 'tx.denied';
  code: string;
  reason: string;
  threshold: string;
  attempted: string;
}
export interface ApprovalEscalatedEvent {
  type: 'approval.escalated';
  amount: string;
}
export interface BudgetUpdatedEvent {
  type: 'budget.updated';
  dailyUsed: string;
  dailyCap: string;
  totalUsed: string;
}
export interface FreezeTriggeredEvent {
  type: 'freeze.triggered';
  by: 'user';
}
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

/** 给每个事件一个稳定本地 id + 时间戳(渲染 key / 时间列)。 */
export interface StreamedEvent {
  seq: number;
  ts: number;
  event: ChainPilotEvent;
}
