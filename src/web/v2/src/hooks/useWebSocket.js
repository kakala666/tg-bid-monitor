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

    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
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
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);
}
