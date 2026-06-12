import type { Verdict } from '../../lib/selectors';
import { shortHash, etherscanTx, clockTime, denialLabel, dispAmt } from '../../lib/format';
import './verdicts.css';

interface VerdictsProps {
  verdicts: Verdict[];
}

/** CAW 裁决流 —— 每笔 agent 操作实时过 policy:合规放行(真 hash)/ 超界拦截(403)。 */
export function Verdicts({ verdicts }: VerdictsProps) {
  const rows = [...verdicts].reverse().slice(0, 12);
  return (
    <section className="vd">
      <div className="vd__head">
        <span className="eyebrow">CAW 裁决流 · POLICY VERDICTS</span>
        <span className="vd__count mono">
          <span className="vd__count-pass">{verdicts.filter((v) => v.kind === 'allowed').length} 放行</span>
          {' · '}
          <span className="vd__count-deny">{verdicts.filter((v) => v.kind === 'denied').length} 拦截</span>
        </span>
      </div>
      <div className="vd__body">
        {rows.length === 0 && <div className="vd__empty">授权后,agent 的每一笔都会在这里被 CAW 实时裁决</div>}
        {rows.map((v) => (
          <div key={v.seq} className={`vd__row vd__row--${v.kind}`}>
            <span className="vd__time mono">{clockTime(v.ts)}</span>
            {v.kind === 'allowed' ? (
              <>
                <span className="vd__tag vd__tag--pass">✓ 合规放行</span>
                <span className="vd__amt mono">卖出 {dispAmt(v.amount)} ETH</span>
                {v.hash ? (
                  <a className="vd__hash mono" href={etherscanTx(v.hash)} target="_blank" rel="noreferrer">
                    {shortHash(v.hash)} ↗
                  </a>
                ) : (
                  <span className="vd__hash mono vd__pending">确认中…</span>
                )}
              </>
            ) : (
              <>
                <span className="vd__tag vd__tag--deny">✕ 拒绝 · 403</span>
                <span className="vd__amt mono">尝试 {dispAmt(v.amount)} ETH</span>
                <span className="vd__reason">{denialLabel(v.code)}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
