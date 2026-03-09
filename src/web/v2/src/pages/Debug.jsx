import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import useStore from '../stores/useStore';

export default function Debug() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState({ text: '', buttons: [] });
  const addLog = useStore((s) => s.addLog);

  const handleClick = async () => {
    if (!input) return;
    try {
      const res = await fetch('/api/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });
      const data = await res.json();
      if (data.message) setResponse(data.message);
      addLog({ level: 'INFO', message: `按钮点击: ${input} → ${(data.message?.text || '').slice(0, 80)}`, time: new Date().toISOString() });
    } catch (e) {
      addLog({ level: 'ERROR', message: `点击失败: ${e.message}`, time: new Date().toISOString() });
    }
  };

  const handleSend = async () => {
    if (!input) return;
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });
      const data = await res.json();
      if (data.message) setResponse(data.message);
      addLog({ level: 'INFO', message: `发送文本: ${input}`, time: new Date().toISOString() });
    } catch (e) {
      addLog({ level: 'ERROR', message: `发送失败: ${e.message}`, time: new Date().toISOString() });
    }
  };

  const handleDump = async () => {
    try {
      const res = await fetch('/api/dump');
      const data = await res.json();
      setResponse(data);
    } catch (e) {
      addLog({ level: 'ERROR', message: `查看按钮失败: ${e.message}`, time: new Date().toISOString() });
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: 900, height: '100vh', overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom>调试工具</Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入按钮文本或命令"
              size="small"
              fullWidth
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <Button variant="outlined" onClick={handleClick} sx={{ whiteSpace: 'nowrap' }}>
              点击按钮
            </Button>
            <Button variant="outlined" onClick={handleSend} sx={{ whiteSpace: 'nowrap' }}>
              发送文本
            </Button>
            <Button variant="outlined" onClick={handleDump} sx={{ whiteSpace: 'nowrap' }}>
              查看按钮
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Bot 消息文本
          </Typography>
          <Box sx={{
            bgcolor: 'background.default',
            p: 1.5,
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            whiteSpace: 'pre-wrap',
            maxHeight: 300,
            overflow: 'auto',
            color: 'text.secondary',
          }}>
            {response.text || '(空)'}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            按钮结构
          </Typography>
          <Box sx={{
            bgcolor: 'background.default',
            p: 1.5,
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            whiteSpace: 'pre-wrap',
            maxHeight: 400,
            overflow: 'auto',
            color: 'text.secondary',
          }}>
            {response.buttons ? JSON.stringify(response.buttons, null, 2) : '(空)'}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
