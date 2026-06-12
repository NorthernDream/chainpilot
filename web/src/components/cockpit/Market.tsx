import { useMemo } from 'react';
import type { Snapshot } from '../../lib/selectors';
import './market.css';

interface MarketProps {
  snapshot: Snapshot;
}

/** 实时市场曲线 —— agent 自主盯盘的输入。价格穿越止盈线即触发(高亮)。 */
export function Market({ snapshot }: MarketProps) {
  const { priceHistory, price, tpLine, agentActive } = snapshot;

  const { path, area, tpY, lo, hi } = useMemo(() => {
    const W = 100;
    const H = 100;
    const pts = priceHistory.length ? priceHistory : [2000];
    const allVals = tpLine ? [...pts, tpLine] : pts;
    const min = Math.min(...allVals) * 0.999;
    const max = Math.max(...allVals) * 1.001;
    const span = max - min || 1;
    const x = (i: number) => (pts.length <= 1 ? 0 : (i / (pts.length - 1)) * W);
    const y = (v: number) => H - ((v - min) / span) * H;
    const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
    const a = `${d} L ${W} ${H} L 0 ${H} Z`;
    return { path: d, area: a, tpY: tpLine ? y(tpLine) : -10, lo: min, hi: max };
  }, [priceHistory, tpLine]);

  const above = price != null && tpLine != null && price >= tpLine;

  return (
    <section className="mk">
      <div className="mk__head">
        <span className="eyebrow">实时行情 · ETH / USD</span>
        <span className={`mk__live${agentActive ? ' is-live' : ''}`}>
          <span className="mk__live-dot" /> {agentActive ? '自主盯盘中' : '待启动'}
        </span>
      </div>

      <div className="mk__price-row">
        <span className={`mk__price mono${above ? ' is-above' : ''}`}>{price != null ? price.toFixed(2) : '—'}</span>
        {tpLine != null && <span className="mk__tp mono">止盈线 {tpLine.toFixed(0)}</span>}
      </div>

      <div className="mk__chart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mk__svg">
          <defs>
            <linearGradient id="mk-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(244,247,246,0.10)" />
              <stop offset="100%" stopColor="rgba(244,247,246,0)" />
            </linearGradient>
          </defs>
          {tpLine != null && (
            <line x1="0" y1={tpY} x2="100" y2={tpY} className="mk__tpline" strokeDasharray="2 2" />
          )}
          <path d={area} fill="url(#mk-fill)" />
          <path d={path} className="mk__line" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mk__axis mono">
        <span>{lo.toFixed(0)}</span>
        <span>{hi.toFixed(0)}</span>
      </div>
    </section>
  );
}
