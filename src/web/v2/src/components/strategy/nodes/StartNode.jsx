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
