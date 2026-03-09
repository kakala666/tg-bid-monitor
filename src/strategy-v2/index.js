import { buildContext, getCurrentBudgetLimit, getCurrentRankLimit } from './context.js';
import { executeGraph } from './executor.js';
import { applySafetyGuards } from './safety.js';
import { generateDefaultStrategy } from './defaultStrategy.js';
import * as logger from '../logger.js';

function getAdConfig(adId, config) {
  const adCfg = (config.adConfigs || {})[adId];
  if (!adCfg) {
    return { configured: false, timeSlots: [], gapThreshold: 5, fallbackRankLimit: null, note: '' };
  }
  const timeSlots = (adCfg.timeSlots && adCfg.timeSlots.length > 0) ? adCfg.timeSlots : [];
  const gapThreshold = adCfg.priceGapThreshold != null ? adCfg.priceGapThreshold : 5;
  const fallbackRankLimit = adCfg.rankLimit != null ? adCfg.rankLimit : null;
  const note = adCfg.note || '';
  const configured = timeSlots.length > 0;
  return { configured, timeSlots, gapThreshold, fallbackRankLimit, note };
}

/**
 * 为所有"我的"广告批量计算竞价建议（接口与旧版完全兼容）
 */
export function calcAllBids(rankings, config) {
  const myAds = rankings.filter(r => r.isMine);
  logger.info(`策略计算(V2)：我的广告 ${myAds.length} 个`);

  const templates = config.strategyTemplates || {};

  const suggestions = myAds.map(ad => {
    const adKey = ad.adId.replace('广告', '');
    const adConfig = getAdConfig(adKey, config);

    if (!adConfig.configured) {
      logger.warn(`  ${adKey}: 未配置独立预算，跳过竞价`);
      return {
        adId: ad.adId,
        note: adConfig.note,
        rank: ad.rank,
        currentPrice: ad.price,
        targetPrice: ad.price,
        action: 'SKIP',
        reason: '该广告未配置独立预算时段，不参与自动竞价。请在配置中添加该广告。',
        budgetLimit: 0,
        gapThreshold: adConfig.gapThreshold,
        configured: false,
      };
    }

    const { timeSlots, gapThreshold, fallbackRankLimit, note } = adConfig;
    const budgetLimit = getCurrentBudgetLimit(timeSlots);
    const rankLimit = getCurrentRankLimit(timeSlots, fallbackRankLimit);
    const noteTag = note ? `(${note})` : '';
    logger.info(`  ${adKey}${noteTag}: 预算上限 ${budgetLimit}U，阈值 ${gapThreshold}U，排名上限 ${rankLimit != null ? '#' + rankLimit : '无'}`);

    const ctx = buildContext(ad, rankings, adConfig);
    const adStrategy = (config.adStrategies || {})[adKey];
    const graph = adStrategy || generateDefaultStrategy();
    const execResult = executeGraph(graph, ctx, { templates });
    const safeResult = applySafetyGuards(execResult, { budgetLimit, currentPrice: ad.price });

    const reason = safeResult.path.join(' → ')
      + (safeResult.safetyNotes.length > 0 ? `；安全防护: ${safeResult.safetyNotes.join('，')}` : '')
      + (safeResult.error ? `；错误: ${safeResult.error}` : '');

    return {
      adId: ad.adId,
      note,
      rank: ad.rank,
      currentPrice: ad.price,
      targetPrice: safeResult.targetPrice,
      action: safeResult.action,
      reason,
      budgetLimit,
      gapThreshold,
      rankLimit,
    };
  });

  for (const s of suggestions) {
    const tag = s.action === 'KEEP' ? '⏸' : s.action === 'RAISE' ? '⬆' : s.action === 'LOWER' ? '⬇' : '⏭';
    const nt = s.note ? `(${s.note})` : '';
    logger.info(`${tag} ${s.adId}${nt} #${s.rank}: ${s.currentPrice}U → ${s.targetPrice}U [${s.action}] ${s.reason}`);
  }
  return { suggestions };
}

export { getCurrentBudgetLimit } from './context.js';
export { generateDefaultStrategy } from './defaultStrategy.js';
