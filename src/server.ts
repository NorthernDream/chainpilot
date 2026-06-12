/**
 * HTTP + WebSocket server —— 前端安全面板的后端入口。
 *   · WS  /ws            连上即重放历史事件,之后实时推 ChainPilotEvent
 *   · POST /api/strategy 设策略(编译+激活 pact)
 *   · POST /api/price    注入价格(触发 agent 自主决策 → Executor 走 CAW)
 *   · POST /api/monitor/{start,stop}  起停后台自主监控
 *   · POST /api/freeze   一键冻结(revokePact)
 *   · GET  /api/history  历史事件快照
 *   · GET  /api/health   健康检查
 *
 * 运行:npm run dev(见 package.json)。凭证从 .env 读。
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { loadCawEnv } from './caw/types.js';
import { Orchestrator, type DelegateInput } from './orchestrator.js';

const PORT = Number(process.env.PORT ?? 8787);

const env = loadCawEnv();
const orchestrator = new Orchestrator({
  apiKey: env.apiKey,
  apiUrl: env.apiUrl,
  walletId: env.walletId,
  destination: env.destination,
});

function send(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(data);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

const server = createServer((req, res) => {
  void (async () => {
    const { method, url } = req;
    if (method === 'OPTIONS') return send(res, 204, {});

    try {
      if (method === 'GET' && url === '/api/health') {
        return send(res, 200, { ok: true, wallet: env.walletId });
      }
      if (method === 'GET' && url === '/api/history') {
        return send(res, 200, { events: orchestrator.getHistory() });
      }
      if (method === 'POST' && url === '/api/strategy') {
        const body = (await readJson(req)) as unknown as DelegateInput;
        await orchestrator.setStrategy(body);
        return send(res, 200, { ok: true });
      }
      if (method === 'POST' && url === '/api/price') {
        const { price } = await readJson(req);
        await orchestrator.injectPrice(Number(price));
        return send(res, 200, { ok: true });
      }
      if (method === 'POST' && url === '/api/market/start') {
        const { intervalMs } = await readJson(req);
        orchestrator.startMarket(intervalMs ? Number(intervalMs) : undefined);
        return send(res, 200, { ok: true });
      }
      if (method === 'POST' && url === '/api/market/stop') {
        orchestrator.stopMarket();
        return send(res, 200, { ok: true });
      }
      if (method === 'POST' && url === '/api/freeze') {
        await orchestrator.freeze();
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: 'not found' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return send(res, 500, { error: msg });
    }
  })();
});

// WebSocket:连上重放历史,之后实时推送
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws: WebSocket) => {
  for (const e of orchestrator.getHistory()) ws.send(JSON.stringify(e));
  const off = orchestrator.onEvent((e) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(e));
  });
  ws.on('close', off);
});

server.listen(PORT, () => {
  console.log(`[chainpilot] http+ws on :${PORT} (ws path /ws) wallet=${env.walletId}`);
});
