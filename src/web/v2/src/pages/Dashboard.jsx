import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ControlPanel from '../components/ControlPanel';

export default function Dashboard() {
  return (
    <Box sx={{ display: 'flex', height: '100vh', gap: 1.5, p: 1.5 }}>
      {/* 左栏: 控制面板 */}
      <Box sx={{ width: 220, flexShrink: 0 }}>
        <ControlPanel />
      </Box>

      {/* 中栏: 排名表 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ p: 2 }}>
          排名表 (待实现)
        </Typography>
      </Box>

      {/* 右栏: 建议 + 日志 */}
      <Box sx={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ p: 2 }}>
          竞价建议 (待实现)
        </Typography>
        <Typography variant="subtitle2" color="text.secondary" sx={{ p: 2 }}>
          日志 (待实现)
        </Typography>
      </Box>
    </Box>
  );
}
