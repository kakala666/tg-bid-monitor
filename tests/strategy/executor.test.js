import { describe, it, expect } from 'vitest';
import { executeGraph } from '../../src/strategy-v2/executor.js';

describe('executeGraph', () => {
  it('直接到 action 节点', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'a1', type: 'action', action: 'KEEP' },
      ],
      edges: [{ from: 's', to: 'a1' }],
    };
    const ctx = { myAd: { rank: 1, price: 100 } };
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('KEEP');
    expect(result.targetPrice).toBe(100);
    expect(result.path).toEqual(['s', 'a1']);
  });

  it('条件分支 - true', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'c1', type: 'condition', expr: 'myAd.rank > 3' },
        { id: 'a1', type: 'action', action: 'RAISE', targetExpr: 'above.price + 1' },
        { id: 'a2', type: 'action', action: 'KEEP' },
      ],
      edges: [
        { from: 's', to: 'c1' },
        { from: 'c1', to: 'a1', branch: 'yes' },
        { from: 'c1', to: 'a2', branch: 'no' },
      ],
    };
    const ctx = {
      myAd: { rank: 5, price: 100 },
      above: { rank: 4, price: 150 },
    };
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('RAISE');
    expect(result.targetPrice).toBe(151);
    expect(result.path).toEqual(['s', 'c1(yes)', 'a1']);
  });

  it('条件分支 - false', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'c1', type: 'condition', expr: 'myAd.rank > 3' },
        { id: 'a1', type: 'action', action: 'RAISE', targetExpr: 'above.price + 1' },
        { id: 'a2', type: 'action', action: 'KEEP' },
      ],
      edges: [
        { from: 's', to: 'c1' },
        { from: 'c1', to: 'a1', branch: 'yes' },
        { from: 'c1', to: 'a2', branch: 'no' },
      ],
    };
    const ctx = {
      myAd: { rank: 2, price: 200 },
      above: { rank: 1, price: 300 },
    };
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('KEEP');
    expect(result.targetPrice).toBe(200);
  });

  it('setVar 设置变量后续可用', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'sv1', type: 'setVar', varName: 'gap', expr: 'myAd.price - below.price' },
        { id: 'c1', type: 'condition', expr: 'vars.gap > 10' },
        { id: 'a1', type: 'action', action: 'LOWER', targetExpr: 'below.price + 1' },
        { id: 'a2', type: 'action', action: 'KEEP' },
      ],
      edges: [
        { from: 's', to: 'sv1' },
        { from: 'sv1', to: 'c1' },
        { from: 'c1', to: 'a1', branch: 'yes' },
        { from: 'c1', to: 'a2', branch: 'no' },
      ],
    };
    const ctx = {
      myAd: { rank: 1, price: 200 },
      below: { rank: 2, price: 150 },
      vars: {},
    };
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('LOWER');
    expect(result.targetPrice).toBe(151);
  });

  it('超过步数上限返回 KEEP', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'sv1', type: 'setVar', varName: 'x', expr: '1' },
        { id: 'sv2', type: 'setVar', varName: 'y', expr: '2' },
      ],
      edges: [
        { from: 's', to: 'sv1' },
        { from: 'sv1', to: 'sv2' },
        { from: 'sv2', to: 'sv1' },
      ],
    };
    const ctx = { myAd: { rank: 1, price: 100 }, vars: {} };
    const result = executeGraph(graph, ctx, { maxSteps: 10 });
    expect(result.action).toBe('KEEP');
    expect(result.error).toMatch(/步数上限/);
  });

  it('action 无 targetExpr 时保留当前价', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'a1', type: 'action', action: 'SKIP' },
      ],
      edges: [{ from: 's', to: 'a1' }],
    };
    const ctx = { myAd: { rank: 1, price: 200 } };
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('SKIP');
    expect(result.targetPrice).toBe(200);
  });

  it('表达式错误返回 KEEP + error', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'c1', type: 'condition', expr: 'a +++ b' },
        { id: 'a1', type: 'action', action: 'RAISE' },
      ],
      edges: [
        { from: 's', to: 'c1' },
        { from: 'c1', to: 'a1', branch: 'yes' },
      ],
    };
    const ctx = { myAd: { rank: 1, price: 100 } };
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('KEEP');
    expect(result.error).toBeTruthy();
  });
});

describe('template 节点', () => {
  it('嵌入模板子流程', () => {
    const templates = {
      aggressive: {
        nodes: [
          { id: 's', type: 'start' },
          { id: 'c1', type: 'condition', expr: 'above != null' },
          { id: 'a1', type: 'action', action: 'RAISE', targetExpr: 'above.price + 1' },
          { id: 'a2', type: 'action', action: 'KEEP' },
        ],
        edges: [
          { from: 's', to: 'c1' },
          { from: 'c1', to: 'a1', branch: 'yes' },
          { from: 'c1', to: 'a2', branch: 'no' },
        ],
      },
    };

    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 't1', type: 'template', templateId: 'aggressive' },
      ],
      edges: [{ from: 's', to: 't1' }],
    };

    const ctx = {
      myAd: { rank: 3, price: 200 },
      above: { rank: 2, price: 250 },
      vars: {},
    };

    const result = executeGraph(graph, ctx, { templates });
    expect(result.action).toBe('RAISE');
    expect(result.targetPrice).toBe(251);
  });

  it('模板不存在返回错误', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 't1', type: 'template', templateId: 'nonexistent' },
      ],
      edges: [{ from: 's', to: 't1' }],
    };
    const ctx = { myAd: { rank: 1, price: 100 }, vars: {} };
    const result = executeGraph(graph, ctx, { templates: {} });
    expect(result.action).toBe('KEEP');
    expect(result.error).toMatch(/未找到模板/);
  });

  it('模板变量共享', () => {
    const templates = {
      calc: {
        nodes: [
          { id: 's', type: 'start' },
          { id: 'sv', type: 'setVar', varName: 'computed', expr: 'myAd.price + 10' },
          { id: 'a', type: 'action', action: 'RAISE', targetExpr: 'vars.computed' },
        ],
        edges: [
          { from: 's', to: 'sv' },
          { from: 'sv', to: 'a' },
        ],
      },
    };

    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 't1', type: 'template', templateId: 'calc' },
      ],
      edges: [{ from: 's', to: 't1' }],
    };

    const ctx = { myAd: { rank: 1, price: 100 }, vars: {} };
    const result = executeGraph(graph, ctx, { templates });
    expect(result.action).toBe('RAISE');
    expect(result.targetPrice).toBe(110);
  });

  it('循环模板引用检测', () => {
    const templates = {
      a: {
        nodes: [
          { id: 's', type: 'start' },
          { id: 't', type: 'template', templateId: 'b' },
        ],
        edges: [{ from: 's', to: 't' }],
      },
      b: {
        nodes: [
          { id: 's', type: 'start' },
          { id: 't', type: 'template', templateId: 'a' },
        ],
        edges: [{ from: 's', to: 't' }],
      },
    };

    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 't1', type: 'template', templateId: 'a' },
      ],
      edges: [{ from: 's', to: 't1' }],
    };

    const ctx = { myAd: { rank: 1, price: 100 }, vars: {} };
    const result = executeGraph(graph, ctx, { templates });
    expect(result.action).toBe('KEEP');
    expect(result.error).toMatch(/循环引用/);
  });
});
