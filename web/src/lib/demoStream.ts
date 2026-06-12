import type { StreamedEvent, ChainPilotEvent } from './events';
import { ETH_REPLAY } from './ethReplay';

/**
 * 示例快照流 —— 未授权时填满 cockpit,讲清完整故事:
 * 真实 ETH 行情驱动 → 连续合规卖出 0.001 → 日累计涨到 0.005 → 第 6 笔被日累计 403 摁停。
 * 价格用真实 ETH 数据(非合成)。明确标注「示例」,真实授权后被真实事件替换。
 */
const HASHES = [
  '0xe5a3bc3482135c8bad75c1fe81d582d8d0024e07c67fee3ccba7edf117d751f4',
  '0x7c2f9a1b4e8d3c6a5f0b2d9e1a4c7b8f3e6d0a9c2b5f8e1d4a7c0b3f6e9d2a5c',
  '0x3f8a1c5e9b2d6f4a0c7e1b9d3a5f8c2e6b0d4a7f1c9e3b6d8a2f5c0e7b1d4a9f',
  '0x9d2e7b4a1f6c3e8b5d0a9c2f7e4b1d6a3f8c5e0b7d2a4f9c1e6b3d8a5f0c2e7b',
  '0x1b6d3a8f5c2e9b4d7a0f3c6e1b8d5a2f9c4e7b0d3a6f1c8e5b2d9a4f7c0e3b6d',
];

export function demoStream(): StreamedEvent[] {
  const FAKE_PACT = '9bd5ae9a-826c-4fbb-bb05-f4cf3e55c531';
  const TP = ETH_REPLAY.tpLine;
  const closes = ETH_REPLAY.closes;
  const SELL = '0.001';
  const CAP = '0.005';

  let seq = 0;
  const t0 = Date.now() - 110_000;
  const out: StreamedEvent[] = [];
  const push = (event: ChainPilotEvent) => out.push({ seq: seq++, ts: t0 + seq * 800, event });
  let i = 0;
  const tick = () => push({ type: 'market.tick', price: closes[i++ % closes.length], tpLine: TP });
  const ramp = (n: number) => { for (let k = 0; k < n; k++) tick(); };

  push({ type: 'strategy.set', text: `ETH≥${TP} 止盈卖 ${SELL} · 单笔≤0.002 · 日累计≤${CAP}`, rules: {}, bounds: { chainId: 'SETH', tokenId: 'SETH', perTxCap: '0.002', dailyCap: CAP } });
  push({ type: 'pact.compiled', pactId: FAKE_PACT, policies: [] });
  push({ type: 'pact.activated', pactId: FAKE_PACT });

  // 连续 5 笔合规(0.001 → 日累计 0.005),每笔之间几个真实行情 tick
  for (let n = 1; n <= 5; n++) {
    ramp(6);
    const px = closes[i % closes.length];
    push({ type: 'trigger.fired', condition: `ETH ${px} ≥ 止盈线 ${TP}`, marketValue: String(px) });
    push({ type: 'action.decided', agent: 'stop-loss-agent', action: `take_profit → sell ${SELL} ETH`, amount: SELL, token: 'ETH', chain: 'SETH' });
    push({ type: 'tx.allowed', txId: `a${n}`, hash: HASHES[n - 1], amount: SELL });
    push({ type: 'budget.updated', dailyUsed: (0.001 * n).toFixed(3), dailyCap: CAP, totalUsed: (0.001 * n).toFixed(3) });
  }

  // 第 6 笔:日累计已满 → CAW 当场摁停
  ramp(6);
  const last = closes[i % closes.length];
  push({ type: 'trigger.fired', condition: `ETH ${last} ≥ 止盈线 ${TP}`, marketValue: String(last) });
  push({ type: 'action.decided', agent: 'stop-loss-agent', action: `take_profit → sell ${SELL} ETH`, amount: SELL, token: 'ETH', chain: 'SETH' });
  push({ type: 'tx.denied', code: 'DAILY_VALUE_LIMIT_EXCEEDED', reason: 'daily_value_limit_exceeded', threshold: CAP, attempted: SELL });

  return out;
}
