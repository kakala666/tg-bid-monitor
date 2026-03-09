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
import CallSplitIcon from '@mui/icons-material/CallSplit';
import FlagIcon from '@mui/icons-material/Flag';
import DataObjectIcon from '@mui/icons-material/DataObject';
import WidgetsIcon from '@mui/icons-material/Widgets';
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
