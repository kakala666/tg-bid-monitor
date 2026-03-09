import dagre from 'dagre';

// 引擎格式 → React Flow 格式
export function engineToFlow(engineGraph) {
  if (!engineGraph || !engineGraph.nodes) {
    return { nodes: [], edges: [] };
  }

  const nodes = engineGraph.nodes.map((n) => ({
    id: n.id,
    type: `strategy_${n.type}`,
    data: { ...n },
    position: { x: 0, y: 0 },
  }));

  const edges = engineGraph.edges.map((e, i) => ({
    id: `e-${e.from}-${e.to}-${i}`,
    source: e.from,
    target: e.to,
    sourceHandle: e.branch || 'default',
    label: e.branch === 'yes' ? '是' : e.branch === 'no' ? '否' : '',
    style: { stroke: e.branch === 'yes' ? '#2ECC71' : e.branch === 'no' ? '#E74C3C' : '#888' },
    labelStyle: { fill: '#ccc', fontSize: 11 },
    labelBgStyle: { fill: '#1A1A2E', fillOpacity: 0.8 },
  }));

  return autoLayout({ nodes, edges });
}

// React Flow 格式 → 引擎格式
export function flowToEngine(rfNodes, rfEdges) {
  const nodes = rfNodes.map((n) => {
    const { type, ...rest } = n.data;
    return rest;
  });

  const edges = rfEdges.map((e) => {
    const edge = { from: e.source, to: e.target };
    if (e.sourceHandle && e.sourceHandle !== 'default') {
      edge.branch = e.sourceHandle;
    }
    return edge;
  });

  return { nodes, edges };
}

// dagre 自动布局
export function autoLayout(flowData) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 });

  const nodeWidth = 180;
  const nodeHeight = 50;

  for (const node of flowData.nodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }
  for (const edge of flowData.edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutNodes = flowData.nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - nodeWidth / 2, y: pos.y - nodeHeight / 2 },
    };
  });

  return { nodes: layoutNodes, edges: flowData.edges };
}

// 生成唯一节点 ID
let idCounter = 0;
export function genNodeId(prefix = 'n') {
  return `${prefix}_${Date.now()}_${idCounter++}`;
}
