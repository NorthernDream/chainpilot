import './bg-scene.css';

/**
 * 电影感背景 —— 对齐 codenest:墨黑 + 中央绿光晕 + 25/50/75 网格线。
 * 绿在这里以"冷光"存在,不铺进面板。固定满屏,半透明面板罩其上有depth。
 */
export function BgScene() {
  return (
    <div className="bgscene" aria-hidden="true">
      <svg className="bgscene__glow" width="1100" height="520" viewBox="0 0 1100 520" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="bg-glow-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="28" />
          </filter>
          <radialGradient id="bg-glow-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5ed29c" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#1f7a5a" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#070b0a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="550" cy="240" rx="480" ry="150" fill="url(#bg-glow-grad)" filter="url(#bg-glow-blur)" />
      </svg>
      <div className="bgscene__halo" />
      <div className="bgscene__grid">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
