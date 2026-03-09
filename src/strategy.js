// @deprecated 已被 strategy-v2/ 替代，保留供参考
// 竞价策略计算模块 - 只计算不执行
import * as logger from './logger.js';

/**
 * 根据当前时间匹配时段
 */
function matchCurrentSlot(timeSlots) {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  for (const slot of timeSlots) {
    if (slot.start <= slot.end) {
      if (hhmm >= slot.start && hhmm < slot.end) return slot;
    } else {
      if (hhmm >= slot.start || hhmm < slot.end) return slot;
    }
  }
  return null;
}

/**
 * 根据当前时间获取对应时段的预算上限
 */
export function getCurrentBudgetLimit(timeSlots) {
  const slot = matchCurrentSlot(timeSlots);
  if (slot) return slot.budgetLimit;
  return timeSlots.length > 0
    ? Math.min(...timeSlots.map(s => s.budgetLimit))
    : 999;
}

/**
 * 根据当前时间获取对应时段的排名上限，未配置则回退到 fallback
 */
export function getCurrentRankLimit(timeSlots, fallback) {
  const slot = matchCurrentSlot(timeSlots);
  if (slot && slot.rankLimit != null) return slot.rankLimit;
  return fallback;
}

/**
 * 为单个广告计算竞价建议
 * @param {object} myAd - 我的广告在排名中的数据 { rank, price, adId }
 * @param {array} allRankings - 完整排名列表
 * @param {number} budgetLimit - 当前时段预算上限
 * @param {number} gapThreshold - 降价触发阈值X
 * @returns {object} { action, currentPrice, targetPrice, reason }
 */
export function calcBidForAd(myAd, allRankings, budgetLimit, gapThreshold, rankLimit) {
  const result = {
    adId: myAd.adId,
    rank: myAd.rank,
    currentPrice: myAd.price,
    targetPrice: myAd.price,
    action: 'KEEP',
    reason: '',
    budgetLimit,
    gapThreshold,
    rankLimit,
  };

  // 找上方最近的【非自家】广告（排名更高=数字更小）
  const above = allRankings
    .filter(r => r.rank < myAd.rank && !r.isMine)
    .sort((a, b) => b.rank - a.rank)[0] || null;
  // 找下方最近的【非自家】广告（排名更低=数字更大）
  const below = allRankings
    .filter(r => r.rank > myAd.rank && !r.isMine)
    .sort((a, b) => a.rank - b.rank)[0] || null;

  // 排名上限检查
  if (rankLimit != null && myAd.rank < rankLimit) {
    // 排名严格优于上限，降至第K+1名的价格-1
    const targetAd = allRankings
      .filter(r => r.rank >= rankLimit + 1 && !r.isMine)
      .sort((a, b) => a.rank - b.rank)[0] || null;

    if (targetAd && targetAd.price - 1 < myAd.price && targetAd.price > 1) {
      result.action = 'LOWER';
      result.targetPrice = targetAd.price - 1;
      result.reason = `排名#${myAd.rank}优于上限#${rankLimit}，降至#${rankLimit + 1}位(${targetAd.price}U)-1=${result.targetPrice}U`;
    } else {
      result.reason = `排名#${myAd.rank}优于上限#${rankLimit}，无合适目标，保持不变`;
    }
  } else if (rankLimit != null && myAd.rank === rankLimit) {
    // 刚好在上限位置，检查是否可以降价省钱
    if (below) {
      const gap = myAd.price - below.price;
      if (gap > gapThreshold) {
        result.action = 'LOWER';
        result.targetPrice = below.price + 1;
        result.reason = `已在排名上限#${rankLimit}，与下一名(#${below.rank})差距${gap}U > 阈值${gapThreshold}U，降至${result.targetPrice}U省钱`;
      } else {
        result.reason = `已在排名上限#${rankLimit}，与下一名差距${gap}U <= 阈值${gapThreshold}U，保持不变`;
      }
    } else {
      result.reason = `已在排名上限#${rankLimit}，无下一名数据，保持不变`;
    }
  } else if (!above || myAd.rank === 1) {
    // 已经是第一名，检查是否可以降价省钱
    if (below) {
      const gap = myAd.price - below.price;
      if (gap > gapThreshold) {
        result.action = 'LOWER';
        result.targetPrice = below.price + 1;
        result.reason = `已是第1名，与第2名差距${gap}U > 阈值${gapThreshold}U，可降至${result.targetPrice}U省钱`;
      } else {
        result.reason = `已是第1名，与第2名差距${gap}U <= 阈值${gapThreshold}U，保持不变`;
      }
    } else {
      result.reason = '已是第1名且无下一名数据，保持不变';
    }
  } else {
    // 在预算和排名限制内，尽可能向前跨越多名
    const candidates = allRankings
      .filter(r => r.rank < myAd.rank && !r.isMine)
      .filter(r => rankLimit == null || r.rank >= rankLimit)
      .sort((a, b) => a.rank - b.rank); // 排名从高到低（数字小=排名高）

    let bestTarget = null;
    for (const c of candidates) {
      if (c.price + 1 <= budgetLimit) {
        bestTarget = c;
        break;
      }
    }

    if (bestTarget) {
      result.action = 'RAISE';
      result.targetPrice = bestTarget.price + 1;
      const jumped = myAd.rank - bestTarget.rank;
      result.reason = `跨越${jumped}名至#${bestTarget.rank}(${bestTarget.price}U)上方，出价${result.targetPrice}U，预算${budgetLimit}U`;
    } else {
      result.reason = `预算${budgetLimit}U内无法超越上方任何广告`;
      if (below) {
        const gap = myAd.price - below.price;
        if (gap > gapThreshold) {
          result.action = 'LOWER';
          result.targetPrice = below.price + 1;
          result.reason += `；与下一名(#${below.rank})差距${gap}U > 阈值${gapThreshold}U，降至${result.targetPrice}U`;
        } else {
          result.reason += `；与下一名差距${gap}U <= 阈值${gapThreshold}U，保持不变`;
        }
      }
    }
  }

  // 预算硬性兜底：目标价不得超过预算上限
  if (result.targetPrice > budgetLimit) {
    result.action = 'LOWER';
    result.targetPrice = budgetLimit;
    result.reason += `；目标价超预算，强制降至预算上限${budgetLimit}U`;
  }
  // 当前价超预算但策略建议保持不变时：主动降至预算上限
  if (result.action === 'KEEP' && myAd.price > budgetLimit) {
    result.action = 'LOWER';
    result.targetPrice = budgetLimit;
    result.reason += `；当前价${myAd.price}U超预算上限${budgetLimit}U，主动降价`;
  }

  return result;
}

/**
 * 获取某个广告的独立配置（无全局回退，未配置则标记 configured: false）
 */
export function getAdConfig(adId, config) {
  const adCfg = (config.adConfigs || {})[adId];
  if (!adCfg) {
    return { configured: false, timeSlots: [], gapThreshold: 5, fallbackRankLimit: null, note: '' };
  }
  const timeSlots = (adCfg.timeSlots && adCfg.timeSlots.length > 0)
    ? adCfg.timeSlots
    : [];
  const gapThreshold = adCfg.priceGapThreshold != null
    ? adCfg.priceGapThreshold
    : 5;
  const fallbackRankLimit = adCfg.rankLimit != null ? adCfg.rankLimit : null;
  const note = adCfg.note || '';
  const configured = timeSlots.length > 0;
  return { configured, timeSlots, gapThreshold, fallbackRankLimit, note };
}

/**
 * 为所有"我的"广告批量计算竞价建议（每个广告独立预算）
 */
export function calcAllBids(rankings, config) {
  const myAds = rankings.filter(r => r.isMine);
  logger.info(`策略计算：我的广告 ${myAds.length} 个`);

  const suggestions = myAds.map(ad => {
    // adId 格式: "广告AD2458"，取 "AD2458" 部分作为key
    const adKey = ad.adId.replace('广告', '');
    const adConfig = getAdConfig(adKey, config);

    // 未配置独立预算的广告：不参与竞价
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
    const bidResult = calcBidForAd(ad, rankings, budgetLimit, gapThreshold, rankLimit);
    bidResult.note = note;
    return bidResult;
  });

  for (const s of suggestions) {
    const tag = s.action === 'KEEP' ? '⏸' : s.action === 'RAISE' ? '⬆' : s.action === 'LOWER' ? '⬇' : '⏭';
    const nt = s.note ? `(${s.note})` : '';
    logger.info(`${tag} ${s.adId}${nt} #${s.rank}: ${s.currentPrice}U → ${s.targetPrice}U [${s.action}] ${s.reason}`);
  }
  return { suggestions };
}
