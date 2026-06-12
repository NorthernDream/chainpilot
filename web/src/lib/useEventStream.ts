import { useEffect, useRef, useState } from 'react';
import { WS_URL } from './api';
import type { ChainPilotEvent, StreamedEvent } from './events';

/**
 * 连 WS /ws:连上后端重放历史 → 之后实时推。断线 2s 重连。
 * 每次新连接重置事件列表(后端会重放全量历史,避免重复累加)。
 */
export function useEventStream(): { events: StreamedEvent[]; connected: boolean } {
  const [events, setEvents] = useState<StreamedEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = (): void => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        setConnected(true);
        seq.current = 0;
        setEvents([]);
      };
      ws.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data as string) as ChainPilotEvent;
          setEvents((prev) => [...prev, { seq: seq.current++, ts: Date.now(), event }]);
        } catch {
          /* 忽略坏帧 */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, []);

  return { events, connected };
}
