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
