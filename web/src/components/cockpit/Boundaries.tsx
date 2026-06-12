import type { Snapshot } from '../../lib/selectors';
import { pct, dispAmt } from '../../lib/format';
import './boundaries.css';

interface BoundariesProps {
  snapshot: Snapshot;
}

/** CAW 实时执行 —— 只展示「正在被强制的状态」(日预算消耗 + 单笔硬顶),设置在 Delegate,不重复。 */
export function Boundaries({ snapshot }: BoundariesProps) {
  const perTxCap = (snapshot.bounds?.perTxCap as string) ?? '0.002';
  const dailyCap = Number(snapshot.bounds?.dailyCap ?? snapshot.budget.dailyCap) || 0;
  const dailyUsed = snapshot.budget.dailyUsed;
  const dailyPct = pct(dailyUsed, dailyCap);
  const level = dailyPct >= 100 ? 'deny' : dailyPct >= 80 ? 'warn' : 'pass';
  const levelText = dailyPct >= 100 ? '已用尽 · 后续交易被拒' : dailyPct >= 80 ? '逼近上限' : '边界内';

  return (
    <section className="bd">
      <div className="bd__head">
        <span className="eyebrow">CAW 实时执行 · LIVE ENFORCEMENT</span>
      </div>

      <div className="bd__budget">
        <div className="bd__budget-top">
          <span className="bd__budget-label">日累计预算 · rolling 24h</span>
          <span className={`bd__budget-pct mono bd__budget-pct--${level}`}>{dailyPct}%</span>
        </div>
        <div className="bd__track">
          <div className={`bd__fill bd__fill--${level}`} style={{ width: `${dailyPct}%` }} />
        </div>
        <div className="bd__budget-meta">
          <span className="mono">{dispAmt(dailyUsed)} / {dailyCap > 0 ? dispAmt(dailyCap) : '∞'} ETH</span>
          <span className={`bd__budget-state bd__budget-state--${level}`}>{levelText}</span>
        </div>
      </div>

      <div className="bd__single">
        <span className="bd__single-label">单笔硬顶</span>
        <span className="bd__single-val mono">≤ {dispAmt(perTxCap)} ETH</span>
        <span className="bd__single-note">每笔提交前过 policy</span>
      </div>

      <div className="bd__chips">
        <span className="bd__chip mono">链 ETH</span>
        <span className="bd__chip mono">币 ETH</span>
        <span className="bd__chip mono">目的地白名单</span>
      </div>
    </section>
  );
}
