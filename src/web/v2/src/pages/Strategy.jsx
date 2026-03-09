import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import RateReviewIcon from '@mui/icons-material/RateReview';
import SendIcon from '@mui/icons-material/Send';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import useStore from '../stores/useStore';
import FlowCanvas from '../components/strategy/FlowCanvas';
import PropertyPanel from '../components/strategy/PropertyPanel';
import { engineToFlow, flowToEngine } from '../components/strategy/flowUtils';
import { generateDefaultStrategy } from '../utils/defaultStrategy';
import { buildChatInitMessages, chatAboutStrategy, generateStrategy, fixStrategy, reviewStrategy, regenerateStrategy, describeGraph } from '../utils/aiSummarize';
import { validateStrategy } from '../utils/validateStrategy';

const LEFT_WIDTH = 200;
const RIGHT_WIDTH = 280;

function AttemptSummary({ attempt }) {
  const { index, validation, review, error, auto, phase } = attempt;
  const label = auto ? `第 ${index} 次（自动修复）` : `第 ${index} 次`;

  if (error) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
        <ErrorIcon sx={{ fontSize: 16 }} color="error" />
        <Typography variant="caption" color="error">{label}：请求失败 - {error}</Typography>
      </Box>
    );
  }

  // AI 评审结果
  if (phase === 'review') {
    if (review?.pass) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
          <RateReviewIcon sx={{ fontSize: 16 }} color="success" />
          <Typography variant="caption" color="success.main">{label}：AI 评审通过</Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ py: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RateReviewIcon sx={{ fontSize: 16 }} color="warning" />
          <Typography variant="caption" color="warning.main">{label}：AI 评审不达标</Typography>
        </Box>
        {review?.issues?.length > 0 && (
          <Box sx={{ pl: 3 }}>
            {review.issues.map((issue, i) => (
              <Typography key={i} variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.65rem' }}>• {issue}</Typography>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // 结构校验结果
  const errCount = validation?.errors?.length || 0;
  const warnCount = validation?.warnings?.length || 0;

  if (validation?.valid) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
        <CheckCircleIcon sx={{ fontSize: 16 }} color="success" />
        <Typography variant="caption" color="success.main">
          {label}：结构校验通过{warnCount > 0 ? `（${warnCount} 个警告）` : ''}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
      <ErrorIcon sx={{ fontSize: 16 }} color="error" />
      <Typography variant="caption" color="error">
        {label}：{errCount} 个错误{warnCount > 0 ? `，${warnCount} 个警告` : ''}
      </Typography>
    </Box>
  );
}

export default function Strategy() {
  const config = useStore((s) => s.config);
  const saveConfig = useStore((s) => s.saveConfig);
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [flowData, setFlowData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  // AI 对话：messages 是完整的对话历史（含 system），chatMessages 是展示用的（不含 system）
  const [aiDialog, setAiDialog] = useState({ open: false, loading: false, messages: [], chatMessages: [], input: '' });
  const chatEndRef = useRef(null);
  const [genDialog, setGenDialog] = useState({
    open: false,
    step: 'input', // 'input' | 'loading' | 'review'
    prompt: '',
    result: null,       // 引擎格式的图
    validation: null,   // { valid, errors, warnings }
    aiReview: null,     // { pass, summary, issues, suggestions }
    error: null,
    attempts: [],       // [{ result, validation, review, error, auto, phase }] 每次尝试的记录
  });
  const canvasRef = useRef(null);

  // 对话消息变化时自动滚到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiDialog.chatMessages.length, aiDialog.loading]);

  const adStrategies = config.adStrategies || {};
  const adConfigs = config.adConfigs || {};
  const templates = config.strategyTemplates || {};

  const adIds = Object.keys(adConfigs);
  const templateIds = Object.keys(templates);
  const currentList = tabIndex === 0 ? adIds : templateIds;

  useEffect(() => {
    if (currentList.length > 0 && !currentList.includes(selectedId)) {
      setSelectedId(currentList[0]);
    }
  }, [tabIndex, currentList.length]);

  useEffect(() => {
    if (!selectedId) return;
    let engineGraph;
    if (tabIndex === 0) {
      engineGraph = adStrategies[selectedId] || null;
      if (!engineGraph) {
        setFlowData(engineToFlow(generateDefaultStrategy()));
        return;
      }
    } else {
      engineGraph = templates[selectedId] || null;
    }
    setFlowData(engineToFlow(engineGraph));
    setSelectedNode(null);
  }, [selectedId, tabIndex]);

  // 收集选中节点的上游祖先 SetVar 节点定义的变量（去重）
  const getCustomVars = useCallback(() => {
    if (!selectedNode) return [];
    const nodes = canvasRef.current?.getNodes() || flowData.nodes;
    const edges = canvasRef.current?.getEdges() || flowData.edges;
    const ancestorIds = new Set();
    const queue = [selectedNode.id];
    while (queue.length) {
      const cur = queue.shift();
      for (const e of edges) {
        if (e.target === cur && !ancestorIds.has(e.source)) {
          ancestorIds.add(e.source);
          queue.push(e.source);
        }
      }
    }
    const seen = new Set();
    const vars = [];
    for (const n of nodes) {
      if (ancestorIds.has(n.id) && n.data?.type === 'setVar' && n.data?.varName && !seen.has(n.data.varName)) {
        seen.add(n.data.varName);
        vars.push({ value: `vars.${n.data.varName}`, label: n.data.varName });
      }
    }
    return vars;
  }, [flowData.nodes, flowData.edges, selectedNode]);

  // 属性面板修改节点数据
  const handleNodeDataChange = useCallback((nodeId, newData) => {
    canvasRef.current?.updateNodeData(nodeId, newData);
    setSelectedNode((prev) =>
      prev?.id === nodeId ? { ...prev, data: newData } : prev
    );
  }, []);

  // 保存策略
  const handleSave = async () => {
    const currentNodes = canvasRef.current?.getNodes() || flowData.nodes;
    const currentEdges = canvasRef.current?.getEdges() || flowData.edges;
    const engineData = flowToEngine(currentNodes, currentEdges);
    const cfg = JSON.parse(JSON.stringify(config));

    if (tabIndex === 0) {
      if (!cfg.adStrategies) cfg.adStrategies = {};
      cfg.adStrategies[selectedId] = engineData;
    } else {
      if (!cfg.strategyTemplates) cfg.strategyTemplates = {};
      const name = cfg.strategyTemplates[selectedId]?.name || selectedId;
      cfg.strategyTemplates[selectedId] = { name, ...engineData };
    }

    const result = await saveConfig(cfg);
    setSnack({
      open: true,
      message: result?.ok ? '策略已保存' : '保存失败',
      severity: result?.ok ? 'success' : 'error',
    });
  };

  const handleAddTemplate = () => {
    const id = prompt('输入模板ID（英文，如 aggressive）：');
    if (!id) return;
    const name = prompt('输入显示名称（如 激进策略）：') || id;
    const cfg = JSON.parse(JSON.stringify(config));
    if (!cfg.strategyTemplates) cfg.strategyTemplates = {};
    cfg.strategyTemplates[id] = {
      name,
      nodes: [{ id: 'start', type: 'start' }],
      edges: [],
    };
    saveConfig(cfg).then(() => {
      setTabIndex(1);
      setSelectedId(id);
    });
  };

  // 流式 AI 对话的通用发送逻辑
  const streamAiChat = async (allMessages, displayMessages) => {
    // 先追加一条空的 assistant 消息占位
    const assistantIdx = displayMessages.length;
    setAiDialog((prev) => ({
      ...prev,
      loading: true,
      chatMessages: [...displayMessages, { role: 'assistant', content: '' }],
    }));

    try {
      const full = await chatAboutStrategy(allMessages, (partial) => {
        // 流式更新最后一条 assistant 消息
        setAiDialog((prev) => {
          const updated = [...prev.chatMessages];
          updated[assistantIdx] = { role: 'assistant', content: partial };
          return { ...prev, chatMessages: updated };
        });
      });
      // 完成：更新 messages 历史（用于后续多轮）
      setAiDialog((prev) => {
        const updated = [...prev.chatMessages];
        updated[assistantIdx] = { role: 'assistant', content: full };
        return {
          ...prev,
          loading: false,
          messages: [...allMessages, { role: 'assistant', content: full }],
          chatMessages: updated,
        };
      });
    } catch (e) {
      setAiDialog((prev) => {
        const updated = [...prev.chatMessages];
        updated[assistantIdx] = { role: 'assistant', content: `错误: ${e.message}` };
        return { ...prev, loading: false, chatMessages: updated };
      });
    }
  };

  // AI 对话 — 打开时自动发送初始分析
  const handleAiSummarize = async () => {
    const nodes = canvasRef.current?.getNodes() || flowData.nodes;
    const edges = canvasRef.current?.getEdges() || flowData.edges;
    const initMessages = buildChatInitMessages(nodes, edges);
    const displayMessages = [{ role: 'user', content: '请分析当前策略' }];

    setAiDialog({
      open: true, loading: false, input: '',
      messages: initMessages,
      chatMessages: displayMessages,
    });

    await streamAiChat(initMessages, displayMessages);
  };

  // AI 对话 — 发送用户消息
  const handleAiChatSend = async () => {
    const text = aiDialog.input.trim();
    if (!text || aiDialog.loading) return;

    const userMsg = { role: 'user', content: text };
    const newMessages = [...aiDialog.messages, userMsg];
    const newDisplay = [...aiDialog.chatMessages, userMsg];

    setAiDialog((prev) => ({
      ...prev,
      input: '',
      messages: newMessages,
      chatMessages: newDisplay,
    }));

    await streamAiChat(newMessages, newDisplay);
  };

  const MAX_AUTO_RETRY = 3;

  // AI 生成/修改
  const openGenDialog = () => {
    setGenDialog({ open: true, step: 'input', prompt: '', result: null, validation: null, aiReview: null, error: null, attempts: [] });
  };

  const handleGenerate = async () => {
    const prompt = genDialog.prompt.trim();
    if (!prompt) return;

    setGenDialog((prev) => ({ ...prev, step: 'loading', error: null, aiReview: null, attempts: [] }));

    const currentNodes = canvasRef.current?.getNodes() || flowData.nodes;
    const currentEdges = canvasRef.current?.getEdges() || flowData.edges;
    const currentGraph = flowToEngine(currentNodes, currentEdges);

    let lastGraph = null;
    let lastValidation = null;
    let lastReview = null;
    let attemptIndex = 0;

    // 阶段1：生成 + 结构校验（含自动修复）
    for (let fix = 0; fix <= MAX_AUTO_RETRY; fix++) {
      attemptIndex++;
      try {
        let graph;
        if (fix === 0) {
          graph = await generateStrategy(prompt, currentGraph);
        } else {
          setGenDialog((prev) => ({ ...prev, step: 'loading' }));
          graph = await fixStrategy(lastGraph, lastValidation.errors, lastValidation.warnings);
        }

        const validation = validateStrategy(graph);
        lastGraph = graph;
        lastValidation = validation;

        setGenDialog((prev) => ({
          ...prev,
          attempts: [...prev.attempts, {
            index: attemptIndex, result: graph, validation, review: null,
            error: null, auto: fix > 0, phase: 'validate',
          }],
          result: graph, validation, error: null,
        }));

        if (validation.valid) break;

        if (fix === MAX_AUTO_RETRY) {
          setGenDialog((prev) => ({ ...prev, step: 'review' }));
          return;
        }
      } catch (e) {
        setGenDialog((prev) => ({
          ...prev,
          attempts: [...prev.attempts, {
            index: attemptIndex, result: null, validation: null, review: null,
            error: e.message, auto: fix > 0, phase: 'validate',
          }],
          result: null, validation: null, error: e.message, step: 'review',
        }));
        return;
      }
    }

    // 阶段2：AI 评审 + 不达标则重新生成（循环）
    for (let reviewRound = 0; reviewRound <= MAX_AUTO_RETRY; reviewRound++) {
      // AI 评审
      try {
        setGenDialog((prev) => ({ ...prev, step: 'loading' }));
        const review = await reviewStrategy(lastGraph, prompt, currentGraph);
        lastReview = review;
        attemptIndex++;

        setGenDialog((prev) => ({
          ...prev,
          attempts: [...prev.attempts, {
            index: attemptIndex, result: lastGraph, validation: lastValidation,
            review, error: null, auto: reviewRound > 0, phase: 'review',
          }],
          aiReview: review,
        }));

        if (review.pass) {
          setGenDialog((prev) => ({ ...prev, step: 'review' }));
          return;
        }

        // 最后一轮评审仍不达标
        if (reviewRound === MAX_AUTO_RETRY) {
          setGenDialog((prev) => ({ ...prev, step: 'review' }));
          return;
        }
      } catch (e) {
        // 评审请求失败，视为通过（不阻塞用户）
        setGenDialog((prev) => ({
          ...prev,
          aiReview: { pass: true, summary: '评审请求失败，跳过评审', issues: [], suggestions: [] },
          step: 'review',
        }));
        return;
      }

      // 根据评审反馈重新生成
      attemptIndex++;
      try {
        setGenDialog((prev) => ({ ...prev, step: 'loading' }));
        const newGraph = await regenerateStrategy(prompt, currentGraph, lastGraph, lastReview);
        const validation = validateStrategy(newGraph);

        setGenDialog((prev) => ({
          ...prev,
          attempts: [...prev.attempts, {
            index: attemptIndex, result: newGraph, validation, review: null,
            error: null, auto: true, phase: 'validate',
          }],
          result: newGraph, validation,
        }));

        if (!validation.valid) {
          // 结构也不通过，尝试修复一次
          try {
            const fixedGraph = await fixStrategy(newGraph, validation.errors, validation.warnings);
            const fixedValidation = validateStrategy(fixedGraph);
            attemptIndex++;
            setGenDialog((prev) => ({
              ...prev,
              attempts: [...prev.attempts, {
                index: attemptIndex, result: fixedGraph, validation: fixedValidation, review: null,
                error: null, auto: true, phase: 'validate',
              }],
              result: fixedGraph, validation: fixedValidation,
            }));
            if (fixedValidation.valid) {
              lastGraph = fixedGraph;
              lastValidation = fixedValidation;
            } else {
              setGenDialog((prev) => ({ ...prev, step: 'review' }));
              return;
            }
          } catch (e) {
            setGenDialog((prev) => ({ ...prev, step: 'review' }));
            return;
          }
        } else {
          lastGraph = newGraph;
          lastValidation = validation;
        }
      } catch (e) {
        setGenDialog((prev) => ({
          ...prev,
          attempts: [...prev.attempts, {
            index: attemptIndex, result: null, validation: null, review: null,
            error: e.message, auto: true, phase: 'validate',
          }],
          error: e.message, step: 'review',
        }));
        return;
      }
    }
  };

  // 应用 AI 生成的策略到画布
  const handleApplyGenerated = () => {
    if (!genDialog.result || !genDialog.validation?.valid) return;
    const newFlowData = engineToFlow(genDialog.result);
    setFlowData(newFlowData);
    setSelectedNode(null);
    setGenDialog((prev) => ({ ...prev, open: false }));
    setSnack({ open: true, message: 'AI 策略已应用到画布（未保存）', severity: 'info' });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 顶部 Tab 栏 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, display: 'flex', alignItems: 'center' }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ flex: 1 }}>
          <Tab label="广告策略" />
          <Tab label="策略模板" />
        </Tabs>
        {selectedId && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" size="small" startIcon={<SmartToyIcon />} onClick={openGenDialog}>
              AI 生成
            </Button>
            <Button variant="outlined" size="small" startIcon={<AutoAwesomeIcon />} onClick={handleAiSummarize}>
              AI 总结
            </Button>
            <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSave}>
              保存
            </Button>
          </Box>
        )}
      </Box>

      {/* 三栏主体 */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左栏 */}
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

        {/* 中栏：画布 */}
        {selectedId ? (
          <FlowCanvas
            ref={canvasRef}
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

        {/* 右栏：属性面板 */}
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
            customVars={getCustomVars()}
          />
        </Box>
      </Box>

      {/* AI 对话弹窗 */}
      <Dialog
        open={aiDialog.open}
        onClose={() => !aiDialog.loading && setAiDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon color="primary" />
          AI 策略分析
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column', height: 450 }}>
          {/* 消息列表 */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {aiDialog.chatMessages.map((msg, i) => (
              <Box key={i} sx={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                mb: 1.5,
              }}>
                <Box sx={{
                  maxWidth: '85%',
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: msg.role === 'user' ? 'primary.main' : 'action.hover',
                  color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                }}>
                  {msg.role === 'assistant' && !msg.content && aiDialog.loading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={14} />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>思考中...</Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.8rem' }}>
                      {msg.content}{msg.role === 'assistant' && aiDialog.loading && i === aiDialog.chatMessages.length - 1 ? '▍' : ''}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
            <div ref={chatEndRef} />
          </Box>
          {/* 输入框 */}
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="输入你的问题，如：这个策略在什么情况下会降价？"
              value={aiDialog.input}
              onChange={(e) => setAiDialog((prev) => ({ ...prev, input: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiChatSend(); } }}
              disabled={aiDialog.loading}
              multiline
              maxRows={3}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleAiChatSend} disabled={aiDialog.loading || !aiDialog.input.trim()}>
                      <SendIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiDialog((prev) => ({ ...prev, open: false }))}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* AI 生成/修改弹窗 */}
      <Dialog
        open={genDialog.open}
        onClose={() => genDialog.step !== 'loading' && setGenDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SmartToyIcon color="primary" />
          AI 生成/修改策略
        </DialogTitle>
        <DialogContent dividers>
          {genDialog.step === 'input' && (
            <Box>
              {/* 当前策略摘要 */}
              {(() => {
                const currentNodes = canvasRef.current?.getNodes() || flowData.nodes;
                const currentEdges = canvasRef.current?.getEdges() || flowData.edges;
                const hasStrategy = currentNodes.length > 1;
                const summary = hasStrategy ? describeGraph(flowToEngine(currentNodes, currentEdges)) : null;
                return (
                  <>
                    {hasStrategy && (
                      <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
                          当前策略（AI 将基于此修改）：
                        </Typography>
                        <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                          {summary}
                        </Typography>
                      </Box>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {hasStrategy
                        ? '描述你想要的修改，AI 将在现有策略基础上调整：'
                        : '描述你期望的竞价策略效果，AI 将生成全新方案：'}
                    </Typography>
                  </>
                );
              })()}

              {/* 快捷改进方向 */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                {[
                  '更保守：减少加价，优先保持',
                  '更激进：积极加价抢排名',
                  '增加降价逻辑：差价大时省钱',
                  '优化预算控制：接近上限时停止加价',
                  '简化流程：减少不必要的分支',
                  '从零开始生成一个全新策略',
                ].map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    variant="outlined"
                    clickable
                    onClick={() => setGenDialog((prev) => ({
                      ...prev,
                      prompt: prev.prompt ? `${prev.prompt}\n${tag}` : tag,
                    }))}
                    sx={{ fontSize: '0.7rem' }}
                  />
                ))}
              </Box>

              <TextField
                label="修改要求 / 策略描述"
                value={genDialog.prompt}
                onChange={(e) => setGenDialog((prev) => ({ ...prev, prompt: e.target.value }))}
                fullWidth
                multiline
                rows={4}
                placeholder={'例：\n• 排名第一且与第二名差价超过10U时降价\n• 预算不够时保持不动，不要降价\n• 增加一个判断：当排名低于5名时不参与竞价'}
              />
            </Box>
          )}

          {genDialog.step === 'loading' && (
            <Box>
              {/* 已完成的尝试记录 */}
              {genDialog.attempts.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  {genDialog.attempts.map((a, i) => (
                    <AttemptSummary key={i} attempt={a} />
                  ))}
                </Box>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 1.5 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">
                  {(() => {
                    const len = genDialog.attempts.length;
                    if (len === 0) return 'AI 正在生成策略方案...';
                    const lastAttempt = genDialog.attempts[len - 1];
                    // 上一步是结构校验通过 → 现在正在进行 AI 评审
                    if (lastAttempt.phase === 'validate' && lastAttempt.validation?.valid) {
                      return 'AI 正在评审策略是否达标...';
                    }
                    // 上一步是评审不通过 → 正在重新生成
                    if (lastAttempt.phase === 'review' && !lastAttempt.review?.pass) {
                      return `AI 正在根据评审反馈重新生成策略...`;
                    }
                    return `第 ${len + 1} 步：AI 正在处理...`;
                  })()}
                </Typography>
              </Box>
            </Box>
          )}

          {genDialog.step === 'review' && (
            <Box>
              {/* 尝试记录时间线 */}
              {genDialog.attempts.length > 1 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                    生成过程（共 {genDialog.attempts.length} 步）：
                  </Typography>
                  {genDialog.attempts.map((a, i) => (
                    <AttemptSummary key={i} attempt={a} />
                  ))}
                </Box>
              )}

              {genDialog.error && !genDialog.result ? (
                <Alert severity="error" sx={{ mb: 2 }}>{genDialog.error}</Alert>
              ) : genDialog.result && (
                <>
                  {/* AI 评审总结 */}
                  {genDialog.aiReview && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: genDialog.aiReview.pass ? 'success.50' : 'warning.50', borderRadius: 1, border: 1, borderColor: genDialog.aiReview.pass ? 'success.200' : 'warning.200' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <RateReviewIcon sx={{ fontSize: 18 }} color={genDialog.aiReview.pass ? 'success' : 'warning'} />
                        <Typography variant="subtitle2" color={genDialog.aiReview.pass ? 'success.main' : 'warning.main'}>
                          AI 评审{genDialog.aiReview.pass ? '通过' : '未通过'}
                        </Typography>
                      </Box>
                      {genDialog.aiReview.summary && (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, mt: 0.5 }}>
                          {genDialog.aiReview.summary}
                        </Typography>
                      )}
                      {genDialog.aiReview.issues?.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="warning.main" fontWeight={600}>问题：</Typography>
                          {genDialog.aiReview.issues.map((issue, i) => (
                            <Typography key={i} variant="caption" display="block" color="warning.main" sx={{ pl: 1 }}>• {issue}</Typography>
                          ))}
                        </Box>
                      )}
                      {genDialog.aiReview.suggestions?.length > 0 && (
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>建议：</Typography>
                          {genDialog.aiReview.suggestions.map((s, i) => (
                            <Typography key={i} variant="caption" display="block" color="text.secondary" sx={{ pl: 1 }}>• {s}</Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* 结构校验结果 */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {genDialog.validation?.valid ? (
                        <Chip icon={<CheckCircleIcon />} label="结构校验通过" color="success" size="small" />
                      ) : (
                        <Chip icon={<ErrorIcon />} label="结构校验失败" color="error" size="small" />
                      )}
                      {genDialog.aiReview ? (
                        genDialog.aiReview.pass ? (
                          <Chip icon={<RateReviewIcon />} label="AI 评审通过" color="success" size="small" variant="outlined" />
                        ) : (
                          <Chip icon={<RateReviewIcon />} label="AI 评审未通过" color="warning" size="small" variant="outlined" />
                        )
                      ) : null}
                      <Typography variant="body2" color="text.secondary">
                        {genDialog.result.nodes?.length || 0} 个节点，{genDialog.result.edges?.length || 0} 条边
                      </Typography>
                    </Box>

                    {genDialog.validation?.errors?.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="error" fontWeight={600}>仍存在的错误：</Typography>
                        {genDialog.validation.errors.map((e, i) => (
                          <Typography key={i} variant="caption" display="block" color="error" sx={{ pl: 1 }}>• {e}</Typography>
                        ))}
                      </Box>
                    )}

                    {genDialog.validation?.warnings?.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="warning.main" fontWeight={600}>
                          <WarningIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                          警告：
                        </Typography>
                        {genDialog.validation.warnings.map((w, i) => (
                          <Typography key={i} variant="caption" display="block" color="warning.main" sx={{ pl: 1 }}>• {w}</Typography>
                        ))}
                      </Box>
                    )}
                  </Box>

                  {/* 策略预览 */}
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>策略结构预览：</Typography>
                  <Box sx={{
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    p: 1.5,
                    maxHeight: 250,
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    lineHeight: 1.6,
                  }}>
                    {genDialog.result.nodes?.map((n) => {
                      if (n.type === 'start') return <div key={n.id}>[{n.id}] 开始</div>;
                      if (n.type === 'condition') return <div key={n.id}>[{n.id}] 条件: {n.expr}</div>;
                      if (n.type === 'action') return <div key={n.id}>[{n.id}] {n.action}{n.targetExpr ? ` → ${n.targetExpr}` : ''}</div>;
                      if (n.type === 'setVar') return <div key={n.id}>[{n.id}] 设置 {n.varName} = {n.expr}</div>;
                      if (n.type === 'template') return <div key={n.id}>[{n.id}] 模板: {n.templateId}</div>;
                      return null;
                    })}
                    <div style={{ marginTop: 8, color: '#888' }}>
                      {genDialog.result.edges?.map((e, i) => (
                        <div key={i}>{e.from} → {e.to}{e.branch ? ` (${e.branch})` : ''}</div>
                      ))}
                    </div>
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {genDialog.step === 'input' && (
            <>
              <Button onClick={() => setGenDialog((prev) => ({ ...prev, open: false }))}>取消</Button>
              <Button variant="contained" onClick={handleGenerate} disabled={!genDialog.prompt.trim()}>
                生成策略
              </Button>
            </>
          )}
          {genDialog.step === 'review' && (
            <>
              <Button onClick={() => setGenDialog((prev) => ({ ...prev, step: 'input' }))}>
                返回修改
              </Button>
              <Button onClick={handleGenerate} disabled={!genDialog.prompt.trim()}>
                重新生成
              </Button>
              <Button
                variant="contained"
                onClick={handleApplyGenerated}
                disabled={!genDialog.validation?.valid}
                startIcon={<CheckCircleIcon />}
              >
                {!genDialog.validation?.valid
                  ? '结构校验未通过，无法应用'
                  : genDialog.aiReview && !genDialog.aiReview.pass
                    ? '评审未通过，仍可应用'
                    : '应用到画布'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
