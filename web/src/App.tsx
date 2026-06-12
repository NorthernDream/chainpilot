import { useEffect, useMemo, useState } from 'react';
import { api, type StrategyInput } from './lib/api';
import { useEventStream } from './lib/useEventStream';
import { deriveSnapshot } from './lib/selectors';
import { demoStream } from './lib/demoStream';
import { BgScene } from './components/BgScene';
import { FreezeButton } from './components/FreezeButton';
import { Vault } from './components/cockpit/Vault';
import { Boundaries } from './components/cockpit/Boundaries';
import { Delegate } from './components/cockpit/Delegate';
import { Market } from './components/cockpit/Market';
import { Verdicts } from './components/cockpit/Verdicts';
import { Evidence } from './components/cockpit/Evidence';
import { DenialMoment } from './components/cockpit/DenialMoment';
import './app.css';
import './components/cockpit/cockpit.css';

const PROTECTED_BALANCE = '1000';

export default function App() {
  const { events, connected } = useEventStream();
  const real = useMemo(() => deriveSnapshot(events), [events]);
  const demo = useMemo(() => deriveSnapshot(demoStream()), []);

  const hasReal =
    real.priceHistory.length > 0 || real.verdicts.length > 0 || real.pactActive || real.frozen;
  const snapshot = hasReal ? real : demo;
  const isDemo = !hasReal;

  const [busy, setBusy] = useState(false);
  const [dismissedDenial, setDismissedDenial] = useState<string | null>(null);

  // 仅真实拦截弹高光横幅
  const realDenialKey = real.lastDenial
    ? `${real.lastDenial.code}-${real.lastDenial.attempted}-${real.denied.length}`
    : null;
  useEffect(() => {
    if (!realDenialKey) return;
    setDismissedDenial(null);
    const id = setTimeout(() => setDismissedDenial(realDenialKey), 7000); // 自动消失,不长驻
    return () => clearTimeout(id);
  }, [realDenialKey]);

  const guard = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 无后端(如 Vercel 静态部署)时的友好提示
      if (!connected || /fetch|network|Failed/i.test(msg)) {
        alert('当前为演示模式(未连后端)。真实 CAW 执行需在本地运行后端:见 README「运行」一节。');
      } else {
        alert(`操作失败:${msg}`);
      }
    }
  };

  const onDelegate = (s: StrategyInput) =>
    guard(async () => {
      setBusy(true);
      try {
        await api.setStrategy(s);
        await api.startMarket(700);
      } finally {
        setBusy(false);
      }
    });

  const onFreeze = () => guard(() => api.freeze());

  const showDenial = hasReal && real.lastDenial && realDenialKey !== dismissedDenial;

  return (
    <>
      <BgScene />
      <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo">
            Chain<span className="app__logo-accent">Pilot</span>
          </span>
          <span className="app__tagline">链上自动化的安全执行层 · 保险箱 #1 · Sepolia</span>
        </div>

        <div className="app__guard">
          <span className="app__guard-pill">
            <span className="app__guard-dot" /> CAW MPC 守护
          </span>
        </div>

        <div className="app__right">
          <FreezeButton onConfirm={onFreeze} frozen={snapshot.frozen} disabled={!real.pactActive || snapshot.frozen} />
          <span className="app__conn">
            <span className={`app__conn-dot${connected ? ' is-on' : ''}`} />
            <span className="app__conn-txt mono">{connected ? 'CAW 已连接' : '演示模式'}</span>
          </span>
        </div>
      </header>

      <main className="ck">
        <aside className="ck__left">
          <Vault snapshot={snapshot} protectedBalance={PROTECTED_BALANCE} />
          <Boundaries snapshot={snapshot} />
          <Delegate
            onDelegate={onDelegate}
            onFreeze={onFreeze}
            busy={busy}
            active={real.pactActive}
            frozen={real.frozen}
          />
        </aside>

        <section className="ck__right">
          <Market snapshot={snapshot} />
          <Verdicts verdicts={snapshot.verdicts} />
        </section>
      </main>

      <footer className="ck__evidence">
        <Evidence snapshot={snapshot} isDemo={isDemo} />
      </footer>

      {showDenial && (
        <DenialMoment denial={real.lastDenial} dedupeKey={realDenialKey} onDismiss={() => setDismissedDenial(realDenialKey)} />
      )}

      {isDemo && <div className="app__demo-flag">示例数据 · 点「授权并启动 agent」跑真实 CAW</div>}
      </div>
    </>
  );
}
