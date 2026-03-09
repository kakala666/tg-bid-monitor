import { describe, it, expect } from 'vitest';
import { generateDefaultStrategy } from '../../src/strategy-v2/defaultStrategy.js';
import { executeGraph } from '../../src/strategy-v2/executor.js';
import { buildContext } from '../../src/strategy-v2/context.js';
import { calcAllBids } from '../../src/strategy-v2/index.js';

describe('generateDefaultStrategy', () => {
  it('生成合法流程图', () => {
    const graph = generateDefaultStrategy();
    expect(graph.nodes.find(n => n.type === 'start')).toBeTruthy();
    expect(graph.nodes.filter(n => n.type === 'action').length).toBeGreaterThan(0);
  });

  it('等价旧策略 - 第一名降价省钱', () => {
    const graph = generateDefaultStrategy();
    const adConfig = { timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 300 }], gapThreshold: 5, fallbackRankLimit: null };
    const rankings = [
      { rank: 1, price: 200, adId: '广告AD2480', isMine: true },
      { rank: 2, price: 150, adId: '广告AD3000', isMine: false },
    ];
    const ctx = buildContext(rankings[0], rankings, adConfig);
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('LOWER');
    expect(result.targetPrice).toBe(151);
  });

  it('等价旧策略 - 第一名差距小保持', () => {
    const graph = generateDefaultStrategy();
    const adConfig = { timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 300 }], gapThreshold: 5, fallbackRankLimit: null };
    const rankings = [
      { rank: 1, price: 153, adId: '广告AD2480', isMine: true },
      { rank: 2, price: 150, adId: '广告AD3000', isMine: false },
    ];
    const ctx = buildContext(rankings[0], rankings, adConfig);
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('KEEP');
  });

  it('等价旧策略 - 非第一名可跳升', () => {
    const graph = generateDefaultStrategy();
    const adConfig = { timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 280 }], gapThreshold: 5, fallbackRankLimit: null };
    const rankings = [
      { rank: 1, price: 250, adId: '广告AD1000', isMine: false },
      { rank: 2, price: 200, adId: '广告AD2000', isMine: false },
      { rank: 3, price: 150, adId: '广告AD2480', isMine: true },
    ];
    const ctx = buildContext(rankings[2], rankings, adConfig);
    const result = executeGraph(graph, ctx);
    // above 是 rank 2 (200U)，200+1=201 <= 280，可以跳
    expect(result.action).toBe('RAISE');
    expect(result.targetPrice).toBe(201);
  });
});

describe('calcAllBids 兼容性', () => {
  it('返回 { suggestions } 格式', () => {
    const rankings = [
      { rank: 1, price: 200, adId: '广告AD2480', isMine: true },
      { rank: 2, price: 150, adId: '广告AD3000', isMine: false },
    ];
    const config = {
      adConfigs: {
        AD2480: {
          priceGapThreshold: 5,
          rankLimit: null,
          timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 300 }],
        },
      },
    };
    const result = calcAllBids(rankings, config);
    expect(result.suggestions).toBeInstanceOf(Array);
    expect(result.suggestions.length).toBe(1);
    const s = result.suggestions[0];
    expect(s).toHaveProperty('adId');
    expect(s).toHaveProperty('action');
    expect(s).toHaveProperty('currentPrice');
    expect(s).toHaveProperty('targetPrice');
    expect(s).toHaveProperty('reason');
  });

  it('未配置广告返回 SKIP', () => {
    const rankings = [
      { rank: 1, price: 200, adId: '广告AD9999', isMine: true },
    ];
    const config = { adConfigs: {} };
    const result = calcAllBids(rankings, config);
    expect(result.suggestions[0].action).toBe('SKIP');
  });

  it('安全防护：目标价不低于50U', () => {
    const rankings = [
      { rank: 1, price: 60, adId: '广告AD2480', isMine: true },
      { rank: 2, price: 30, adId: '广告AD3000', isMine: false },
    ];
    const config = {
      adConfigs: {
        AD2480: {
          priceGapThreshold: 5,
          timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 300 }],
        },
      },
    };
    const result = calcAllBids(rankings, config);
    const s = result.suggestions[0];
    if (s.action === 'LOWER') {
      expect(s.targetPrice).toBeGreaterThanOrEqual(50);
    }
  });

  it('支持自定义策略流程图', () => {
    const rankings = [
      { rank: 1, price: 200, adId: '广告AD2480', isMine: true },
      { rank: 2, price: 150, adId: '广告AD3000', isMine: false },
    ];
    const config = {
      adConfigs: {
        AD2480: {
          priceGapThreshold: 5,
          timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 300 }],
        },
      },
      adStrategies: {
        AD2480: {
          nodes: [
            { id: 's', type: 'start' },
            { id: 'a', type: 'action', action: 'KEEP' },
          ],
          edges: [{ from: 's', to: 'a' }],
        },
      },
    };
    const result = calcAllBids(rankings, config);
    expect(result.suggestions[0].action).toBe('KEEP');
  });

  it('支持策略模板', () => {
    const rankings = [
      { rank: 3, price: 100, adId: '广告AD2480', isMine: true },
      { rank: 2, price: 200, adId: '广告AD2000', isMine: false },
    ];
    const config = {
      adConfigs: {
        AD2480: {
          priceGapThreshold: 5,
          timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 300 }],
        },
      },
      strategyTemplates: {
        alwaysRaise: {
          nodes: [
            { id: 's', type: 'start' },
            { id: 'a', type: 'action', action: 'RAISE', targetExpr: 'above.price + 1' },
          ],
          edges: [{ from: 's', to: 'a' }],
        },
      },
      adStrategies: {
        AD2480: {
          nodes: [
            { id: 's', type: 'start' },
            { id: 't', type: 'template', templateId: 'alwaysRaise' },
          ],
          edges: [{ from: 's', to: 't' }],
        },
      },
    };
    const result = calcAllBids(rankings, config);
    expect(result.suggestions[0].action).toBe('RAISE');
    expect(result.suggestions[0].targetPrice).toBe(201);
  });
});
