/** 链上数据格式化 §4:hash/地址中段省略,金额 mono。 */

/** 0x1f7a…3e9b 中段省略。 */
export function shortHash(value: string | null | undefined, head = 6, tail = 4): string {
  if (!value) return '—';
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

const SEPOLIA_TX = 'https://sepolia.etherscan.io/tx/';

export function etherscanTx(hash: string): string {
  return SEPOLIA_TX + hash;
}

export function pct(used: number, cap: number): number {
  if (!cap || cap <= 0) return 0;
  return Math.min(100, Math.round((used / cap) * 100));
}

/**
 * 显示层倍率 —— 页面展示金额 = 真实执行金额 × DISPLAY_SCALE。
 * 真实 CAW 在 testnet 跑小额(0.001/0.005),页面显示放大成体面整数(1/5),两层解耦。
 */
export const DISPLAY_SCALE = 1000;

/** 真实金额 → 页面显示金额(整数优先)。 */
export function dispAmt(real: string | number): string {
  const n = Math.round(Number(real) * DISPLAY_SCALE * 1000) / 1000;
  return String(n);
}

/** 把 CAW 原始拒绝码翻成人话(给 UI 看,不直接灌原始常量)。 */
export function denialLabel(code?: string): string {
  switch (code) {
    case 'DAILY_VALUE_LIMIT_EXCEEDED':
      return '当日预算已用尽';
    case 'TRANSFER_LIMIT_EXCEEDED':
      return '超过单笔上限';
    default:
      return '超出策略边界';
  }
}

export function clockTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
