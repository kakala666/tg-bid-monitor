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
