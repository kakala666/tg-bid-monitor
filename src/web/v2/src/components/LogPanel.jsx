import { useRef, useEffect } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import useStore from '../stores/useStore';

const levelColors = {
  INFO: 'info.main',
  WARN: 'warning.main',
  ERROR: 'error.main',
  ACTION: 'success.main',
};

export default function LogPanel() {
  const logs = useStore((s) => s.logs);
  const clearLogs = useStore((s) => s.clearLogs);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 200 }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', py: 1, '&:last-child': { pb: 1 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="subtitle2" color="primary">
            操作日志
          </Typography>
          <IconButton size="small" onClick={clearLogs}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', fontFamily: 'monospace', fontSize: '0.75rem' }}>
          {logs.map((entry) => (
            <Box key={entry._id} sx={{ py: 0.25, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography component="span" variant="caption" color="text.disabled" sx={{ mr: 1 }}>
                {new Date(entry.time).toLocaleTimeString()}
              </Typography>
              <Typography component="span" variant="caption" color={levelColors[entry.level] || 'text.primary'} fontWeight={700} sx={{ mr: 1 }}>
                [{entry.level}]
              </Typography>
              <Typography component="span" variant="caption">
                {entry.message}
              </Typography>
            </Box>
          ))}
          <div ref={bottomRef} />
        </Box>
      </CardContent>
    </Card>
  );
}
