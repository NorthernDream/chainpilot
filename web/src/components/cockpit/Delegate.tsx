import { useState } from 'react';
import type { StrategyInput } from '../../lib/api';
import './delegate.css';

interface DelegateProps {
  onDelegate: (s: StrategyInput) => void;
  onFreeze: () => void;
  busy: boolean;
  active: boolean;
  frozen: boolean;
}

// 显示值(整数);提交时 ÷DISPLAY_SCALE 转成真实执行小额(0.001/0.002/0.005)
const DISPLAY_SCALE = 1000;
const DEFAULTS = { sellPerTx: '1', perTxCap: '2', dailyCap: '5' };
const toReal = (v: string) => String(Number(v) / DISPLAY_SCALE);

/**
 * 授权 —— 用户只签「安全契约」(每笔卖出 + 两个硬上限),不碰交易内部参数。
 * 这是唯一的设置入口;Boundaries 只负责展示实时执行,不重复这些值。
 */
export function Delegate({ onDelegate, onFreeze, busy, active, frozen }: DelegateProps) {
  const [f, setF] = useState(DEFAULTS);
  const set = (k: keyof typeof DEFAULTS) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onDelegate({ sellPerTx: toReal(f.sellPerTx), perTxCap: toReal(f.perTxCap), dailyCap: toReal(f.dailyCap) });
  };

  const locked = active && !frozen;

  return (
    <form className="dg" onSubmit={submit}>
      <div className="dg__head">
        <span className="eyebrow">授权 · DELEGATE</span>
        {locked && <span className="dg__on mono">委托生效中</span>}
      </div>

      <Field label="每笔卖出" hint="agent 每次止盈卖出量">
        <input className="dg__in mono" value={f.sellPerTx} onChange={set('sellPerTx')} disabled={locked} />
      </Field>
      <div className="dg__grid">
        <Field label="单笔上限" hint="per-tx cap">
          <input className="dg__in dg__in--b mono" value={f.perTxCap} onChange={set('perTxCap')} disabled={locked} />
        </Field>
        <Field label="日累计上限" hint="24h cap">
          <input className="dg__in dg__in--b mono" value={f.dailyCap} onChange={set('dailyCap')} disabled={locked} />
        </Field>
      </div>

      {locked ? (
        <button type="button" className="dg__freeze" onClick={onFreeze}>
          ❚❚ 冻结后调整
        </button>
      ) : (
        <button type="submit" className="dg__go" disabled={busy}>
          {busy ? '编译 PACT…' : frozen ? '重新授权并启动' : '授权并启动 agent'}
        </button>
      )}
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="dg__field">
      <span className="dg__label">
        {label} <em className="dg__hint">{hint}</em>
      </span>
      {children}
    </label>
  );
}
