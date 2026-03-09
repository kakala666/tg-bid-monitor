import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import useStore from '../stores/useStore';

const GRANULARITIES = [
  { value: '10m', label: '10分钟' },
  { value: '1h', label: '1小时' },
  { value: '3h', label: '3小时' },
  { value: '6h', label: '6小时' },
  { value: '24h', label: '1天' },
  { value: '7d', label: '7天' },
];

export default function Analytics() {
  const fetchStats = useStore((s) => s.fetchStats);
  const [granularity, setGranularity] = useState('1h');
  const [filterAdId, setFilterAdId] = useState(null);
  const [statsData, setStatsData] = useState({ adIds: [], data: {} });
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const result = await fetchStats(granularity, filterAdId);
    if (result && result.data) setStatsData(result);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [granularity, filterAdId]);

  // 准备图表数据
  const allSeries = {};
  for (const [adId, { snapshots }] of Object.entries(statsData.data)) {
    allSeries[adId] = snapshots;
  }

  const adIds = statsData.adIds;
  const colors = ['#A0C4FF', '#F39C12', '#2ECC71', '#E74C3C', '#9B59B6'];

  // 合并所有时间点
  const allTimes = [...new Set(
    Object.values(allSeries).flatMap(s => s.map(p => p.time))
  )].sort();

  const xLabels = allTimes.map(t => {
    const d = new Date(t);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  function buildSeries(field) {
    return adIds.map((adId, i) => {
      const snaps = allSeries[adId] || [];
      const dataMap = new Map(snaps.map(s => [s.time, s[field]]));
      return {
        data: allTimes.map(t => dataMap.get(t) ?? null),
        label: adId,
        color: colors[i % colors.length],
      };
    });
  }

  const chartProps = {
    height: 280,
    xAxis: [{ data: xLabels, scaleType: 'point' }],
    slotProps: { legend: { labelStyle: { fontSize: 12 } } },
    sx: { '& .MuiChartsAxis-tickLabel': { fontSize: '0.7rem' } },
  };

  return (
    <Box sx={{ p: 2, height: '100vh', overflow: 'auto' }}>
      {/* 筛选栏 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <ToggleButtonGroup
          value={granularity}
          exclusive
          onChange={(_, v) => v && setGranularity(v)}
          size="small"
        >
          {GRANULARITIES.map((g) => (
            <ToggleButton key={g.value} value={g.value}>
              {g.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction="row" spacing={1}>
          <Chip
            label="全部"
            variant={filterAdId === null ? 'filled' : 'outlined'}
            color="primary"
            size="small"
            onClick={() => setFilterAdId(null)}
          />
          {adIds.map((id) => (
            <Chip
              key={id}
              label={id}
              variant={filterAdId === id ? 'filled' : 'outlined'}
              color="primary"
              size="small"
              onClick={() => setFilterAdId(id)}
            />
          ))}
        </Stack>
      </Box>

      {loading ? (
        <Typography color="text.secondary">加载中...</Typography>
      ) : allTimes.length === 0 ? (
        <Typography color="text.secondary">暂无统计数据，监控运行后会自动采集</Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {/* 竞价价格走势 */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                竞价价格走势
              </Typography>
              <LineChart
                series={buildSeries('currentBid')}
                {...chartProps}
              />
            </CardContent>
          </Card>

          {/* 排名变化 */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                排名变化
              </Typography>
              <LineChart
                series={buildSeries('rank')}
                yAxis={[{ reverse: true }]}
                {...chartProps}
              />
            </CardContent>
          </Card>

          {/* 展示量增量 */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                展示量增量
              </Typography>
              <BarChart
                series={buildSeries('viewsIncr')}
                {...chartProps}
              />
            </CardContent>
          </Card>

          {/* 余额消耗 */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                余额变化
              </Typography>
              <LineChart
                series={buildSeries('remaining').map(s => ({ ...s, area: true }))}
                {...chartProps}
              />
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}
