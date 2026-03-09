import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExploreIcon from '@mui/icons-material/Explore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StatusChip from './StatusChip';
import useStore from '../stores/useStore';

export default function ControlPanel() {
  const connected = useStore((s) => s.connected);
  const monitoring = useStore((s) => s.monitoring);
  const apiCall = useStore((s) => s.apiCall);
  const fetchMyAds = useStore((s) => s.fetchMyAds);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle2" color="primary" gutterBottom>
          控制台
        </Typography>

        <Stack spacing={1} sx={{ mb: 2 }}>
          <StatusChip label={connected ? '已连接' : '未连接'} active={connected} />
          <StatusChip label={monitoring ? '监控中' : '已停止'} active={monitoring} />
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Stack spacing={1}>
          <Button variant="outlined" size="small" startIcon={<ExploreIcon />} onClick={() => apiCall('/api/navigate')} fullWidth>
            首次导航
          </Button>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => apiCall('/api/refresh')} fullWidth>
            手动刷新
          </Button>
          <Button variant="outlined" size="small" startIcon={<InfoOutlinedIcon />} onClick={fetchMyAds} fullWidth>
            广告详情
          </Button>

          <Divider sx={{ my: 1 }} />

          {monitoring ? (
            <Button variant="contained" color="error" size="small" startIcon={<StopIcon />} onClick={() => apiCall('/api/monitor/stop')} fullWidth>
              停止监控
            </Button>
          ) : (
            <Button variant="contained" color="success" size="small" startIcon={<PlayArrowIcon />} onClick={() => apiCall('/api/monitor/start')} fullWidth>
              启动监控
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
