# DESIGN.md — ChainPilot

> 链上自动化的安全执行层。视觉 DNA 继承自 open-design 的 `codenest-coding-platform` example
> (暗色电影感 / 墨黑底 / 单一绿强调 / 液态玻璃 + 光晕),迁移到「机构级安全托管面板」语境。
>
> **用法**:把本文件放 ChainPilot 仓库根,prompt 里说 "reference DESIGN.md when building any UI"。
> **来源 prompt**:`github.com/nexu-io/open-design/.../examples/codenest-coding-platform/SKILL.md`。
>
> 标注约定:`[LOCKED]` = 从 codenest 继承的锁定值,不要改;`[EXT]` = 为 ChainPilot dashboard 扩展的值。

## 1. 美学意图

高端暗色、电影感、机构级可信。像 Fireblocks / 一个交易所的安全后台,不像 SaaS 模板。
冷静的墨黑底 + 克制的单绿强调,只有"安全状态"用语义色说话:**合规=绿,拦截=红,告警=琥珀,冻结=冰蓝**。
绿是"放行/可信"的语义锚,不是装饰——不要整屏铺绿。

## 2. 表面分级(三档,视觉强度递减/递增)

| 表面 | 用途 | codenest DNA 用量 |
|---|---|---|
| **Cover / Landing** | 项目首屏、demo 封面 | 全量:HLS/视频背景或静态电影感大图 + 中央光晕 + 液态玻璃卡 + 大写 hero |
| **Dashboard** | 安全面板主体(执行流/预算/拦截记录) | 收敛:沉静暗底 + 局部弱光晕(仅 header),数据优先,玻璃只用于浮层 |
| **Money shot** | demo 视频核心双栏对抗 | 戏剧化:红绿对抗 + 拦截红 glow 脉冲 |

## 3. Palette

继承锁定 + dashboard 语义扩展。直接粘 `:root`:

```css
:root {
  /* —— base 继承 [LOCKED] —— */
  --bg:            #070b0a;   /* 墨黑底,带极微墨绿 */
  --accent:        #5ed29c;   /* 合规绿 / 放行 / 品牌主色(语义=可信) */
  --accent-deep:   #1f7a5a;   /* 深绿,仅用于光晕渐变,不做实体填充 */
  --text:          #f4f7f6;   /* 主文本(codenest 用纯白,这里微暖白降刺眼) */
  --text-muted:    rgba(255,255,255,0.70);  /* 次文本 [LOCKED 比例] */
  --text-faint:    rgba(255,255,255,0.45);  /* 标签/占位 */
  --hairline:      rgba(255,255,255,0.10);  /* 分隔线/网格线 [LOCKED] */

  /* —— dashboard surface 分层 [EXT] —— */
  --surface-1:     #0c1211;   /* panel 底 */
  --surface-2:     #121a18;   /* raised card */
  --surface-3:     #18211f;   /* hover / 选中行 */
  --border:        rgba(255,255,255,0.08);

  /* —— 安全语义色 [EXT] —— */
  --pass:          #5ed29c;   /* 合规执行成功 = 复用品牌绿 */
  --pass-bg:       rgba(94,210,156,0.12);
  --deny:          #ff5c5c;   /* 超界拦截 / 403 denial(最高优先级,最醒目) */
  --deny-bg:       rgba(255,92,92,0.14);
  --warn:          #f5c14e;   /* 预算用量逼近上限 */
  --warn-bg:       rgba(245,193,78,0.12);
  --freeze:        #6db5ff;   /* 一键冻结 / 暂停态(冰蓝,区别于"拒绝"红) */
  --freeze-bg:     rgba(109,181,255,0.12);
}
```

**硬规则**:`--deny` 红只给拦截/失败,`--pass` 绿只给合规放行——两者绝不混用或弱化。状态色永远 > 品牌色优先级。

## 4. Typography

继承 codenest 三件套 [LOCKED] + 为链上数据加等宽 [EXT]:

```css
--font-ui:      'Inter', -apple-system, system-ui, sans-serif;        /* 正文/UI/数据,400–800 */
--font-label:   'Plus Jakarta Sans', sans-serif;                      /* eyebrow/标签,大写,600–800 */
--font-serif:   'Instrument Serif', Georgia, serif;                   /* italic,仅大标题里的强调词 */
--font-mono:    'JetBrains Mono', ui-monospace, 'SF Mono', monospace; /* [EXT] tx hash/地址/金额必用 */
```

Google Fonts 一行(加 JetBrains Mono):
```
Inter:wght@400;500;600;700;800 · Plus+Jakarta+Sans:wght@600;700;800 · Instrument+Serif:ital@0;1 · JetBrains+Mono:wght@400;500;700
```

排版规则:
- **大标题**:Inter ExtraBold(800)、大写、`letter-spacing:-0.03em`、`line-height:0.98`、`clamp(40px,8vw,72px)` [LOCKED]。句末句点用绿 `.dot` [LOCKED 手法]。
- **eyebrow/section label**:Plus Jakarta Sans、11px、大写、`letter-spacing:0.16em`、色 `--accent` [LOCKED]。
- **强调词**:仅大标题里个别词用 `--font-serif` italic(如 money shot 标题的 *"can't"*) [LOCKED 手法]。
- **链上数据**:tx hash / 钱包地址 / 金额 / 预算数字一律 `--font-mono` + `tabular-nums`,hash/地址中段省略 `0x1f7a…3e9b` [EXT]。

## 5. 形状 / 间距 / 层级 / 氛围

```css
--radius-card: 14px;  --radius-btn: 10px;  --radius-pill: 999px;  --radius-input: 10px;
/* 间距节奏 4/8/12/16/24/40/64,别全用一个 padding */
```
- **深度靠分层**:`surface-2` 浮在 `surface-1` 上 + 一条 `inset 0 1px 0 rgba(255,255,255,0.06)` 高光,**不靠到处描边**(codenest 手法)。
- **中央光晕** [LOCKED 手法]:SVG `radialGradient` `#5ed29c→#1f7a5a→transparent` + `feGaussianBlur stdDeviation="25"`。Cover 满血;Dashboard 仅 header 顶部弱化版(opacity≤0.25)。
- **液态玻璃浮层** [LOCKED]:`background:rgba(255,255,255,0.01)` + `backdrop-filter:blur(4px)` + `::before` 用 `mask-composite:exclude` 画 1.4px 渐变边框。**仅用于模态/抽屉/冻结确认框**,不要铺满 dashboard。
- **桌面网格线** [LOCKED]:25%/50%/75% 三条 1px `--hairline` 竖线,`min-width:900px` 才显示;Cover 用,Dashboard 可省。

## 6. 组件规范 [EXT,dashboard 专属]

- **主按钮(放行/确认)**:`--radius-pill`、底 `--accent`、字 `--bg`、大写 bold;hover `translateY(-2px)` + 绿 glow [LOCKED 手法]。
- **危险按钮(一键冻结)**:`--radius-btn`、`--freeze` 描边 + `--freeze-bg` 底、字 `--freeze`;点击走二次确认(液态玻璃模态)。
- **状态徽章 pill**:`--radius-pill`、`{pass|deny|warn|freeze}-bg` 底 + 同名前景字 + 11px 大写 label 字体。`✓ COMPLIANT` / `✕ DENIED 403` / `⚠ BUDGET 82%` / `❚❚ FROZEN`。
- **执行流时间线**:左侧竖 `--hairline` 轴,每个事件一行:时间(mono)· 动作 · 状态徽章 · tx hash 或 denial reason。合规行左缘 2px `--pass`,拦截行左缘 2px `--deny` + `--deny-bg` 整行底。
- **拦截弹框(money shot 核心)**:`--deny` 1.5px 边 + `--deny-bg` 底 + 红 glow(`box-shadow:0 0 40px rgba(255,92,92,0.35)`)+ 大写 `POLICY DENIED · 403` + 一行人读原因(如 "exceeds per-tx cap 0.5 ETH")。入场带一次脉冲。
- **预算用量条**:轨 `--surface-3`,填充 `--accent`;≥80% 转 `--warn`,=100% 转 `--deny`。数字 mono。
- **数据表/记录**:行 hover `--surface-3`,无斑马纹;数值右对齐 mono `tabular-nums`;表头 `--text-faint` 大写小字。

## 7. Money shot — 双栏对抗规范

demo 视频的命门,单独锁视觉语言:
- **布局**:严格左右双栏等宽,中缝一条 `--hairline` + 中央"同一个 agent"标识。
- **左栏「裸私钥 bot」**:去品牌色,走中性冷灰(`--surface-1` 底 + `--text-muted`),给"暴露/不可信"感;agent 触发超界操作 → 左栏理论上"全部卷走",可用 `--deny` 闪烁但**无拦截**。
- **右栏「CAW 托管」**:品牌绿框(`--accent` 1px 边)= 受保护;同一超界操作 → **当场弹 §6 拦截红框 + 红 glow 脉冲 + 403**,配真实 testnet tx hash(合规那笔,绿)对照。
- **收尾定格**:右栏 `❚❚ FROZEN` 冰蓝 + 左栏资产归零对比。一句话字幕用 `--font-serif` italic 强调 *"it can't run."*

## 8. 动效

仅 compositor 友好属性(`transform`/`opacity`/`filter`):
- CTA hover `translateY(-2px)` + glow [LOCKED]。
- 拦截弹框入场:`opacity 0→1` + `scale(0.96→1)` + 一次红 glow 脉冲(≤600ms)。
- 执行流新事件:从顶部 `translateY(-8px)` 淡入。
- 预算条颜色过渡 `300ms`。
- 移动端汉堡:`.open` class 切换 opacity/pointer-events [LOCKED 手法]。
- 尊重 `prefers-reduced-motion`,关脉冲与位移。

## 9. Anti-patterns(硬规则,DO NOT)

- **NOT 紫 / 靛 / 蓝紫渐变** [LOCKED]——codenest 明令禁,ChainPilot 同。
- **NOT** 把品牌绿当背景大面积铺;绿=放行语义,滥用就废了语义。
- **NOT** 拦截不用红、用灰/橙糊弄;denial 必须是全场最高视觉优先级。
- **NOT** tx hash / 地址 / 金额用比例字体;一律 mono + tabular-nums。
- **NOT** 给 dashboard 主区铺全屏视频/满屏液态玻璃;那是 Cover/浮层专属。
- **NOT** timid 灰底灰字的"安全感";要墨黑 + 冷光 + 高对比的机构级可信,不是 SaaS 模板。
- **NOT** 默认 chart 配色;图表用 `--accent`/语义色 + `--surface` 分层,当设计系统一部分。
- **NOT** 统一圆角/阴影/间距一把梭;按 §5 节奏分级。
```
