/**
 * 触发判断 —— 给定当前价 + 止盈止损策略,判断是否触发,纯函数。
 * 确定性:同样输入永远同样输出,demo 可复现。
 */
import type { StopLossStrategy } from './parse.js';

export type TriggerKind = 'take_profit' | 'stop_loss';

export interface TriggerSignal {
  kind: TriggerKind;
  condition: string; // 人类可读条件(进 trigger.fired 事件)
  marketPrice: number;
  threshold: number;
}

/**
 * 评估触发:价 ≥ 入场×(1+止盈%) → 止盈;价 ≤ 入场×(1−止损%) → 止损;否则 null。
 * 同时命中只可能一边(止盈阈 > 入场 > 止损阈)。
 */
export function evaluateTrigger(
  strategy: StopLossStrategy,
  marketPrice: number,
): TriggerSignal | null {
  const tpThreshold = strategy.entryPrice * (1 + strategy.takeProfitPct);
  const slThreshold = strategy.entryPrice * (1 - strategy.stopLossPct);

  if (marketPrice >= tpThreshold) {
    return {
      kind: 'take_profit',
      condition: `${strategy.tokenId} 价 ${marketPrice} ≥ 止盈线 ${tpThreshold.toFixed(4)}(入场 ${strategy.entryPrice} +${strategy.takeProfitPct * 100}%)`,
      marketPrice,
      threshold: tpThreshold,
    };
  }
  if (marketPrice <= slThreshold) {
    return {
      kind: 'stop_loss',
      condition: `${strategy.tokenId} 价 ${marketPrice} ≤ 止损线 ${slThreshold.toFixed(4)}(入场 ${strategy.entryPrice} −${strategy.stopLossPct * 100}%)`,
      marketPrice,
      threshold: slThreshold,
    };
  }
  return null;
}
