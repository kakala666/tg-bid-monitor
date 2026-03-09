// Web服务 - Express + WebSocket
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { addLogListener, removeLogListener, info } from '../logger.js';
import * as tg from '../telegram.js';
import { calcAllBids, getCurrentBudgetLimit } from '../strategy.js';
import { calcStats } from '../stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

let lastSuggestions = null;

// 根据时段获取当前轮询间隔（秒），无匹配则返回全局值
function getCurrentCheckInterval(cfg) {
  const slots = cfg.checkIntervalSlots || [];
  if (slots.length === 0) return cfg.checkInterval || 10;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  for (const slot of slots) {
    if (slot.start <= slot.end) {
      if (hhmm >= slot.start && hhmm < slot.end) return slot.interval;
    } else {
      if (hhmm >= slot.start || hhmm < slot.end) return slot.interval;
    }
  }
  return cfg.checkInterval || 10;
}

let wss = null;
let monitorTimer = null;
let monitorRunning = false;

export function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

export function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
}

// 广播消息给所有WS客户端
function broadcast(type, data) {
  if (!wss) return;
  const msg = JSON.stringify({ type, data, time: Date.now() });
  for (const ws of wss.clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// 启动监控循环
export function startMonitor() {
  if (monitorRunning) return;
  monitorRunning = true;
  const cfg = loadConfig();
  const curInterval = getCurrentCheckInterval(cfg);
  info(`监控已启动，当前间隔 ${curInterval} 秒`);
  broadcast('status', { monitoring: true });
  runMonitorLoop();
  startDetailCollector();
}

export function stopMonitor() {
  monitorRunning = false;
  if (monitorTimer) clearTimeout(monitorTimer);
  monitorTimer = null;
  if (detailTimer) clearInterval(detailTimer);
  detailTimer = null;
  info('监控已停止');
  broadcast('status', { monitoring: false });
}

// 广告详情定时采集（每10分钟）
const DETAIL_LOG_FILE = path.join(__dirname, '..', '..', 'ad_detail_log.jsonl');
let detailTimer = null;

function startDetailCollector() {
  if (detailTimer) return;
  detailTimer = setInterval(collectAdDetails, 10 * 60 * 1000);
  info('广告详情采集已启动，每10分钟记录一次');
}

async function collectAdDetails() {
  if (!monitorRunning) return;
  await tg.acquireLock('详情采集');
  try {
    const details = await tg.fetchAllMyAdsDetail();
    if (details && details.length > 0) {
      const record = {
        time: new Date().toISOString(),
        ads: details.map(d => ({
          adId: d.adId,
          rank: d.rank,
          currentBid: d.currentBid,
          remaining: d.remaining,
          totalBudget: d.totalBudget,
          views: d.views,
          status: d.status,
        })),
      };
      fs.appendFileSync(DETAIL_LOG_FILE, JSON.stringify(record) + '\n', 'utf-8');
      info(`广告详情已记录：${details.length} 个广告`);
    }
  } catch (err) {
    const { error } = await import('../logger.js');
    error('详情采集出错', err.message);
  } finally {
    tg.releaseLock('详情采集');
  }
}

async function runMonitorLoop() {
  if (!monitorRunning) return;
  await tg.acquireLock('监控轮询');
  try {
    const result = await tg.refreshRankings();
    if (result) {
      broadcast('rankings', {
        text: result.text,
        rankings: result.rankings,
        buttons: result.buttons,
      });
      // 计算竞价建议
      const cfg = loadConfig();
      const strategyResult = calcAllBids(result.rankings, cfg);
      lastSuggestions = strategyResult;
      broadcast('suggestions', strategyResult);

      // 自动执行改价
      if (cfg.autoBidEnabled && strategyResult.suggestions) {
        const toApply = strategyResult.suggestions.filter(s => s.action !== 'KEEP' && s.action !== 'SKIP');

        // 改价前发送群组通知
        if (cfg.enableNotify && cfg.notifyGroupId && toApply.length > 0) {
          try {
            await tg.resolveNotifyGroup(cfg.notifyGroupId);
            const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
            const lines = toApply.map(s => {
              const dir = s.action === 'RAISE' ? 'UP' : 'DOWN';
              const expectedRank = result.rankings.filter(r => r.price > s.targetPrice).length + 1;
              const label = s.note ? `${s.adId}(${s.note})` : s.adId;
              return `**${label}** ${dir} #${s.rank} -> #${expectedRank}\n\`${s.currentPrice}U -> ${s.targetPrice}U\``;
            });
            const msg = `**竞价通知** \`${time}\`\n${lines.join('\n\n')}`;
            await tg.sendNotify(msg);
          } catch (e) {
            info(`通知发送失败: ${e.message}`);
          }
        }

        for (const s of toApply) {
          const btnText = tg.findAdButton(s.adId, result.buttons);
          if (!btnText) {
            info(`自动改价跳过 ${s.adId}：未找到按钮`);
            continue;
          }
          info(`自动改价: ${s.adId} ${s.currentPrice}U → ${s.targetPrice}U`);
          const bidResult = await tg.changeBidPrice(btnText, s.targetPrice);
          broadcast('bidResult', { adId: s.adId, ...bidResult });
          if (!bidResult.success) {
            info(`自动改价失败 ${s.adId}，停止本轮后续改价`);
            break;
          }
        }
      }
    }
  } catch (err) {
    const { error } = await import('../logger.js');
    error('监控轮询出错', err.message);
  } finally {
    tg.releaseLock('监控轮询');
  }
  if (monitorRunning) {
    const cfg = loadConfig();
    const interval = getCurrentCheckInterval(cfg);
    monitorTimer = setTimeout(runMonitorLoop, interval * 1000);
  }
}

// 启动Web服务
export function startWebServer(port) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // API: 获取配置
  app.get('/api/config', (req, res) => {
    res.json(loadConfig());
  });

  // API: 保存配置
  app.post('/api/config', (req, res) => {
    try {
      saveConfig(req.body);
      info('配置已更新并保存');
      broadcast('config', req.body);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: 启动/停止监控
  app.post('/api/monitor/start', (req, res) => {
    startMonitor();
    res.json({ ok: true, monitoring: true });
  });
  app.post('/api/monitor/stop', (req, res) => {
    stopMonitor();
    res.json({ ok: true, monitoring: false });
  });
  app.get('/api/monitor/status', (req, res) => {
    res.json({ monitoring: monitorRunning });
  });

  // API: 手动执行一次导航获取排名
  app.post('/api/navigate', async (req, res) => {
    await tg.acquireLock('手动导航');
    try {
      const result = await tg.navigateToRankings();
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    } finally {
      tg.releaseLock('手动导航');
    }
  });

  // API: 手动刷新排名（同时计算建议）
  app.post('/api/refresh', async (req, res) => {
    await tg.acquireLock('手动刷新');
    try {
      const result = await tg.refreshRankings();
      let strategyResult = null;
      if (result && result.rankings) {
        const cfg = loadConfig();
        strategyResult = calcAllBids(result.rankings, cfg);
        lastSuggestions = strategyResult;
      }
      res.json({ ok: true, ...result, strategy: strategyResult });
    } catch (e) {
      res.status(500).json({ error: e.message });
    } finally {
      tg.releaseLock('手动刷新');
    }
  });

  // API: 手动计算策略（基于缓存的排名数据，无需锁）
  app.post('/api/calc', (req, res) => {
    const rankings = tg.getLastRankData();
    if (!rankings || rankings.length === 0) {
      return res.json({ ok: false, error: '没有排名数据，请先刷新' });
    }
    const cfg = loadConfig();
    const result = calcAllBids(rankings, cfg);
    lastSuggestions = result;
    res.json({ ok: true, ...result });
  });

  // API: 获取缓存的策略建议
  app.get('/api/suggestions', (req, res) => {
    res.json(lastSuggestions || { suggestions: [] });
  });

  // API: 修改广告竞价 { adId: "广告AD2458", price: 220 }
  app.post('/api/bid', async (req, res) => {
    await tg.acquireLock('手动改价');
    try {
      const cfg = loadConfig();
      if (!cfg.autoBidEnabled) {
        return res.json({ ok: false, error: '竞价总开关已关闭，仅监控模式' });
      }
      const { adId, price } = req.body;
      if (!adId || !price) {
        return res.status(400).json({ error: '缺少 adId 或 price' });
      }
      const msg = await tg.getLatestBotMessage();
      const buttons = msg ? msg.buttons : [];
      const btnText = tg.findAdButton(adId, buttons);
      if (!btnText) {
        return res.json({ ok: false, error: `未找到广告 ${adId} 的按钮，请确认当前在列表页` });
      }
      const result = await tg.changeBidPrice(btnText, price);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    } finally {
      tg.releaseLock('手动改价');
    }
  });

  // API: 获取所有"我的"广告详情
  app.post('/api/myads', async (req, res) => {
    await tg.acquireLock('获取广告详情');
    try {
      const details = await tg.fetchAllMyAdsDetail();
      res.json({ ok: true, details });
    } catch (e) {
      res.status(500).json({ error: e.message });
    } finally {
      tg.releaseLock('获取广告详情');
    }
  });

  // API: 获取缓存的我的广告详情
  app.get('/api/myads', (req, res) => {
    res.json({ details: tg.getLastMyAdsDetail() });
  });

  // API: 查看当前消息和按钮(调试用)
  app.get('/api/dump', async (req, res) => {
    try {
      const data = await tg.dumpButtons();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: 手动点击按钮(调试用)
  app.post('/api/click', async (req, res) => {
    try {
      const { text } = req.body;
      const ok = await tg.clickButton(text);
      const msg = await tg.getLatestBotMessage();
      res.json({ ok, message: msg ? { text: msg.text, buttons: msg.buttons } : null });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: 手动发送文本(调试用)
  app.post('/api/send', async (req, res) => {
    try {
      const { text } = req.body;
      await tg.sendCommand(text);
      const msg = await tg.getLatestBotMessage();
      res.json({ ok: true, message: msg ? { text: msg.text, buttons: msg.buttons } : null });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: 统计数据
  app.get('/api/stats', (req, res) => {
    try {
      const granularity = req.query.granularity || '1h';
      const filterAdId = req.query.adId || null;
      const result = calcStats(granularity, filterAdId);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  const server = http.createServer(app);
  wss = new WebSocketServer({ server });

  // WebSocket连接：推送日志
  wss.on('connection', (ws) => {
    const logHandler = (entry) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'log', data: entry }));
      }
    };
    addLogListener(logHandler);
    ws.on('close', () => removeLogListener(logHandler));
    // 发送当前状态
    ws.send(JSON.stringify({
      type: 'status',
      data: { monitoring: monitorRunning },
    }));
    const rank = tg.getLastRankData();
    if (rank) {
      ws.send(JSON.stringify({
        type: 'rankings',
        data: { rankings: rank, text: tg.getLastRawMessage() },
      }));
    }
    if (lastSuggestions) {
      ws.send(JSON.stringify({ type: 'suggestions', data: lastSuggestions }));
    }
  });

  server.listen(port, () => {
    info(`Web控制台已启动: http://localhost:${port}`);
  });
  return server;
}
