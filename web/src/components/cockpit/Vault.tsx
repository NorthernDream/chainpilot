import type { Snapshot } from '../../lib/selectors';
import './vault.css';

interface VaultProps {
  snapshot: Snapshot;
  protectedBalance: string;
}

/** 金库主区 —— 产品的灵魂:被保护的资产 + 私钥∈MPC + 自主干活的 agent。 */
export function Vault({ snapshot, protectedBalance }: VaultProps) {
  const { agentActive, frozen, pactActive } = snapshot;
  const state = frozen ? 'frozen' : agentActive ? 'live' : pactActive ? 'idle' : 'unarmed';
  const stateText =
    state === 'frozen' ? '已冻结 · 执行权撤销' : state === 'live' ? '自主盯盘执行中' : state === 'idle' ? '已托管 · 待行情' : '待授权';

  return (
    <section className="vault">
      <div className="vault__top">
        <span className="eyebrow">保险箱 · VAULT #1</span>
        <span className="vault__mpc">
          <span className="vault__mpc-dot" /> 私钥 ∈ CAW MPC · 永不可导出
        </span>
      </div>

      <div className="vault__balance">
        <span className="vault__amount mono">{protectedBalance}</span>
        <span className="vault__unit">ETH</span>
      </div>
      <span className="vault__sub">受保护托管资产 · Sepolia testnet</span>

      <div className={`vault__agent vault__agent--${state}`}>
        <span className="vault__agent-pulse" />
        <div className="vault__agent-meta">
          <span className="vault__agent-name">STOP-LOSS AGENT</span>
          <span className="vault__agent-state mono">{stateText}</span>
        </div>
        <span className="vault__agent-badge">自主委托</span>
      </div>
    </section>
  );
}
