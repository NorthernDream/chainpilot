import type { TxDeniedEvent } from '../../lib/events';
import { dispAmt } from '../../lib/format';
import './denial-moment.css';

interface DenialMomentProps {
  denial: TxDeniedEvent | null;
  dedupeKey: string | null;
  onDismiss: () => void;
}

const LABEL: Record<string, string> = {
  DAILY_VALUE_LIMIT_EXCEEDED: '日累计预算已用尽',
  TRANSFER_LIMIT_EXCEEDED: '单笔超过上限',
};

/**
 * 拦截高光 —— 产品内真实事件。对照点是"边界的执行位置":bot 自写限额可被绕过,CAW 边界在 agent 够不到的 MPC 层。
 * key 绑 dedupeKey:每次新拦截重放脉冲。
 */
export function DenialMoment({ denial, dedupeKey, onDismiss }: DenialMomentProps) {
  if (!denial) return null;
  const why = LABEL[denial.code] ?? '超出策略边界';
  return (
    <div className="dmt" key={dedupeKey ?? 'd'} role="alert">
      <span className="dmt__siren">✕</span>
      <div className="dmt__body">
        <span className="dmt__title">CAW 当场拦截 · POLICY DENIED 403</span>
        <span className="dmt__reason mono">
          {why} · 当日上限 {dispAmt(denial.threshold)} ETH 已用满,这笔 {dispAmt(denial.attempted)} ETH 被拒
        </span>
      </div>
      <span className="dmt__contrast serif-em">限额写在 bot 自己代码里,被劫持/出 bug 就能绕过;CAW 这道在 agent 够不到的 MPC 层。</span>
      <button className="dmt__x" onClick={onDismiss} aria-label="dismiss">
        ✕
      </button>
    </div>
  );
}
