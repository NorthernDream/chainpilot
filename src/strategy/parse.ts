/**
 * 策略解析 —— 结构化策略输入 → 校验后的策略 + 编译用 SafetyBounds。
 *
 * 杀手策略:止盈止损(take-profit / stop-loss)。
 * 不接真 LLM:策略来自结构化输入(前端表单);触发与决策逻辑确定性、可控、可复现。
 * (附一个 demo 级 NL 解析,仅识别 docs/02 示例那类固定句式。)
 */
import type { SafetyBounds } from '../caw/types.js';

/** 前端/调用方传入的原始策略(止盈止损)。 */
export interface StopLossStrategyInput {
  chainId: string; // e.g. 'SETH'
  tokenId: string; // e.g. 'SETH'
  entryPrice: number; // 参考入场价(报价币)
  takeProfitPct: number; // 涨幅触发止盈,0.05 = +5%
  stopLossPct: number; // 跌幅触发止损,0.03 = -3%
  positionSize: string; // 持仓量(token 计)
  sellFraction: number; // 触发时卖出比例,0.1 = 10%
  perTxCap: string; // 硬边界:单笔上限
  dailyCap?: string; // 硬边界:滚动 24h 累计上限
  dailyTxCountCap?: number; // 硬边界:滚动 24h 笔数上限
}

/** 校验后的策略 + 派生出的硬边界(编译进 pact)。 */
export interface StopLossStrategy extends StopLossStrategyInput {
  bounds: SafetyBounds;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`策略校验失败:${msg}`);
}

/**
 * 校验结构化策略并派生 SafetyBounds。
 * 边界来自用户显式设的 perTxCap/dailyCap —— 这是 ChainPilot 的核心:用户画死的边界。
 */
export function parseStrategy(input: StopLossStrategyInput): StopLossStrategy {
  assert(input.chainId, 'chainId 必填');
  assert(input.tokenId, 'tokenId 必填');
  assert(input.entryPrice > 0, 'entryPrice 必须 > 0');
  assert(input.takeProfitPct > 0, 'takeProfitPct 必须 > 0');
  assert(input.stopLossPct > 0, 'stopLossPct 必须 > 0');
  assert(Number(input.positionSize) > 0, 'positionSize 必须 > 0');
  assert(input.sellFraction > 0 && input.sellFraction <= 1, 'sellFraction 须在 (0,1]');
  assert(Number(input.perTxCap) > 0, 'perTxCap 必须 > 0');

  const bounds: SafetyBounds = {
    chainId: input.chainId,
    tokenId: input.tokenId,
    perTxCap: input.perTxCap,
    ...(input.dailyCap ? { dailyCap: input.dailyCap } : {}),
    ...(input.dailyTxCountCap !== undefined ? { dailyTxCountCap: input.dailyTxCountCap } : {}),
  };

  return { ...input, bounds };
}

/**
 * demo 级 NL 解析:从固定句式抽数字,不通用。
 * 例:"ETH 涨 5% 就卖 10%,跌 3% 止损,单笔 ≤ 0.5,日累计 ≤ 2"
 * 解析不到的字段必须由调用方补齐(entryPrice/positionSize)。
 */
export function parseNaturalLanguage(
  text: string,
  base: Pick<StopLossStrategyInput, 'chainId' | 'tokenId' | 'entryPrice' | 'positionSize'>,
): StopLossStrategy {
  const pct = (re: RegExp): number | undefined => {
    const m = text.match(re);
    return m ? Number(m[1]) / 100 : undefined;
  };
  const num = (re: RegExp): string | undefined => text.match(re)?.[1];

  const takeProfitPct = pct(/涨\s*(\d+(?:\.\d+)?)\s*%/) ?? 0.05;
  const sellFraction = pct(/卖\s*(\d+(?:\.\d+)?)\s*%/) ?? 0.1;
  const stopLossPct = pct(/跌\s*(\d+(?:\.\d+)?)\s*%/) ?? 0.03;
  const perTxCap = num(/单笔\s*[≤<=]+\s*(\d+(?:\.\d+)?)/) ?? '0.002';
  const dailyCap = num(/日累计\s*[≤<=]+\s*(\d+(?:\.\d+)?)/);

  return parseStrategy({
    ...base,
    takeProfitPct,
    stopLossPct,
    sellFraction,
    perTxCap,
    ...(dailyCap ? { dailyCap } : {}),
  });
}
