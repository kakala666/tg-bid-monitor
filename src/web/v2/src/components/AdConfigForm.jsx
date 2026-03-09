import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

export default function AdConfigForm({ adKey, adConfig, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(true);

  const update = (field, value) => {
    onChange(adKey, { ...adConfig, [field]: value });
  };

  const updateSlot = (index, field, value) => {
    const slots = [...(adConfig.timeSlots || [])];
    slots[index] = { ...slots[index], [field]: value };
    update('timeSlots', slots);
  };

  const addSlot = () => {
    const slots = [...(adConfig.timeSlots || []), { start: '00:00', end: '24:00', budgetLimit: 50, rankLimit: null }];
    update('timeSlots', slots);
  };

  const removeSlot = (index) => {
    const slots = (adConfig.timeSlots || []).filter((_, i) => i !== index);
    update('timeSlots', slots);
  };

  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
          <Typography variant="subtitle2" color="primary" sx={{ flex: 1 }}>
            广告{adKey} {adConfig.note && `(${adConfig.note})`}
          </Typography>
          <IconButton size="small" color="error" onClick={() => onDelete(adKey)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>

        <Collapse in={expanded}>
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField label="广告ID" value={adKey} size="small" disabled sx={{ width: 120 }} />
              <TextField label="备注" value={adConfig.note || ''} size="small" sx={{ width: 120 }}
                onChange={(e) => update('note', e.target.value)} />
              <TextField label="降价阈值" type="number" value={adConfig.priceGapThreshold ?? ''} size="small" sx={{ width: 100 }}
                onChange={(e) => update('priceGapThreshold', e.target.value === '' ? null : Number(e.target.value))} />
              <TextField label="默认排名上限" type="number" value={adConfig.rankLimit ?? ''} size="small" sx={{ width: 120 }}
                placeholder="不限"
                onChange={(e) => update('rankLimit', e.target.value === '' ? null : Number(e.target.value))} />
            </Box>

            <Typography variant="caption" color="text.secondary">时段配置</Typography>
            {(adConfig.timeSlots || []).map((slot, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', pl: 2 }}>
                <TextField label="开始" value={slot.start} size="small" sx={{ width: 80 }}
                  onChange={(e) => updateSlot(i, 'start', e.target.value)} />
                <Typography variant="body2">-</Typography>
                <TextField label="结束" value={slot.end} size="small" sx={{ width: 80 }}
                  onChange={(e) => updateSlot(i, 'end', e.target.value)} />
                <TextField label="预算(U)" type="number" value={slot.budgetLimit} size="small" sx={{ width: 90 }}
                  onChange={(e) => updateSlot(i, 'budgetLimit', Number(e.target.value))} />
                <TextField label="排名上限" type="number" value={slot.rankLimit ?? ''} size="small" sx={{ width: 90 }}
                  placeholder="默认"
                  onChange={(e) => updateSlot(i, 'rankLimit', e.target.value === '' ? null : Number(e.target.value))} />
                <IconButton size="small" color="error" onClick={() => removeSlot(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={addSlot} sx={{ alignSelf: 'flex-start', ml: 2 }}>
              添加时段
            </Button>
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
}
