import { create } from 'zustand';

const MAX_LOGS = 500;

const useStore = create((set, get) => ({
  // 连接状态
  connected: false,
  setConnected: (v) => set({ connected: v }),

  // 监控状态
  monitoring: false,
  setMonitoring: (v) => set({ monitoring: v }),

  // 排名数据
  rankings: [],
  rankingsText: '',
  rankingsTime: null,
  setRankings: (data) => set({
    rankings: data.rankings || [],
    rankingsText: data.text || '',
    rankingsTime: Date.now(),
  }),

  // 竞价建议
  suggestions: [],
  setSuggestions: (data) => set({
    suggestions: data.suggestions || [],
  }),

  // 日志
  logs: [],
  addLog: (entry) => set((state) => ({
    logs: [...state.logs, { ...entry, _id: Date.now() + Math.random() }].slice(-MAX_LOGS),
  })),
  clearLogs: () => set({ logs: [] }),

  // 配置
  config: {},
  setConfig: (cfg) => set({ config: cfg }),

  // 广告详情
  myAdsDetail: [],
  setMyAdsDetail: (details) => set({ myAdsDetail: details }),

  // API 调用
  async fetchConfig() {
    try {
      const res = await fetch('/api/config');
      const cfg = await res.json();
      set({ config: cfg });
      return cfg;
    } catch (e) {
      get().addLog({ level: 'ERROR', message: `获取配置失败: ${e.message}`, time: new Date().toISOString() });
    }
  },

  async saveConfig(cfg) {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (data.ok) {
        set({ config: cfg });
        get().addLog({ level: 'INFO', message: '配置已保存', time: new Date().toISOString() });
      }
      return data;
    } catch (e) {
      get().addLog({ level: 'ERROR', message: `保存配置失败: ${e.message}`, time: new Date().toISOString() });
    }
  },

  async apiCall(url, method = 'POST') {
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.rankings) get().setRankings(data);
      if (data.strategy) get().setSuggestions(data.strategy);
      return data;
    } catch (e) {
      get().addLog({ level: 'ERROR', message: `API错误: ${e.message}`, time: new Date().toISOString() });
    }
  },

  async applyBid(adId, price) {
    try {
      const res = await fetch('/api/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId, price }),
      });
      const data = await res.json();
      get().addLog({
        level: data.success ? 'ACTION' : 'ERROR',
        message: data.success ? `改价成功: ${adId} → ${price}U` : `改价失败: ${data.error || data.confirmText}`,
        time: new Date().toISOString(),
      });
      return data;
    } catch (e) {
      get().addLog({ level: 'ERROR', message: `改价请求失败: ${e.message}`, time: new Date().toISOString() });
    }
  },

  async fetchMyAds() {
    try {
      const res = await fetch('/api/myads', { method: 'POST' });
      const data = await res.json();
      if (data.details) set({ myAdsDetail: data.details });
      return data;
    } catch (e) {
      get().addLog({ level: 'ERROR', message: `获取广告详情失败: ${e.message}`, time: new Date().toISOString() });
    }
  },

  async fetchStats(granularity = '1h', adId = null) {
    try {
      const params = new URLSearchParams({ granularity });
      if (adId) params.set('adId', adId);
      const res = await fetch(`/api/stats?${params}`);
      return await res.json();
    } catch (e) {
      get().addLog({ level: 'ERROR', message: `获取统计失败: ${e.message}`, time: new Date().toISOString() });
    }
  },
}));

export default useStore;
