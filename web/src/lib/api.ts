/** 后端命令 API(:8787)。所有写操作走这里,事件回流走 WS。 */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8787';

export const WS_URL = BASE.replace(/^http/, 'ws') + '/ws';

/** 用户只设安全契约;entry/止盈位来自真实行情数据(后端注入)。 */
export interface StrategyInput {
  sellPerTx: string;
  perTxCap: string;
  dailyCap: string;
}

async function post(path: string, body?: unknown): Promise<unknown> {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await r.json()) as { error?: string };
  if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
  return json;
}

export const api = {
  setStrategy: (s: StrategyInput) => post('/api/strategy', s),
  injectPrice: (price: number) => post('/api/price', { price }),
  startMarket: (intervalMs?: number) => post('/api/market/start', { intervalMs }),
  stopMarket: () => post('/api/market/stop'),
  freeze: () => post('/api/freeze'),
  health: async (): Promise<boolean> => {
    try {
      const r = await fetch(BASE + '/api/health');
      return r.ok;
    } catch {
      return false;
    }
  },
};
