import type { Snapshot } from '../../lib/selectors';
import { shortHash, etherscanTx, denialLabel, dispAmt } from '../../lib/format';
import './evidence.css';

interface EvidenceProps {
  snapshot: Snapshot;
  isDemo: boolean;
}

/** 链上铁证 —— 真 etherscan hash(合规)+ 403 denial 记录。强调「真 testnet,非 mock」。 */
export function Evidence({ snapshot, isDemo }: EvidenceProps) {
  const allowed = snapshot.lastAllowed;
  const denial = snapshot.lastDenial;

  return (
    <section className="ev">
      <div className="ev__lead">
        <span className="eyebrow">链上铁证 · ON-CHAIN PROOF</span>
        <span className="ev__real">{isDemo ? '示例数据' : '真实 Sepolia · 非 mock'}</span>
      </div>

      <div className="ev__cards">
        <div className="ev__card ev__card--pass">
          <span className="ev__label">合规放行 · 真实交易</span>
          {allowed?.hash ? (
            <a className="ev__val mono" href={etherscanTx(allowed.hash)} target="_blank" rel="noreferrer">
              {shortHash(allowed.hash)} ↗
            </a>
          ) : (
            <span className="ev__val mono">{allowed ? '确认中…' : '—'}</span>
          )}
          <span className="ev__sub mono">{allowed ? `${dispAmt(allowed.amount)} ETH · etherscan 可查` : '等待合规交易'}</span>
        </div>

        <div className="ev__card ev__card--deny">
          <span className="ev__label">超界拦截 · 403 denial</span>
          <span className="ev__val">{denial ? denialLabel(denial.code) : '—'}</span>
          <span className="ev__sub mono">{denial ? `这笔 ${dispAmt(denial.attempted)} ETH · CAW policy 摁停` : '等待越界尝试'}</span>
        </div>

        <div className="ev__card ev__card--freeze">
          <span className="ev__label">托管状态</span>
          <span className="ev__val">{snapshot.frozen ? '已冻结' : snapshot.pactActive || isDemo ? '守护中' : '闲置'}</span>
          <span className="ev__sub mono">{snapshot.frozen ? '执行权已撤销' : '私钥 ∈ MPC · 你握 kill switch'}</span>
        </div>
      </div>
    </section>
  );
}
