import { evalExpr } from './expr.js';

const DEFAULT_MAX_STEPS = 100;

/**
 * 执行流程图，返回竞价动作结果
 * @param {object} graph - { nodes: [], edges: [] }
 * @param {object} ctx - 表达式执行上下文
 * @param {object} options - { maxSteps, templates, _templateStack }
 * @returns {{ action, targetPrice, path, error? }}
 */
export function executeGraph(graph, ctx, options = {}) {
  const { maxSteps = DEFAULT_MAX_STEPS, templates = {}, _templateStack = [] } = options;
  const currentPrice = ctx.myAd?.price ?? 0;

  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
  const edgeMap = new Map();
  for (const e of graph.edges) {
    if (!edgeMap.has(e.from)) edgeMap.set(e.from, []);
    edgeMap.get(e.from).push(e);
  }

  const startNode = graph.nodes.find(n => n.type === 'start');
  if (!startNode) {
    return { action: 'KEEP', targetPrice: currentPrice, path: [], error: '流程图缺少 start 节点' };
  }

  const path = [];
  let currentId = startNode.id;
  let steps = 0;

  while (steps < maxSteps) {
    steps++;
    const node = nodeMap.get(currentId);
    if (!node) {
      return { action: 'KEEP', targetPrice: currentPrice, path, error: `未找到节点 ${currentId}` };
    }

    try {
      switch (node.type) {
        case 'start': {
          path.push(node.id);
          const edge = (edgeMap.get(node.id) || [])[0];
          if (!edge) return { action: 'KEEP', targetPrice: currentPrice, path, error: 'start 节点无出边' };
          currentId = edge.to;
          break;
        }

        case 'condition': {
          const result = evalExpr(node.expr, ctx);
          const branch = result ? 'yes' : 'no';
          path.push(`${node.id}(${branch})`);
          const edges = edgeMap.get(node.id) || [];
          const edge = edges.find(e => e.branch === branch);
          if (!edge) {
            return { action: 'KEEP', targetPrice: currentPrice, path, error: `条件节点 ${node.id} 缺少 ${branch} 分支` };
          }
          currentId = edge.to;
          break;
        }

        case 'setVar': {
          const value = evalExpr(node.expr, ctx);
          ctx.vars[node.varName] = value;
          path.push(node.id);
          const edge = (edgeMap.get(node.id) || [])[0];
          if (!edge) return { action: 'KEEP', targetPrice: currentPrice, path, error: `setVar 节点 ${node.id} 无出边` };
          currentId = edge.to;
          break;
        }

        case 'template': {
          const tmpl = templates[node.templateId];
          if (!tmpl) {
            return { action: 'KEEP', targetPrice: currentPrice, path, error: `未找到模板 ${node.templateId}` };
          }
          if (_templateStack.includes(node.templateId)) {
            return { action: 'KEEP', targetPrice: currentPrice, path, error: `模板循环引用: ${[..._templateStack, node.templateId].join(' → ')}` };
          }
          path.push(`${node.id}[${node.templateId}]`);
          const subResult = executeGraph(tmpl, ctx, {
            maxSteps: maxSteps - steps,
            templates,
            _templateStack: [..._templateStack, node.templateId],
          });
          subResult.path = [...path, ...subResult.path];
          return subResult;
        }

        case 'action': {
          let targetPrice = currentPrice;
          if (node.targetExpr) {
            targetPrice = evalExpr(node.targetExpr, ctx);
          }
          path.push(node.id);
          return { action: node.action, targetPrice, path };
        }

        default:
          return { action: 'KEEP', targetPrice: currentPrice, path, error: `未知节点类型 ${node.type}` };
      }
    } catch (err) {
      return { action: 'KEEP', targetPrice: currentPrice, path, error: `节点 ${node.id} 执行出错: ${err.message}` };
    }
  }

  return { action: 'KEEP', targetPrice: currentPrice, path, error: `超过步数上限 ${maxSteps}` };
}
