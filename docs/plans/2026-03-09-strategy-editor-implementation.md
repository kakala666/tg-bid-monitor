# 策略编辑器实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 V2 前端新增可视化流程图策略编辑器页面，让用户可以创建和编辑竞价策略

**Architecture:** 三栏布局 — 左栏策略列表（Tab 切换广告策略/模板）、中栏 React Flow 画布（右键添加节点、拖拽连线、自动布局）、右栏属性编辑面板（结构化表单+高级模式）。数据从 config 读取，编辑后保存回 config。

**Tech Stack:** React, MUI v6 (MD3), @xyflow/react (React Flow v12), dagre (自动布局)

---

### Task 1: 安装依赖 + 路由注册

**Files:**
- Modify: `src/web/v2/package.json`
- Modify: `src/web/v2/src/App.jsx`
- Modify: `src/web/v2/src/components/NavigationRail.jsx`
- Create: `src/web/v2/src/pages/Strategy.jsx` (占位)

**Step 1: 安装 React Flow 和 dagre**

```bash
cd /home/kaka/projectkaka/抢价格脚本/src/web/v2 && npm install @xyflow/react dagre
```

**Step 2: 创建占位 Strategy 页面**

`src/web/v2/src/pages/Strategy.jsx`:
```jsx
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function Strategy() {
  return (
    <Box sx={{ p: 2, height: '100vh' }}>
      <Typography variant="h6">策略编辑</Typography>
    </Box>
  );
}
```

**Step 3: 在 NavigationRail 添加第5个导航项**

在 `src/web/v2/src/components/NavigationRail.jsx` 的 import 中添加:
```jsx
import AccountTreeIcon from '@mui/icons-material/AccountTree';
```

在 `navItems` 数组中添加（插入在 Settings 之前）：
```jsx
{ path: '/strategy', label: '策略编辑', icon: <AccountTreeIcon /> },
```

**Step 4: 在 App.jsx 添加路由**

添加 import：
```jsx
import Strategy from './pages/Strategy';
```

在 Routes 中添加（在 `/settings` 之前）：
```jsx
<Route path="/strategy" element={<Strategy />} />
```

**Step 5: 验证**

```bash
cd /home/kaka/projectkaka/抢价格脚本/src/web/v2 && npm run build
```

Expected: 构建成功

**Step 6: 提交**

```bash
git add src/web/v2/
git commit -m "feat(editor): add Strategy page route and navigation"
```

---

### Task 2: 三栏布局骨架 + Tab 切换

**Files:**
- Modify: `src/web/v2/src/pages/Strategy.jsx`

实现三栏布局和 Tab 切换。此阶段画布和属性面板为占位。

**Step 1: 实现 Strategy 页面骨架**

`src/web/v2/src/pages/Strategy.jsx`:
```jsx
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import useStore from '../stores/useStore';

const LEFT_WIDTH = 200;
const RIGHT_WIDTH = 280;

export default function Strategy() {
  const config = useStore((s) => s.config);
  const [tabIndex, setTabIndex] = useState(0); // 0=广告策略, 1=策略模板
  const [selectedId, setSelectedId] = useState(null);

  // 从 config 提取列表
  const adStrategies = config.adStrategies || {};
  const adConfigs = config.adConfigs || {};
  const templates = config.strategyTemplates || {};

  // 广告策略列表：所有已配置的广告（不管有没有自定义策略）
  const adIds = Object.keys(adConfigs);
  const templateIds = Object.keys(templates);

  const currentList = tabIndex === 0 ? adIds : templateIds;

  // 选中第一个
  useEffect(() => {
    if (currentList.length > 0 && !currentList.includes(selectedId)) {
      setSelectedId(currentList[0]);
    }
  }, [tabIndex, currentList.length]);

  const handleAddTemplate = () => {
    const name = prompt('输入模板名称（英文，如 aggressive）：');
    if (!name) return;
    // 后续 Task 实现实际逻辑
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 顶部 Tab 栏 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)}>
          <Tab label="广告策略" />
          <Tab label="策略模板" />
        </Tabs>
      </Box>

      {/* 三栏主体 */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左栏：策略列表 */}
        <Box sx={{
          width: LEFT_WIDTH,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
        }}>
          <List sx={{ flex: 1, overflow: 'auto' }}>
            {currentList.map((id) => {
              const label = tabIndex === 0
                ? `${id}${adConfigs[id]?.note ? ` (${adConfigs[id].note})` : ''}`
                : templates[id]?.name || id;
              const hasCustom = tabIndex === 0 ? !!adStrategies[id] : true;
              return (
                <ListItemButton
                  key={id}
                  selected={selectedId === id}
                  onClick={() => setSelectedId(id)}
                >
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                    secondary={tabIndex === 0 && !hasCustom ? '默认策略' : null}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              );
            })}
          </List>
          {tabIndex === 1 && (
            <Box sx={{ p: 1 }}>
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddTemplate} fullWidth>
                新建模板
              </Button>
            </Box>
          )}
        </Box>

        {/* 中栏：画布占位 */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper' }}>
          <Typography color="text.secondary">
            {selectedId ? `编辑: ${selectedId}` : '请选择一个策略'}
          </Typography>
        </Box>

        {/* 右栏：属性面板占位 */}
        <Box sx={{
          width: RIGHT_WIDTH,
          borderLeft: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
          p: 2,
        }}>
          <Typography variant="subtitle2" color="text.secondary">
            属性面板
          </Typography>
          <Typography variant="caption" color="text.secondary">
            选中节点后在此编辑
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
```

**Step 2: 验证构建**

```bash
cd /home/kaka/projectkaka/抢价格脚本/src/web/v2 && npm run build
```

**Step 3: 提交**

```bash
git add src/web/v2/src/pages/Strategy.jsx
git commit -m "feat(editor): add three-column layout with tab switching"
```

---

### Task 3: React Flow 画布 + 数据转换

**Files:**
- Create: `src/web/v2/src/components/strategy/FlowCanvas.jsx`
- Create: `src/web/v2/src/components/strategy/flowUtils.js`
- Modify: `src/web/v2/src/pages/Strategy.jsx`

实现 React Flow 画布，将引擎格式的 `{ nodes, edges }` 转换为 React Flow 格式并渲染。

**Step 1: 创建数据转换工具**

`src/web/v2/src/components/strategy/flowUtils.js`:
```js
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
```

**Step 2: 创建自定义节点组件和画布**

`src/web/v2/src/components/strategy/FlowCanvas.jsx`:
```jsx
import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import FlagIcon from '@mui/icons-material/Flag';
import DataObjectIcon from '@mui/icons-material/DataObject';
import WidgetsIcon from '@mui/icons-material/Widgets';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { useState } from 'react';
import { autoLayout, genNodeId } from './flowUtils';
import StartNode from './nodes/StartNode';
import ConditionNode from './nodes/ConditionNode';
import ActionNode from './nodes/ActionNode';
import SetVarNode from './nodes/SetVarNode';
import TemplateNode from './nodes/TemplateNode';

const nodeTypes = {
  strategy_start: StartNode,
  strategy_condition: ConditionNode,
  strategy_action: ActionNode,
  strategy_setVar: SetVarNode,
  strategy_template: TemplateNode,
};

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  style: { strokeWidth: 2 },
};

export default function FlowCanvas({ nodes: initNodes, edges: initEdges, onNodesChange: onExtNodesChange, onEdgesChange: onExtEdgesChange, onNodeSelect }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);
  const [contextMenu, setContextMenu] = useState(null);
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useRef(null);

  // 同步到外部
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    onExtNodesChange?.(changes);
  }, [onNodesChange, onExtNodesChange]);

  const handleEdgesChange = useCallback((changes) => {
    onEdgesChange(changes);
    onExtEdgesChange?.(changes);
  }, [onEdgesChange, onExtEdgesChange]);

  const onConnect = useCallback((params) => {
    const edge = {
      ...params,
      id: `e-${params.source}-${params.target}-${Date.now()}`,
      label: params.sourceHandle === 'yes' ? '是' : params.sourceHandle === 'no' ? '否' : '',
      style: { stroke: params.sourceHandle === 'yes' ? '#2ECC71' : params.sourceHandle === 'no' ? '#E74C3C' : '#888', strokeWidth: 2 },
      labelStyle: { fill: '#ccc', fontSize: 11 },
      labelBgStyle: { fill: '#1A1A2E', fillOpacity: 0.8 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    };
    setEdges((eds) => addEdge(edge, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_, node) => {
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // 右键菜单
  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault();
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.current.screenToFlowPosition({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, flowPos: position });
  }, []);

  const handleCloseMenu = () => setContextMenu(null);

  const addNode = (type, data) => {
    const id = genNodeId(type);
    const newNode = {
      id,
      type: `strategy_${type}`,
      data: { id, type, ...data },
      position: contextMenu?.flowPos || { x: 250, y: 250 },
    };
    setNodes((nds) => [...nds, newNode]);
    handleCloseMenu();
  };

  const handleAutoLayout = useCallback(() => {
    const result = autoLayout({ nodes, edges });
    setNodes(result.nodes);
  }, [nodes, edges, setNodes]);

  return (
    <Box ref={reactFlowWrapper} sx={{ flex: 1, position: 'relative' }}>
      {/* 工具栏 */}
      <Box sx={{
        position: 'absolute', top: 8, right: 8, zIndex: 10,
        display: 'flex', gap: 0.5,
        bgcolor: 'background.paper', borderRadius: 2, px: 0.5, py: 0.5,
        border: 1, borderColor: 'divider',
      }}>
        <Tooltip title="自动布局">
          <IconButton size="small" onClick={handleAutoLayout}>
            <AutoFixHighIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onInit={(instance) => { reactFlowInstance.current = instance; }}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        deleteKeyCode="Delete"
        colorMode="dark"
      >
        <Background gap={20} size={1} color="#ffffff10" />
        <Controls position="bottom-left" />
      </ReactFlow>

      {/* 右键菜单 */}
      <Menu
        open={!!contextMenu}
        onClose={handleCloseMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={() => addNode('condition', { expr: '' })}>
          <ListItemIcon><CallSplitIcon fontSize="small" /></ListItemIcon>
          <ListItemText>条件节点</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => addNode('action', { action: 'KEEP' })}>
          <ListItemIcon><FlagIcon fontSize="small" /></ListItemIcon>
          <ListItemText>动作节点</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => addNode('setVar', { varName: '', expr: '' })}>
          <ListItemIcon><DataObjectIcon fontSize="small" /></ListItemIcon>
          <ListItemText>变量节点</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => addNode('template', { templateId: '' })}>
          <ListItemIcon><WidgetsIcon fontSize="small" /></ListItemIcon>
          <ListItemText>模板引用</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { handleAutoLayout(); handleCloseMenu(); }}>
          <ListItemIcon><AutoFixHighIcon fontSize="small" /></ListItemIcon>
          <ListItemText>自动布局</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
```

**Step 3: 在 Strategy 页面集成画布**

修改 `Strategy.jsx`，将中栏占位替换为 `<FlowCanvas>`。需要：
- import FlowCanvas 和 flowUtils
- 当 selectedId 变化时，加载对应的引擎数据，转换为 React Flow 格式
- 对于没有自定义策略的广告，调用 generateDefaultStrategy() 生成初始图

在 Strategy.jsx 中添加 import:
```jsx
import FlowCanvas from '../components/strategy/FlowCanvas';
import { engineToFlow, flowToEngine } from '../components/strategy/flowUtils';
```

添加状态和加载逻辑（在组件内）:
```jsx
const [flowData, setFlowData] = useState({ nodes: [], edges: [] });
const [selectedNode, setSelectedNode] = useState(null);

useEffect(() => {
  if (!selectedId) return;
  let engineGraph;
  if (tabIndex === 0) {
    engineGraph = adStrategies[selectedId] || null;
    // 没有自定义策略时使用默认策略（延迟导入避免循环）
    if (!engineGraph) {
      import('/src/strategy-v2/defaultStrategy.js').then(({ generateDefaultStrategy }) => {
        setFlowData(engineToFlow(generateDefaultStrategy()));
      });
      return;
    }
  } else {
    engineGraph = templates[selectedId] || null;
  }
  setFlowData(engineToFlow(engineGraph));
}, [selectedId, tabIndex]);
```

替换中栏占位为:
```jsx
{selectedId ? (
  <FlowCanvas
    key={`${tabIndex}-${selectedId}`}
    nodes={flowData.nodes}
    edges={flowData.edges}
    onNodeSelect={setSelectedNode}
  />
) : (
  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Typography color="text.secondary">请选择一个策略</Typography>
  </Box>
)}
```

注意：由于前端代码不能直接 import 后端的 `defaultStrategy.js`（不同 package），需要把 `generateDefaultStrategy` 函数复制到前端或通过 API 获取。最简方案：在前端创建一个副本 `src/web/v2/src/utils/defaultStrategy.js`，内容与 `src/strategy-v2/defaultStrategy.js` 相同。

**Step 4: 验证构建**

```bash
cd /home/kaka/projectkaka/抢价格脚本/src/web/v2 && npm run build
```

**Step 5: 提交**

```bash
git add src/web/v2/
git commit -m "feat(editor): add React Flow canvas with data conversion and auto-layout"
```

---

### Task 4: 自定义节点组件

**Files:**
- Create: `src/web/v2/src/components/strategy/nodes/StartNode.jsx`
- Create: `src/web/v2/src/components/strategy/nodes/ConditionNode.jsx`
- Create: `src/web/v2/src/components/strategy/nodes/ActionNode.jsx`
- Create: `src/web/v2/src/components/strategy/nodes/SetVarNode.jsx`
- Create: `src/web/v2/src/components/strategy/nodes/TemplateNode.jsx`

每个自定义节点遵循 MD3 视觉规范：Tonal Surface 风格背景，圆角 12px，使用 theme palette 色彩。

**Step 1: StartNode**

`src/web/v2/src/components/strategy/nodes/StartNode.jsx`:
```jsx
import { Handle, Position } from '@xyflow/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

export default function StartNode() {
  return (
    <Box sx={{
      px: 2, py: 1,
      borderRadius: 3,
      border: 2,
      borderColor: 'text.secondary',
      bgcolor: 'action.hover',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      minWidth: 80,
    }}>
      <PlayArrowIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
      <Typography variant="caption" fontWeight={600}>开始</Typography>
      <Handle type="source" position={Position.Bottom} id="default" style={{ background: '#888' }} />
    </Box>
  );
}
```

**Step 2: ConditionNode**

`src/web/v2/src/components/strategy/nodes/ConditionNode.jsx`:
```jsx
import { Handle, Position } from '@xyflow/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function ConditionNode({ data, selected }) {
  const summary = data.expr
    ? (data.expr.length > 25 ? data.expr.slice(0, 25) + '…' : data.expr)
    : '(未设置)';

  return (
    <Box sx={{
      px: 2, py: 1,
      borderRadius: 2,
      border: 2,
      borderColor: 'primary.main',
      bgcolor: selected ? 'primary.dark' : 'rgba(160, 196, 255, 0.08)',
      minWidth: 140,
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#A0C4FF' }} />
      <Typography variant="caption" color="primary.main" fontWeight={600} display="block">
        条件
      </Typography>
      <Typography variant="caption" color="text.primary" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
        {summary}
      </Typography>
      <Handle type="source" position={Position.Bottom} id="yes"
        style={{ background: '#2ECC71', left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="no"
        style={{ background: '#E74C3C', left: '70%' }} />
      {/* 是/否 标签 */}
      <Typography variant="caption" sx={{
        position: 'absolute', bottom: -16, left: '22%',
        color: 'success.main', fontSize: '0.6rem',
      }}>是</Typography>
      <Typography variant="caption" sx={{
        position: 'absolute', bottom: -16, left: '64%',
        color: 'error.main', fontSize: '0.6rem',
      }}>否</Typography>
    </Box>
  );
}
```

**Step 3: ActionNode**

`src/web/v2/src/components/strategy/nodes/ActionNode.jsx`:
```jsx
import { Handle, Position } from '@xyflow/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const ACTION_COLORS = {
  RAISE: { border: 'success.main', bg: 'rgba(46, 204, 113, 0.08)' },
  LOWER: { border: 'warning.main', bg: 'rgba(243, 156, 18, 0.08)' },
  KEEP: { border: 'text.secondary', bg: 'action.hover' },
  SKIP: { border: 'error.main', bg: 'rgba(231, 76, 60, 0.08)' },
};

export default function ActionNode({ data, selected }) {
  const colors = ACTION_COLORS[data.action] || ACTION_COLORS.KEEP;
  const targetSummary = data.targetExpr
    ? data.targetExpr.length > 20 ? data.targetExpr.slice(0, 20) + '…' : data.targetExpr
    : '';

  return (
    <Box sx={{
      px: 2, py: 1,
      borderRadius: 3,
      border: 2,
      borderColor: colors.border,
      bgcolor: selected ? 'action.selected' : colors.bg,
      minWidth: 120,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#888' }} />
      <Typography variant="caption" fontWeight={700} sx={{ color: colors.border }}>
        {data.action}
      </Typography>
      {targetSummary && (
        <Typography variant="caption" display="block" color="text.secondary"
          sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
          {targetSummary}
        </Typography>
      )}
    </Box>
  );
}
```

**Step 4: SetVarNode**

`src/web/v2/src/components/strategy/nodes/SetVarNode.jsx`:
```jsx
import { Handle, Position } from '@xyflow/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function SetVarNode({ data, selected }) {
  const summary = data.varName
    ? `${data.varName} = ${data.expr || '?'}`
    : '(未设置)';

  return (
    <Box sx={{
      px: 2, py: 1,
      borderRadius: 2,
      border: 2,
      borderColor: 'secondary.main',
      bgcolor: selected ? 'secondary.dark' : 'rgba(243, 156, 18, 0.08)',
      minWidth: 130,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#F39C12' }} />
      <Typography variant="caption" color="secondary.main" fontWeight={600} display="block">
        变量
      </Typography>
      <Typography variant="caption" color="text.primary"
        sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
        {summary.length > 25 ? summary.slice(0, 25) + '…' : summary}
      </Typography>
      <Handle type="source" position={Position.Bottom} id="default" style={{ background: '#F39C12' }} />
    </Box>
  );
}
```

**Step 5: TemplateNode**

`src/web/v2/src/components/strategy/nodes/TemplateNode.jsx`:
```jsx
import { Handle, Position } from '@xyflow/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import WidgetsIcon from '@mui/icons-material/Widgets';

export default function TemplateNode({ data, selected }) {
  return (
    <Box sx={{
      px: 2, py: 1,
      borderRadius: 2,
      border: 2,
      borderStyle: 'double',
      borderWidth: 3,
      borderColor: 'info.main',
      bgcolor: selected ? 'info.dark' : 'rgba(41, 182, 246, 0.08)',
      minWidth: 130,
      display: 'flex',
      alignItems: 'center',
      gap: 1,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#29B6F6' }} />
      <WidgetsIcon sx={{ fontSize: 14, color: 'info.main' }} />
      <Box>
        <Typography variant="caption" color="info.main" fontWeight={600} display="block">
          模板
        </Typography>
        <Typography variant="caption" color="text.primary">
          {data.templateId || '(未选择)'}
        </Typography>
      </Box>
    </Box>
  );
}
```

**Step 6: 验证构建**

```bash
cd /home/kaka/projectkaka/抢价格脚本/src/web/v2 && npm run build
```

**Step 7: 提交**

```bash
git add src/web/v2/src/components/strategy/
git commit -m "feat(editor): add custom MD3 node components for flow canvas"
```

---

### Task 5: 属性面板 — 结构化表单 + 高级模式

**Files:**
- Create: `src/web/v2/src/components/strategy/PropertyPanel.jsx`
- Modify: `src/web/v2/src/pages/Strategy.jsx`

选中节点后在右栏显示编辑表单。

**Step 1: 创建 PropertyPanel 组件**

`src/web/v2/src/components/strategy/PropertyPanel.jsx`:
```jsx
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';

const VARIABLES = [
  { value: 'myAd.rank', label: '我的排名' },
  { value: 'myAd.price', label: '我的价格' },
  { value: 'above.price', label: '上方价格' },
  { value: 'above.rank', label: '上方排名' },
  { value: 'below.price', label: '下方价格' },
  { value: 'below.rank', label: '下方排名' },
  { value: 'budgetLimit', label: '预算上限' },
  { value: 'gapThreshold', label: '价差阈值' },
  { value: 'rankLimit', label: '排名上限' },
  { value: 'rankings.length', label: '排名总数' },
];

const COMPARE_OPS = ['>', '<', '>=', '<=', '==', '!='];
const MATH_OPS = ['+', '-', '*', '/'];

// 尝试将表达式解析为结构化格式
function parseStructured(expr) {
  if (!expr) return null;
  // 匹配 "left op right" 格式
  const m = expr.match(/^(.+?)\s*(>=|<=|!=|==|>|<)\s*(.+)$/);
  if (m) return { left: m[1].trim(), op: m[2], right: m[3].trim() };
  return null;
}

function parseTargetExpr(expr) {
  if (!expr) return null;
  const m = expr.match(/^(.+?)\s*([+\-*/])\s*(.+)$/);
  if (m) return { base: m[1].trim(), op: m[2], value: m[3].trim() };
  return null;
}

export default function PropertyPanel({ node, onNodeDataChange, templateIds }) {
  if (!node) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">属性面板</Typography>
        <Typography variant="caption" color="text.secondary">
          选中节点后在此编辑
        </Typography>
      </Box>
    );
  }

  const data = node.data;
  const nodeType = data.type;

  const updateData = (field, value) => {
    onNodeDataChange(node.id, { ...data, [field]: value });
  };

  return (
    <Box sx={{ p: 2, overflow: 'auto', height: '100%' }}>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        {nodeType === 'condition' ? '条件节点' :
         nodeType === 'action' ? '动作节点' :
         nodeType === 'setVar' ? '变量节点' :
         nodeType === 'template' ? '模板引用' : '开始节点'}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        ID: {data.id}
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {nodeType === 'start' && (
        <Typography variant="body2" color="text.secondary">
          开始节点为流程入口，无需配置
        </Typography>
      )}

      {nodeType === 'condition' && (
        <ConditionEditor expr={data.expr || ''} onChange={(v) => updateData('expr', v)} />
      )}

      {nodeType === 'action' && (
        <ActionEditor
          action={data.action || 'KEEP'}
          targetExpr={data.targetExpr || ''}
          onActionChange={(v) => updateData('action', v)}
          onTargetChange={(v) => updateData('targetExpr', v)}
        />
      )}

      {nodeType === 'setVar' && (
        <SetVarEditor
          varName={data.varName || ''}
          expr={data.expr || ''}
          onNameChange={(v) => updateData('varName', v)}
          onExprChange={(v) => updateData('expr', v)}
        />
      )}

      {nodeType === 'template' && (
        <TemplateEditor
          templateId={data.templateId || ''}
          templateIds={templateIds || []}
          onChange={(v) => updateData('templateId', v)}
        />
      )}
    </Box>
  );
}

function ConditionEditor({ expr, onChange }) {
  const [advanced, setAdvanced] = useState(false);
  const parsed = parseStructured(expr);

  // 如果表达式无法解析为结构化，强制高级模式
  useEffect(() => {
    if (expr && !parsed && !advanced) setAdvanced(true);
  }, [expr]);

  const [left, setLeft] = useState(parsed?.left || '');
  const [op, setOp] = useState(parsed?.op || '>');
  const [right, setRight] = useState(parsed?.right || '');

  const syncExpr = (l, o, r) => {
    if (l && r) onChange(`${l} ${o} ${r}`);
  };

  if (advanced) {
    return (
      <Box>
        <FormControlLabel
          control={<Switch checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} size="small" />}
          label={<Typography variant="caption">高级模式</Typography>}
          sx={{ mb: 1 }}
        />
        <TextField
          label="条件表达式"
          value={expr}
          onChange={(e) => onChange(e.target.value)}
          fullWidth size="small" multiline rows={2}
          sx={{ fontFamily: 'monospace' }}
          placeholder="例: myAd.rank > 3 && above.price < budgetLimit"
        />
        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {VARIABLES.map((v) => (
            <Chip key={v.value} label={v.label} size="small" variant="outlined"
              onClick={() => onChange(expr ? `${expr} ${v.value}` : v.value)}
              sx={{ fontSize: '0.65rem' }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <FormControlLabel
        control={<Switch checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} size="small" />}
        label={<Typography variant="caption">高级模式</Typography>}
        sx={{ mb: 1 }}
      />
      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel>左值</InputLabel>
        <Select value={left} label="左值" onChange={(e) => { setLeft(e.target.value); syncExpr(e.target.value, op, right); }}>
          {VARIABLES.map((v) => (
            <MenuItem key={v.value} value={v.value}>{v.label} ({v.value})</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel>运算符</InputLabel>
        <Select value={op} label="运算符" onChange={(e) => { setOp(e.target.value); syncExpr(left, e.target.value, right); }}>
          {COMPARE_OPS.map((o) => (
            <MenuItem key={o} value={o}>{o}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField label="右值" value={right} size="small" fullWidth
        onChange={(e) => { setRight(e.target.value); syncExpr(left, op, e.target.value); }}
        placeholder="数字或变量名"
      />
    </Box>
  );
}

function ActionEditor({ action, targetExpr, onActionChange, onTargetChange }) {
  const [advanced, setAdvanced] = useState(false);
  const parsed = parseTargetExpr(targetExpr);
  const [base, setBase] = useState(parsed?.base || 'above.price');
  const [op, setOp] = useState(parsed?.op || '+');
  const [val, setVal] = useState(parsed?.value || '1');

  const showTarget = action === 'RAISE' || action === 'LOWER';

  const syncTarget = (b, o, v) => {
    if (b && v) onTargetChange(`${b} ${o} ${v}`);
  };

  useEffect(() => {
    if (targetExpr && !parsed && !advanced) setAdvanced(true);
  }, [targetExpr]);

  return (
    <Box>
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>动作类型</InputLabel>
        <Select value={action} label="动作类型" onChange={(e) => onActionChange(e.target.value)}>
          <MenuItem value="RAISE">RAISE (加价)</MenuItem>
          <MenuItem value="LOWER">LOWER (降价)</MenuItem>
          <MenuItem value="KEEP">KEEP (保持)</MenuItem>
          <MenuItem value="SKIP">SKIP (跳过)</MenuItem>
        </Select>
      </FormControl>

      {showTarget && (
        <>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            目标价格
          </Typography>
          <FormControlLabel
            control={<Switch checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} size="small" />}
            label={<Typography variant="caption">高级模式</Typography>}
            sx={{ mb: 1 }}
          />
          {advanced ? (
            <TextField label="目标价表达式" value={targetExpr} onChange={(e) => onTargetChange(e.target.value)}
              fullWidth size="small" sx={{ fontFamily: 'monospace' }}
              placeholder="例: above.price + 1" />
          ) : (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <FormControl size="small" sx={{ flex: 2 }}>
                <InputLabel>基准</InputLabel>
                <Select value={base} label="基准" onChange={(e) => { setBase(e.target.value); syncTarget(e.target.value, op, val); }}>
                  {VARIABLES.filter(v => v.value.includes('price') || v.value === 'budgetLimit').map((v) => (
                    <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ width: 60 }}>
                <Select value={op} onChange={(e) => { setOp(e.target.value); syncTarget(base, e.target.value, val); }}>
                  {MATH_OPS.map((o) => (<MenuItem key={o} value={o}>{o}</MenuItem>))}
                </Select>
              </FormControl>
              <TextField value={val} size="small" sx={{ width: 60 }}
                onChange={(e) => { setVal(e.target.value); syncTarget(base, op, e.target.value); }} />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

function SetVarEditor({ varName, expr, onNameChange, onExprChange }) {
  const [advanced, setAdvanced] = useState(false);

  return (
    <Box>
      <TextField label="变量名" value={varName} onChange={(e) => onNameChange(e.target.value)}
        fullWidth size="small" sx={{ mb: 2 }} placeholder="例: gap" />
      <FormControlLabel
        control={<Switch checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} size="small" />}
        label={<Typography variant="caption">高级模式</Typography>}
        sx={{ mb: 1 }}
      />
      {advanced ? (
        <TextField label="值表达式" value={expr} onChange={(e) => onExprChange(e.target.value)}
          fullWidth size="small" multiline rows={2} sx={{ fontFamily: 'monospace' }}
          placeholder="例: myAd.price - below.price" />
      ) : (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ flex: 2 }}>
            <InputLabel>左值</InputLabel>
            <Select value="" label="左值" onChange={(e) => onExprChange(e.target.value)}>
              {VARIABLES.map((v) => (
                <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2">=</Typography>
          <TextField value={expr} size="small" sx={{ flex: 2 }}
            onChange={(e) => onExprChange(e.target.value)} placeholder="表达式" />
        </Box>
      )}
    </Box>
  );
}

function TemplateEditor({ templateId, templateIds, onChange }) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>选择模板</InputLabel>
      <Select value={templateId} label="选择模板" onChange={(e) => onChange(e.target.value)}>
        {templateIds.map((id) => (
          <MenuItem key={id} value={id}>{id}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
```

**Step 2: 在 Strategy.jsx 右栏替换占位为 PropertyPanel**

替换右栏占位内容为:
```jsx
import PropertyPanel from '../components/strategy/PropertyPanel';

// 右栏
<Box sx={{
  width: RIGHT_WIDTH,
  borderLeft: 1,
  borderColor: 'divider',
  bgcolor: 'background.default',
}}>
  <PropertyPanel
    node={selectedNode}
    onNodeDataChange={handleNodeDataChange}
    templateIds={templateIds}
  />
</Box>
```

添加 handleNodeDataChange 函数（在 Strategy 组件内），用于将属性面板的修改同步回 React Flow 节点:
```jsx
const handleNodeDataChange = useCallback((nodeId, newData) => {
  // 更新 FlowCanvas 中的节点数据 — 需要通过 ref 或状态提升
  // 具体实现在此 Task 完成
}, []);
```

**Step 3: 验证构建**

```bash
cd /home/kaka/projectkaka/抢价格脚本/src/web/v2 && npm run build
```

**Step 4: 提交**

```bash
git add src/web/v2/
git commit -m "feat(editor): add PropertyPanel with structured and advanced expression editors"
```

---

### Task 6: 状态管理整合 — 节点编辑 + 保存

**Files:**
- Modify: `src/web/v2/src/pages/Strategy.jsx`
- Modify: `src/web/v2/src/components/strategy/FlowCanvas.jsx`
- Modify: `src/web/v2/src/stores/useStore.js`

将编辑器的状态管理打通：属性面板修改 → 画布更新 → 保存到 config。

**Step 1: 提升 Flow 状态到 Strategy 页面**

将 `useNodesState` / `useEdgesState` 从 FlowCanvas 内部移到 Strategy.jsx，FlowCanvas 改为受控组件接收 nodes/edges 和 onChange 回调。

修改 `FlowCanvas.jsx`：移除内部 `useNodesState`/`useEdgesState`，改为接收 props:
```jsx
// Props: nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeSelect
// 内部不再维护自己的 nodes/edges 状态
```

修改 `Strategy.jsx`：使用 `useNodesState`/`useEdgesState` 管理状态，传给 FlowCanvas。

**Step 2: 实现 handleNodeDataChange**

```jsx
const handleNodeDataChange = useCallback((nodeId, newData) => {
  setNodes((nds) =>
    nds.map((n) => n.id === nodeId ? { ...n, data: newData } : n)
  );
  // 同步 selectedNode
  setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, data: newData } : prev);
}, [setNodes]);
```

**Step 3: 在 useStore 添加策略保存方法**

在 `src/web/v2/src/stores/useStore.js` 添加:
```js
async saveStrategy(adId, graph) {
  const cfg = { ...get().config };
  if (!cfg.adStrategies) cfg.adStrategies = {};
  cfg.adStrategies[adId] = graph;
  return get().saveConfig(cfg);
},

async saveTemplate(templateId, name, graph) {
  const cfg = { ...get().config };
  if (!cfg.strategyTemplates) cfg.strategyTemplates = {};
  cfg.strategyTemplates[templateId] = { name, ...graph };
  return get().saveConfig(cfg);
},

async deleteTemplate(templateId) {
  const cfg = { ...get().config };
  if (cfg.strategyTemplates) {
    delete cfg.strategyTemplates[templateId];
  }
  return get().saveConfig(cfg);
},
```

**Step 4: 在 Strategy.jsx 添加保存按钮**

在 Tab 栏右侧添加保存按钮:
```jsx
import SaveIcon from '@mui/icons-material/Save';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

// 保存当前编辑的策略
const handleSave = async () => {
  const engineData = flowToEngine(nodes, edges);
  let result;
  if (tabIndex === 0) {
    result = await saveStrategy(selectedId, engineData);
  } else {
    const name = templates[selectedId]?.name || selectedId;
    result = await saveTemplate(selectedId, name, engineData);
  }
  setSnack({
    open: true,
    message: result?.ok ? '策略已保存' : '保存失败',
    severity: result?.ok ? 'success' : 'error',
  });
};
```

**Step 5: 验证构建**

```bash
cd /home/kaka/projectkaka/抢价格脚本/src/web/v2 && npm run build
```

**Step 6: 提交**

```bash
git add src/web/v2/
git commit -m "feat(editor): integrate state management, node editing, and save"
```

---

### Task 7: 模板管理 + defaultStrategy 前端副本

**Files:**
- Create: `src/web/v2/src/utils/defaultStrategy.js`
- Modify: `src/web/v2/src/pages/Strategy.jsx`

**Step 1: 创建 defaultStrategy 前端副本**

将 `src/strategy-v2/defaultStrategy.js` 的 `generateDefaultStrategy` 函数复制到 `src/web/v2/src/utils/defaultStrategy.js`。内容完全相同。

**Step 2: 实现新建模板功能**

在 Strategy.jsx 的 `handleAddTemplate` 中：
```jsx
const handleAddTemplate = () => {
  const name = prompt('输入模板名称（英文ID，如 aggressive）：');
  if (!name) return;
  const displayName = prompt('输入显示名称（如 激进策略）：') || name;
  // 创建空模板（只有 start 节点）
  const graph = {
    nodes: [{ id: 'start', type: 'start' }],
    edges: [],
  };
  saveTemplate(name, displayName, graph).then(() => {
    setTabIndex(1);
    setSelectedId(name);
  });
};
```

**Step 3: 实现删除模板**

在左栏列表项右侧添加删除按钮（仅模板 Tab），调用 `deleteTemplate`。

**Step 4: 验证构建**

```bash
cd /home/kaka/projectkaka/抢价格脚本/src/web/v2 && npm run build
```

**Step 5: 提交**

```bash
git add src/web/v2/
git commit -m "feat(editor): add template management and defaultStrategy frontend copy"
```

---

### Task 8: 构建验证 + 样式微调

**Files:**
- Modify: 各组件文件（按需微调样式）

**Step 1: 运行生产构建**

```bash
cd /home/kaka/projectkaka/抢价格脚本/src/web/v2 && npm run build
```

**Step 2: 启动后端验证**

```bash
cd /home/kaka/projectkaka/抢价格脚本 && node src/index.js
```

验证:
- `/v2/strategy` 页面可正常打开
- 左侧列表显示已配置的广告
- 点击广告后画布显示流程图（默认策略自动布局）
- 右键菜单可添加节点
- 选中节点后右栏显示属性面板
- 保存按钮可正常工作

**Step 3: 修复发现的问题**

根据实际测试情况修复问题。

**Step 4: 最终构建和提交**

```bash
cd /home/kaka/projectkaka/抢价格脚本/src/web/v2 && npm run build
git add src/web/v2/
git commit -m "feat(editor): finalize strategy editor with style fixes"
```
