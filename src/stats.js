// 统计数据聚合模块
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DETAIL_LOG_FILE = path.join(__dirname, '..', 'ad_detail_log.jsonl');

const GRANULARITY_MS = {
  '10m': 10 * 60 * 1000,
  '1h':  60 * 60 * 1000,
  '3h':  3 * 60 * 60 * 1000,
  '6h':  6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export function calcStats(granularity, filterAdId) {
  const granMs = GRANULARITY_MS[granularity];
  if (!granMs) throw new Error('无效的颗粒度: ' + granularity);

  if (!fs.existsSync(DETAIL_LOG_FILE)) {
    return { adIds: [], data: {} };
  }
  const lines = fs.readFileSync(DETAIL_LOG_FILE, 'utf-8')
    .split('\n').filter(Boolean);

  // 按广告ID分组
  const byAd = {};
  for (const line of lines) {
    let record;
    try { record = JSON.parse(line); } catch { continue; }
    for (const ad of record.ads) {
      if (filterAdId && ad.adId !== filterAdId) continue;
      if (!byAd[ad.adId]) byAd[ad.adId] = [];
      byAd[ad.adId].push({
        time: new Date(record.time),
        views: ad.views,
        remaining: ad.remaining,
        currentBid: ad.currentBid,
        rank: ad.rank,
      });
    }
  }

  // 对每个广告分桶+计算差值
  const data = {};
  for (const [adId, entries] of Object.entries(byAd)) {
    entries.sort((a, b) => a.time - b.time);
    // 分桶：每桶取最后一条
    const buckets = new Map();
    for (const e of entries) {
      const key = Math.floor(e.time.getTime() / granMs) * granMs;
      buckets.set(key, e);
    }
    const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
    // 计算差值
    const snapshots = [];
    for (let i = 0; i < sorted.length; i++) {
      const [ts, cur] = sorted[i];
      const prev = i > 0 ? sorted[i - 1][1] : null;
      snapshots.push({
        time: new Date(ts).toISOString(),
        views: cur.views,
        remaining: cur.remaining,
        currentBid: cur.currentBid,
        rank: cur.rank,
        viewsIncr: prev ? cur.views - prev.views : 0,
        remainingChange: prev
          ? Math.round((cur.remaining - prev.remaining) * 10000) / 10000
          : 0,
      });
    }
    data[adId] = { snapshots };
  }

  return { adIds: Object.keys(data), data };
}
