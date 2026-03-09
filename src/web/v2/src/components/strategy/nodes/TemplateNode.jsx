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
