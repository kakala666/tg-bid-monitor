import { describe, it, expect } from 'vitest';
import { applySafetyGuards } from '../../src/strategy-v2/safety.js';

describe('applySafetyGuards', () => {
  it('目标价低于50U强制覆盖为50', () => {
    const result = { action: 'LOWER', targetPrice: 30, path: ['s', 'a1'] };
    const guarded = applySafetyGuards(result, { budgetLimit: 200, currentPrice: 100 });
    expect(guarded.targetPrice).toBe(50);
    expect(guarded.safetyNotes).toContain('目标价低于50U下限');
  });

  it('目标价超预算强制覆盖为预算上限', () => {
    const result = { action: 'RAISE', targetPrice: 350, path: ['s', 'a1'] };
    const guarded = applySafetyGuards(result, { budgetLimit: 300, currentPrice: 200 });
    expect(guarded.targetPrice).toBe(300);
    expect(guarded.safetyNotes).toContain('目标价超预算上限300U');
  });

  it('预算上限低于50U时取50U', () => {
    const result = { action: 'RAISE', targetPrice: 30, path: ['s', 'a1'] };
    const guarded = applySafetyGuards(result, { budgetLimit: 40, currentPrice: 100 });
    expect(guarded.targetPrice).toBe(50);
  });

  it('KEEP 且当前价超预算时主动降价', () => {
    const result = { action: 'KEEP', targetPrice: 350, path: ['s', 'a1'] };
    const guarded = applySafetyGuards(result, { budgetLimit: 300, currentPrice: 350 });
    expect(guarded.action).toBe('LOWER');
    expect(guarded.targetPrice).toBe(300);
  });

  it('正常情况不修改', () => {
    const result = { action: 'RAISE', targetPrice: 200, path: ['s', 'a1'] };
    const guarded = applySafetyGuards(result, { budgetLimit: 300, currentPrice: 150 });
    expect(guarded.targetPrice).toBe(200);
    expect(guarded.safetyNotes).toHaveLength(0);
  });

  it('SKIP 不检查价格', () => {
    const result = { action: 'SKIP', targetPrice: 10, path: ['s', 'a1'] };
    const guarded = applySafetyGuards(result, { budgetLimit: 300, currentPrice: 100 });
    expect(guarded.action).toBe('SKIP');
    expect(guarded.targetPrice).toBe(10);
    expect(guarded.safetyNotes).toHaveLength(0);
  });
});
