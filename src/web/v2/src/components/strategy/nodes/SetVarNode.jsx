import { Handle, Position } from '@xyflow/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { translateExpr, VAR_LABELS } from '../i18n';

export default function SetVarNode({ data, selected }) {
  const varDisplay = data.varName
    ? (VAR_LABELS[data.varName] || data.varName)
    : '';
  const exprDisplay = data.expr ? translateExpr(data.expr) : '?';
  const summary = varDisplay
    ? `${varDisplay} = ${exprDisplay}`
    : '(未设置)';

  return (
    <Box sx={{
      px: 2, py: 1,
      borderRadius: 2,
      border: 2,
      borderColor: 'secondary.main',
      bgcolor: selected ? 'rgba(243, 156, 18, 0.25)' : 'rgba(243, 156, 18, 0.1)',
      minWidth: 130,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#F39C12' }} />
      <Typography variant="caption" color="secondary.main" fontWeight={600} display="block">
        变量
      </Typography>
      <Typography variant="caption" color="text.primary" sx={{ fontSize: '0.7rem' }}>
        {summary.length > 20 ? summary.slice(0, 20) + '…' : summary}
      </Typography>
      <Handle type="source" position={Position.Bottom} id="default" style={{ background: '#F39C12' }} />
    </Box>
  );
}
