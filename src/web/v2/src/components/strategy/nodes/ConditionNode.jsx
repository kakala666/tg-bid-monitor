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
