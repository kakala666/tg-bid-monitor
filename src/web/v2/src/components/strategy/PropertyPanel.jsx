import { useState, useEffect, useMemo } from 'react';
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
import ListSubheader from '@mui/material/ListSubheader';
import { VARIABLES, PRICE_VARIABLES, ACTION_LABELS, OP_LABELS, VAR_LABELS } from './i18n';

const COMPARE_OPS = ['>', '<', '>=', '<=', '==', '!='];
const MATH_OPS = ['+', '-', '*', '/'];
const CUSTOM_VALUE_KEY = '__custom__';

function parseStructured(expr) {
  if (!expr) return null;
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

// 合并系统变量 + 自定义变量，去重
function mergeVarOptions(customVars) {
  const allVars = [...VARIABLES];
  if (customVars?.length) {
    const existing = new Set(VARIABLES.map((v) => v.value));
    for (const cv of customVars) {
      if (!existing.has(cv.value)) {
        allVars.push({ value: cv.value, label: `${cv.value}（自定义）` });
      }
    }
  }
  return allVars;
}

// 判断某个值是不是已知变量
function isKnownVar(value, allVars) {
  return allVars.some((v) => v.value === value);
}

export default function PropertyPanel({ node, onNodeDataChange, templateIds, customVars }) {
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
        节点ID: {data.id}
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {nodeType === 'start' && (
        <Typography variant="body2" color="text.secondary">
          开始节点为流程入口，无需配置
        </Typography>
      )}

      {nodeType === 'condition' && (
        <ConditionEditor
          expr={data.expr || ''}
          onChange={(v) => updateData('expr', v)}
          customVars={customVars}
        />
      )}

      {nodeType === 'action' && (
        <ActionEditor
          action={data.action || 'KEEP'}
          targetExpr={data.targetExpr || ''}
          onActionChange={(v) => updateData('action', v)}
          onTargetChange={(v) => updateData('targetExpr', v)}
          customVars={customVars}
        />
      )}

      {nodeType === 'setVar' && (
        <SetVarEditor
          varName={data.varName || ''}
          expr={data.expr || ''}
          onNameChange={(v) => updateData('varName', v)}
          onExprChange={(v) => updateData('expr', v)}
          customVars={customVars}
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

// 通用的变量选择下拉框（支持自定义数值输入）
function VarSelect({ label, value, onChange, customVars, filterFn }) {
  const allVars = useMemo(() => mergeVarOptions(customVars), [customVars]);
  const options = filterFn ? allVars.filter(filterFn) : allVars;
  const isCustom = value && !isKnownVar(value, options);
  const [showCustomInput, setShowCustomInput] = useState(isCustom);
  const [customValue, setCustomValue] = useState(isCustom ? value : '');

  // 分组：系统变量 vs 自定义变量
  const sysVars = options.filter((v) => !v.label.includes('自定义'));
  const userVars = options.filter((v) => v.label.includes('自定义'));

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === CUSTOM_VALUE_KEY) {
      setShowCustomInput(true);
      return;
    }
    setShowCustomInput(false);
    onChange(val);
  };

  const handleCustomChange = (e) => {
    const val = e.target.value;
    setCustomValue(val);
    onChange(val);
  };

  if (showCustomInput) {
    return (
      <Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
          <TextField
            label={label}
            value={customValue}
            onChange={handleCustomChange}
            size="small"
            fullWidth
            placeholder="输入数值"
            InputProps={{ sx: { fontFamily: 'monospace' } }}
          />
        </Box>
        <Typography
          variant="caption"
          color="primary"
          sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          onClick={() => { setShowCustomInput(false); if (options.length) onChange(options[0].value); }}
        >
          ← 切换为选择变量
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <FormControl fullWidth size="small">
        <InputLabel>{label}</InputLabel>
        <Select value={isKnownVar(value, options) ? value : ''} label={label} onChange={handleSelectChange}>
          {sysVars.map((v) => (
            <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>
          ))}
          {userVars.length > 0 && <ListSubheader>自定义变量</ListSubheader>}
          {userVars.map((v) => (
            <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>
          ))}
          <Divider />
          <MenuItem value={CUSTOM_VALUE_KEY}>
            <Typography variant="body2" color="primary">输入自定义数值...</Typography>
          </MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
}

function ConditionEditor({ expr, onChange, customVars }) {
  const parsed = parseStructured(expr);
  const [advanced, setAdvanced] = useState(() => !!(expr && !parsed));
  const [left, setLeft] = useState(parsed?.left || '');
  const [op, setOp] = useState(parsed?.op || '>');
  const [right, setRight] = useState(parsed?.right || '');

  useEffect(() => {
    const p = parseStructured(expr);
    if (p) {
      setLeft(p.left);
      setOp(p.op);
      setRight(p.right);
    }
  }, [expr]);

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
          InputProps={{ sx: { fontFamily: 'monospace' } }}
          placeholder="例: myAd.rank > 3 && above.price < budgetLimit"
          helperText="使用英文变量名编写表达式"
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
      <Box sx={{ mb: 1 }}>
        <VarSelect
          label="判断条件"
          value={left}
          onChange={(v) => { setLeft(v); syncExpr(v, op, right); }}
          customVars={customVars}
        />
      </Box>
      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel>比较方式</InputLabel>
        <Select value={op} label="比较方式" onChange={(e) => { setOp(e.target.value); syncExpr(left, e.target.value, right); }}>
          {COMPARE_OPS.map((o) => (
            <MenuItem key={o} value={o}>{OP_LABELS[o] || o} ({o})</MenuItem>
          ))}
        </Select>
      </FormControl>
      <VarSelect
        label="比较值"
        value={right}
        onChange={(v) => { setRight(v); syncExpr(left, op, v); }}
        customVars={customVars}
      />
    </Box>
  );
}

function ActionEditor({ action, targetExpr, onActionChange, onTargetChange, customVars }) {
  const parsed = parseTargetExpr(targetExpr);
  const [advanced, setAdvanced] = useState(() => !!(targetExpr && !parsed));
  const [base, setBase] = useState(parsed?.base || 'above.price');
  const [op, setOp] = useState(parsed?.op || '+');
  const [val, setVal] = useState(parsed?.value || '1');

  const showTarget = action === 'RAISE' || action === 'LOWER';

  useEffect(() => {
    const p = parseTargetExpr(targetExpr);
    if (p) {
      setBase(p.base);
      setOp(p.op);
      setVal(p.value);
    }
  }, [targetExpr]);

  const syncTarget = (b, o, v) => {
    if (b && v) onTargetChange(`${b} ${o} ${v}`);
  };

  return (
    <Box>
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>动作类型</InputLabel>
        <Select value={action} label="动作类型" onChange={(e) => onActionChange(e.target.value)}>
          <MenuItem value="RAISE">加价</MenuItem>
          <MenuItem value="LOWER">降价</MenuItem>
          <MenuItem value="KEEP">保持不变</MenuItem>
          <MenuItem value="SKIP">跳过不处理</MenuItem>
        </Select>
      </FormControl>

      {showTarget && (
        <>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            目标价格设置
          </Typography>
          <FormControlLabel
            control={<Switch checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} size="small" />}
            label={<Typography variant="caption">高级模式</Typography>}
            sx={{ mb: 1 }}
          />
          {advanced ? (
            <TextField label="目标价表达式" value={targetExpr} onChange={(e) => onTargetChange(e.target.value)}
              fullWidth size="small" InputProps={{ sx: { fontFamily: 'monospace' } }}
              placeholder="例: above.price + 1"
              helperText="使用英文变量名编写表达式" />
          ) : (
            <>
              <Box sx={{ mb: 1 }}>
                <VarSelect
                  label="基准价格"
                  value={base}
                  onChange={(v) => { setBase(v); syncTarget(v, op, val); }}
                  customVars={customVars}
                  filterFn={(v) => v.value.includes('price') || v.value === 'budgetLimit' || v.label.includes('自定义')}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>运算</InputLabel>
                  <Select value={op} label="运算" onChange={(e) => { setOp(e.target.value); syncTarget(base, e.target.value, val); }}>
                    <MenuItem value="+">加上 (+)</MenuItem>
                    <MenuItem value="-">减去 (-)</MenuItem>
                    <MenuItem value="*">乘以 (×)</MenuItem>
                    <MenuItem value="/">除以 (÷)</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="数值" value={val} size="small" sx={{ flex: 1 }}
                  onChange={(e) => { setVal(e.target.value); syncTarget(base, op, e.target.value); }} />
              </Box>
            </>
          )}
        </>
      )}
    </Box>
  );
}

function SetVarEditor({ varName, expr, onNameChange, onExprChange, customVars }) {
  const [advanced, setAdvanced] = useState(false);

  return (
    <Box>
      <TextField label="变量名" value={varName} onChange={(e) => onNameChange(e.target.value)}
        fullWidth size="small" sx={{ mb: 2 }} placeholder="例: gap"
        helperText={varName && VAR_LABELS[varName] ? `= ${VAR_LABELS[varName]}` : '自定义变量名（英文）'} />
      <FormControlLabel
        control={<Switch checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} size="small" />}
        label={<Typography variant="caption">高级模式</Typography>}
        sx={{ mb: 1 }}
      />
      <TextField label="计算公式" value={expr} onChange={(e) => onExprChange(e.target.value)}
        fullWidth size="small" InputProps={{ sx: { fontFamily: 'monospace' } }}
        multiline={advanced} rows={advanced ? 2 : 1}
        placeholder="例: myAd.price - below.price"
        helperText="可用变量：我的价格(myAd.price)、上方价格(above.price) 等" />
    </Box>
  );
}

function TemplateEditor({ templateId, templateIds, onChange }) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>选择策略模板</InputLabel>
      <Select value={templateId} label="选择策略模板" onChange={(e) => onChange(e.target.value)}>
        {templateIds.map((id) => (
          <MenuItem key={id} value={id}>{id}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
