import type { StreamedEvent, TxAllowedEvent, TxDeniedEvent } from './events';

export interface Verdict {
  seq: number;
  ts: number;
  kind: 'allowed' | 'denied';
  amount: string;
  txId?: string;
  hash?: string | null;
  code?: string;
  threshold?: string;
}

export interface Snapshot {
  strategyText: string | null;
  bounds: Record<string, unknown> | null;
  pactId: string | null;
  pactActive: boolean;
  agentActive: boolean; // 有 market.tick 在流动且未冻结
  price: number | null;
  tpLine: number | null;
  priceHistory: number[];
  budget: { dailyUsed: number; dailyCap: number; totalUsed: number };
  verdicts: Verdict[];
  allowed: TxAllowedEvent[];
  denied: TxDeniedEvent[];
  lastDenial: TxDeniedEvent | null;
  lastAllowed: TxAllowedEvent | null;
  frozen: boolean;
}

const MAX_HISTORY = 48;

/** 从事件流折叠出 cockpit 当前快照。 */
export function deriveSnapshot(events: StreamedEvent[]): Snapshot {
  const s: Snapshot = {
    strategyText: null,
    bounds: null,
    pactId: null,
    pactActive: false,
    agentActive: false,
    price: null,
    tpLine: null,
    priceHistory: [],
    budget: { dailyUsed: 0, dailyCap: 0, totalUsed: 0 },
    verdicts: [],
    allowed: [],
    denied: [],
    lastDenial: null,
    lastAllowed: null,
    frozen: false,
  };

  for (const { seq, ts, event: e } of events) {
    switch (e.type) {
      case 'market.tick':
        s.price = e.price;
        s.tpLine = e.tpLine;
        s.priceHistory.push(e.price);
        break;
      case 'strategy.set':
        s.strategyText = e.text;
        s.bounds = e.bounds;
        s.frozen = false;
        break;
      case 'pact.compiled':
        s.pactId = e.pactId;
        break;
      case 'pact.activated':
        s.pactActive = true;
        break;
      case 'tx.allowed':
        s.allowed.push(e);
        s.lastAllowed = e;
        s.verdicts.push({ seq, ts, kind: 'allowed', amount: e.amount, txId: e.txId, hash: e.hash });
        break;
      case 'tx.hash': {
        const v = s.verdicts.find((x) => x.txId === e.txId);
        if (v) v.hash = e.hash;
        if (s.lastAllowed?.txId === e.txId) s.lastAllowed = { ...s.lastAllowed, hash: e.hash };
        break;
      }
      case 'tx.denied':
        s.denied.push(e);
        s.lastDenial = e;
        s.verdicts.push({ seq, ts, kind: 'denied', amount: e.attempted, code: e.code, threshold: e.threshold });
        break;
      case 'budget.updated':
        s.budget = {
          dailyUsed: Number(e.dailyUsed) || 0,
          dailyCap: Number(e.dailyCap) || 0,
          totalUsed: Number(e.totalUsed) || 0,
        };
        break;
      case 'freeze.triggered':
        s.frozen = true;
        s.pactActive = false;
        break;
    }
  }

  if (s.priceHistory.length > MAX_HISTORY) s.priceHistory = s.priceHistory.slice(-MAX_HISTORY);
  s.agentActive = s.pactActive && !s.frozen;
  return s;
}
