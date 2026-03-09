import Box from '@mui/material/Box';
import ControlPanel from '../components/ControlPanel';
import RankingTable from '../components/RankingTable';
import LogPanel from '../components/LogPanel';

export default function Dashboard() {
  return (
    <Box sx={{ display: 'flex', height: '100vh', gap: 1.5, p: 1.5 }}>
      {/* 左栏: 控制面板 */}
      <Box sx={{ width: 220, flexShrink: 0 }}>
        <ControlPanel />
      </Box>

      {/* 中栏: 排名表 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <RankingTable />
      </Box>

      {/* 右栏: 日志 */}
      <Box sx={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <LogPanel />
      </Box>
    </Box>
  );
}
