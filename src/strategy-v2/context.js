// 构建表达式执行上下文

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

export function getCurrentBudgetLimit(timeSlots) {
  const slot = matchCurrentSlot(timeSlots);
  if (slot) return slot.budgetLimit;
  return timeSlots.length > 0
    ? Math.min(...timeSlots.map(s => s.budgetLimit))
    : 999;
}

export function getCurrentRankLimit(timeSlots, fallback) {
  const slot = matchCurrentSlot(timeSlots);
  if (slot && slot.rankLimit != null) return slot.rankLimit;
  return fallback;
}

export function buildContext(myAd, allRankings, adConfig) {
  const above = allRankings
    .filter(r => r.rank < myAd.rank && !r.isMine)
    .sort((a, b) => b.rank - a.rank)[0] || null;

  const below = allRankings
    .filter(r => r.rank > myAd.rank && !r.isMine)
    .sort((a, b) => a.rank - b.rank)[0] || null;

  const { timeSlots = [], gapThreshold = 5, fallbackRankLimit = null } = adConfig;
  const budgetLimit = getCurrentBudgetLimit(timeSlots);
  const rankLimit = getCurrentRankLimit(timeSlots, fallbackRankLimit);

  const simplify = (r) => r ? { rank: r.rank, price: r.price, adId: r.adId } : null;

  return {
    myAd: simplify(myAd),
    above: simplify(above),
    below: simplify(below),
    budgetLimit,
    gapThreshold,
    rankLimit,
    rankings: { length: allRankings.length },
    ad: (id) => {
      const found = allRankings.find(r => r.adId.includes(id));
      return found ? simplify(found) : null;
    },
    vars: {},
  };
}
