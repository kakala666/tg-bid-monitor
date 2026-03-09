import { useEffect, useRef } from 'react';
import useStore from '../stores/useStore';

export default function useWebSocket() {
  const wsRef = useRef(null);
  const setConnected = useStore((s) => s.setConnected);
  const setMonitoring = useStore((s) => s.setMonitoring);
  const setRankings = useStore((s) => s.setRankings);
  const setSuggestions = useStore((s) => s.setSuggestions);
  const addLog = useStore((s) => s.addLog);
  const setConfig = useStore((s) => s.setConfig);

  useEffect(() => {
    let reconnectTimer = null;
    let disposed = false;

    function connect() {
      if (disposed) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      // 使用 /ws 路径，避免与 Vite HMR WebSocket 冲突
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        addLog({ level: 'INFO', message: 'WebSocket 已连接', time: new Date().toISOString() });
      };

      ws.onclose = () => {
        setConnected(false);
        if (!disposed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        // onerror 后会自动触发 onclose，无需额外处理
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          switch (msg.type) {
            case 'log': addLog(msg.data); break;
            case 'rankings': setRankings(msg.data); break;
            case 'status': setMonitoring(msg.data.monitoring); break;
            case 'config': setConfig(msg.data); break;
            case 'suggestions': setSuggestions(msg.data); break;
            case 'bidResult':
              addLog({
                level: msg.data.success ? 'ACTION' : 'ERROR',
                message: msg.data.success
                  ? `自动改价成功: ${msg.data.adId} → ${msg.data.newPrice}U | ${msg.data.confirmText}`
                  : `自动改价失败: ${msg.data.adId} | ${msg.data.error || msg.data.confirmText}`,
                time: new Date().toISOString(),
              });
              break;
          }
        } catch {}
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);
}
