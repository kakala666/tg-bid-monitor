const PRICE_FLOOR = 50;

/**
 * 对执行结果应用安全防护
 * @param {object} result - executeGraph 的结果 { action, targetPrice, path, error? }
 * @param {object} limits - { budgetLimit, currentPrice }
 * @returns {object} 附加 safetyNotes 的结果
 */
export function applySafetyGuards(result, { budgetLimit, currentPrice }) {
  const guarded = { ...result, safetyNotes: [] };

  // SKIP 不需要价格检查
  if (guarded.action === 'SKIP') return guarded;

  // KEEP 且当前价超预算 → 主动降价
  if (guarded.action === 'KEEP' && currentPrice > budgetLimit) {
    guarded.action = 'LOWER';
    guarded.targetPrice = Math.max(budgetLimit, PRICE_FLOOR);
    guarded.safetyNotes.push(`当前价${currentPrice}U超预算上限${budgetLimit}U，主动降价`);
    return guarded;
  }

  // 以下只对 RAISE/LOWER 做价格约束
  if (guarded.action !== 'RAISE' && guarded.action !== 'LOWER') return guarded;

  if (guarded.targetPrice > budgetLimit) {
    guarded.targetPrice = budgetLimit;
    guarded.safetyNotes.push(`目标价超预算上限${budgetLimit}U`);
  }

  if (guarded.targetPrice < PRICE_FLOOR) {
    guarded.targetPrice = PRICE_FLOOR;
    guarded.safetyNotes.push(`目标价低于${PRICE_FLOOR}U下限`);
  }

  return guarded;
}
