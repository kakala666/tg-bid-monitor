import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import useStore from '../stores/useStore';

const actionConfig = {
  KEEP: { color: 'default', icon: '⏸', label: '保持' },
  RAISE: { color: 'error', icon: '⬆️', label: '加价' },
  LOWER: { color: 'success', icon: '⬇️', label: '降价' },
  SKIP: { color: 'warning', icon: '⏭️', label: '跳过' },
};

function SuggestionItem({ suggestion }) {
  const config = useStore((s) => s.config);
  const applyBid = useStore((s) => s.applyBid);
  const s = suggestion;
  const ac = actionConfig[s.action] || actionConfig.KEEP;
  const changed = s.action !== 'KEEP' && s.action !== 'SKIP';
  const noteTag = s.note ? ` (${s.note})` : '';

  const handleApply = () => {
    if (window.confirm(`确认将 ${s.adId} 竞价改为 ${s.targetPrice}U？`)) {
      applyBid(s.adId, s.targetPrice);
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1,
        borderLeft: 3,
        borderLeftColor: `${ac.color}.main`,
        opacity: s.action === 'SKIP' ? 0.6 : 1,
      }}
    >
      <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="body2" fontWeight={700}>
            {ac.icon} {s.adId}{noteTag}
          </Typography>
          <Chip label={`#${s.rank}`} size="small" variant="outlined" />
          <Chip label={ac.label} size="small" color={ac.color} />
          {changed && config.autoBidEnabled && (
            <Button size="small" variant="contained" color={ac.color} onClick={handleApply} sx={{ ml: 'auto', minWidth: 'unset', px: 1, py: 0.25, fontSize: '0.7rem' }}>
              应用 {s.targetPrice}U
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">
            {s.currentPrice}U
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {changed ? '→' : '='}
          </Typography>
          <Typography variant="body2" color={`${ac.color}.main`} fontWeight={700}>
            {s.targetPrice}U
          </Typography>
          {changed && (
            <Typography variant="caption" color="secondary">
              ({s.action === 'RAISE' ? '+' : ''}{s.targetPrice - s.currentPrice}U)
            </Typography>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {s.reason}
        </Typography>
        {s.action !== 'SKIP' && (
          <Typography variant="caption" color="text.disabled">
            预算{s.budgetLimit}U | 阈值{s.gapThreshold}U | 排名上限{s.rankLimit != null ? '#' + s.rankLimit : '无'}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function SuggestionPanel() {
  const suggestions = useStore((s) => s.suggestions);
  const config = useStore((s) => s.config);

  return (
    <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" color="primary">
            竞价建议
          </Typography>
          <Chip
            label={config.autoBidEnabled ? '竞价开启' : '仅监控'}
            size="small"
            color={config.autoBidEnabled ? 'success' : 'error'}
            variant="outlined"
          />
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {suggestions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              暂无建议
            </Typography>
          ) : (
            suggestions.map((s, i) => <SuggestionItem key={i} suggestion={s} />)
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
