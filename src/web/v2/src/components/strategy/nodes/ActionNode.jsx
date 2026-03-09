import { Handle, Position } from '@xyflow/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ACTION_LABELS, translateExpr } from '../i18n';

const ACTION_COLORS = {
  RAISE: { border: 'success.main', bg: 'rgba(46, 204, 113, 0.1)' },
  LOWER: { border: 'warning.main', bg: 'rgba(243, 156, 18, 0.1)' },
  KEEP: { border: 'text.secondary', bg: 'rgba(0, 0, 0, 0.04)' },
  SKIP: { border: 'error.main', bg: 'rgba(231, 76, 60, 0.1)' },
};

export default function ActionNode({ data, selected }) {
  const colors = ACTION_COLORS[data.action] || ACTION_COLORS.KEEP;
  const actionLabel = ACTION_LABELS[data.action] || data.action;
  const targetDisplay = data.targetExpr ? translateExpr(data.targetExpr) : '';
  const targetSummary = targetDisplay.length > 16
    ? targetDisplay.slice(0, 16) + '…'
    : targetDisplay;

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
        {actionLabel}
      </Typography>
      {targetSummary && (
        <Typography variant="caption" display="block" color="text.secondary"
          sx={{ fontSize: '0.65rem' }}>
          → {targetSummary}
        </Typography>
      )}
    </Box>
  );
}
