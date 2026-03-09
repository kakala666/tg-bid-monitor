const VALID_TYPES = ['start', 'condition', 'action', 'setVar', 'template'];
const VALID_ACTIONS = ['RAISE', 'LOWER', 'KEEP', 'SKIP'];

/**
 * 校验策略流程图的合法性
 * @param {{ nodes: Array, edges: Array }} graph
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateStrategy(graph) {
  const errors = [];
  const warnings = [];

  if (!graph || typeof graph !== 'object') {
    return { valid: false, errors: ['返回数据不是有效对象'], warnings };
  }

  const { nodes, edges } = graph;

  // --- 基本结构 ---
  if (!Array.isArray(nodes)) {
    errors.push('缺少 nodes 数组');
    return { valid: false, errors, warnings };
  }
  if (!Array.isArray(edges)) {
    errors.push('缺少 edges 数组');
    return { valid: false, errors, warnings };
  }
  if (nodes.length === 0) {
    errors.push('节点列表为空');
    return { valid: false, errors, warnings };
  }

  const nodeIds = new Set();

  // --- 节点校验 ---
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const prefix = `节点[${i}]`;

    if (!n.id) {
      errors.push(`${prefix}: 缺少 id`);
      continue;
    }
    if (nodeIds.has(n.id)) {
      errors.push(`${prefix}: id "${n.id}" 重复`);
    }
    nodeIds.add(n.id);

    if (!n.type) {
      errors.push(`${prefix} (${n.id}): 缺少 type`);
      continue;
    }
    if (!VALID_TYPES.includes(n.type)) {
      errors.push(`${prefix} (${n.id}): 无效类型 "${n.type}"，有效类型: ${VALID_TYPES.join(', ')}`);
      continue;
    }

    // 各类型字段校验
    if (n.type === 'condition') {
      if (!n.expr && n.expr !== '') {
        warnings.push(`${prefix} (${n.id}): 条件节点缺少 expr 表达式`);
      }
    } else if (n.type === 'action') {
      if (!n.action) {
        errors.push(`${prefix} (${n.id}): 动作节点缺少 action`);
      } else if (!VALID_ACTIONS.includes(n.action)) {
        errors.push(`${prefix} (${n.id}): 无效动作 "${n.action}"，有效动作: ${VALID_ACTIONS.join(', ')}`);
      }
      if ((n.action === 'RAISE' || n.action === 'LOWER') && !n.targetExpr) {
        warnings.push(`${prefix} (${n.id}): 加价/降价动作缺少 targetExpr 目标价表达式`);
      }
    } else if (n.type === 'setVar') {
      if (!n.varName) {
        warnings.push(`${prefix} (${n.id}): 变量节点缺少 varName`);
      }
      if (!n.expr) {
        warnings.push(`${prefix} (${n.id}): 变量节点缺少 expr 表达式`);
      }
    } else if (n.type === 'template') {
      if (!n.templateId) {
        warnings.push(`${prefix} (${n.id}): 模板引用缺少 templateId`);
      }
    }
  }

  // --- start 节点 ---
  const startNodes = nodes.filter((n) => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push('缺少开始节点 (type: "start")');
  } else if (startNodes.length > 1) {
    errors.push(`有 ${startNodes.length} 个开始节点，应该只有 1 个`);
  }

  // --- 边校验 ---
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const prefix = `边[${i}]`;

    if (!e.from) {
      errors.push(`${prefix}: 缺少 from`);
    } else if (!nodeIds.has(e.from)) {
      errors.push(`${prefix}: from 引用了不存在的节点 "${e.from}"`);
    }
    if (!e.to) {
      errors.push(`${prefix}: 缺少 to`);
    } else if (!nodeIds.has(e.to)) {
      errors.push(`${prefix}: to 引用了不存在的节点 "${e.to}"`);
    }
    if (e.branch && e.branch !== 'yes' && e.branch !== 'no') {
      errors.push(`${prefix}: 无效分支 "${e.branch}"，只允许 "yes" 或 "no"`);
    }
  }

  // --- 条件节点必须有 yes/no 出边 ---
  const conditionNodes = nodes.filter((n) => n.type === 'condition');
  for (const cn of conditionNodes) {
    const outEdges = edges.filter((e) => e.from === cn.id);
    const hasBranch = outEdges.some((e) => e.branch);
    if (hasBranch) {
      const hasYes = outEdges.some((e) => e.branch === 'yes');
      const hasNo = outEdges.some((e) => e.branch === 'no');
      if (!hasYes) warnings.push(`条件节点 "${cn.id}" 缺少 "是" 分支出边`);
      if (!hasNo) warnings.push(`条件节点 "${cn.id}" 缺少 "否" 分支出边`);
    } else if (outEdges.length === 0) {
      warnings.push(`条件节点 "${cn.id}" 没有出边（死路）`);
    }
  }

  // --- 孤立节点检测 ---
  if (startNodes.length > 0) {
    const startId = startNodes[0].id;
    const reachable = new Set([startId]);
    const queue = [startId];
    while (queue.length) {
      const cur = queue.shift();
      for (const e of edges) {
        if (e.from === cur && !reachable.has(e.to)) {
          reachable.add(e.to);
          queue.push(e.to);
        }
      }
    }
    const orphans = nodes.filter((n) => !reachable.has(n.id));
    if (orphans.length > 0) {
      warnings.push(`${orphans.length} 个节点从开始节点不可达: ${orphans.map((n) => n.id).join(', ')}`);
    }
  }

  // --- 叶子节点应该是动作节点 ---
  const actionNodes = nodes.filter((n) => n.type === 'action');
  if (actionNodes.length === 0) {
    warnings.push('没有动作节点，策略不会产生任何动作');
  }

  return { valid: errors.length === 0, errors, warnings };
}
