import { describe, it, expect } from 'vitest';
import { buildContext } from '../../src/strategy-v2/context.js';

const rankings = [
  { rank: 1, price: 300, adId: '广告AD1000', isMine: false },
  { rank: 2, price: 250, adId: '广告AD2000', isMine: false },
  { rank: 3, price: 200, adId: '广告AD2480', isMine: true },
  { rank: 4, price: 150, adId: '广告AD3000', isMine: false },
  { rank: 5, price: 100, adId: '广告AD4000', isMine: false },
];

const adConfig = {
  timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 280, rankLimit: 2 }],
  gapThreshold: 5,
  fallbackRankLimit: 3,
};

describe('buildContext', () => {
  it('myAd 正确', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.myAd).toEqual({ rank: 3, price: 200, adId: '广告AD2480' });
  });

  it('above 是上方最近的非自家广告', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.above).toEqual({ rank: 2, price: 250, adId: '广告AD2000' });
  });

  it('below 是下方最近的非自家广告', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.below).toEqual({ rank: 4, price: 150, adId: '广告AD3000' });
  });

  it('ad() 函数可按ID查询', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.ad('AD1000')).toEqual({ rank: 1, price: 300, adId: '广告AD1000' });
    expect(ctx.ad('AD9999')).toBe(null);
  });

  it('budgetLimit 从时段配置获取', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.budgetLimit).toBe(280);
  });

  it('rankings.length', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.rankings).toEqual({ length: rankings.length });
  });

  it('第一名时 above 为 null', () => {
    const ctx = buildContext(rankings[0], rankings, adConfig);
    expect(ctx.above).toBe(null);
  });

  it('最后一名时 below 为 null', () => {
    const ctx = buildContext(rankings[4], rankings, adConfig);
    expect(ctx.below).toBe(null);
  });

  it('vars 初始为空对象', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.vars).toEqual({});
  });
});
