import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AdConfigForm from '../components/AdConfigForm';
import useStore from '../stores/useStore';
import { getAiConfig, saveAiConfig } from '../utils/aiConfig';

export default function Settings() {
  const storeConfig = useStore((s) => s.config);
  const saveConfigApi = useStore((s) => s.saveConfig);
  const [config, setConfig] = useState({});
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [aiCfg, setAiCfg] = useState(getAiConfig);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setConfig(JSON.parse(JSON.stringify(storeConfig)));
  }, [storeConfig]);

  const updateAi = (field, value) => {
    setAiCfg((prev) => {
      const next = { ...prev, [field]: value };
      saveAiConfig(next);
      return next;
    });
  };

  const update = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const updateAdConfig = (adKey, newAdCfg) => {
    setConfig((prev) => ({
      ...prev,
      adConfigs: { ...prev.adConfigs, [adKey]: newAdCfg },
    }));
  };

  const deleteAdConfig = (adKey) => {
    setConfig((prev) => {
      const next = { ...prev, adConfigs: { ...prev.adConfigs } };
      delete next.adConfigs[adKey];
      return next;
    });
  };

  const addAdConfig = () => {
    const newKey = prompt('输入广告ID（如 AD2458）：');
    if (!newKey) return;
    const key = newKey.toUpperCase();
    setConfig((prev) => ({
      ...prev,
      adConfigs: {
        ...prev.adConfigs,
        [key]: { note: '', priceGapThreshold: 5, rankLimit: null, timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 50, rankLimit: null }] },
      },
    }));
  };

  const handleSave = async () => {
    const result = await saveConfigApi(config);
    if (result?.ok) {
      setSnack({ open: true, message: '配置已保存', severity: 'success' });
    } else {
      setSnack({ open: true, message: '保存失败', severity: 'error' });
    }
  };

  // 轮询间隔时段
  const intervalSlots = config.checkIntervalSlots || [];
  const updateIntervalSlot = (index, field, value) => {
    const slots = [...intervalSlots];
    slots[index] = { ...slots[index], [field]: value };
    update('checkIntervalSlots', slots);
  };
  const addIntervalSlot = () => {
    update('checkIntervalSlots', [...intervalSlots, { start: '00:00', end: '24:00', interval: 10 }]);
  };
  const removeIntervalSlot = (index) => {
    update('checkIntervalSlots', intervalSlots.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ p: 2, maxWidth: 800, height: '100vh', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">配置管理</Typography>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
          保存配置
        </Button>
      </Box>

      {/* 基础配置 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            基础配置
          </Typography>
          <Stack spacing={2}>
            <TextField label="Bot用户名" value={config.botUsername || ''} size="small"
              onChange={(e) => update('botUsername', e.target.value)} />
            <TextField label="默认检查间隔(秒)" type="number" value={config.checkInterval || ''} size="small"
              onChange={(e) => update('checkInterval', Number(e.target.value))}
              helperText="无时段匹配时使用" />
            <FormControlLabel
              control={<Switch checked={config.autoBidEnabled || false} onChange={(e) => update('autoBidEnabled', e.target.checked)} />}
              label="竞价总开关" />
            <FormControlLabel
              control={<Switch checked={config.enableNotify || false} onChange={(e) => update('enableNotify', e.target.checked)} />}
              label="通知开关" />
            <TextField label="通知群组ID" value={config.notifyGroupId || ''} size="small"
              onChange={(e) => update('notifyGroupId', e.target.value)}
              helperText="填群组用户名或数字Chat ID" />
          </Stack>
        </CardContent>
      </Card>

      {/* 轮询间隔时段 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            轮询间隔时段
          </Typography>
          {intervalSlots.map((slot, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <TextField label="开始" value={slot.start} size="small" sx={{ width: 80 }}
                onChange={(e) => updateIntervalSlot(i, 'start', e.target.value)} />
              <Typography variant="body2">-</Typography>
              <TextField label="结束" value={slot.end} size="small" sx={{ width: 80 }}
                onChange={(e) => updateIntervalSlot(i, 'end', e.target.value)} />
              <TextField label="间隔(秒)" type="number" value={slot.interval} size="small" sx={{ width: 90 }}
                onChange={(e) => updateIntervalSlot(i, 'interval', Number(e.target.value))} />
              <IconButton size="small" color="error" onClick={() => removeIntervalSlot(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addIntervalSlot}>
            添加轮询时段
          </Button>
        </CardContent>
      </Card>

      {/* 广告独立配置 */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" color="primary">
              广告独立配置
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addAdConfig}>
              添加广告
            </Button>
          </Box>
          <Typography variant="caption" color="warning.main" gutterBottom sx={{ display: 'block', mb: 1 }}>
            未配置的广告不会参与竞价
          </Typography>
          {Object.entries(config.adConfigs || {}).map(([key, cfg]) => (
            <AdConfigForm
              key={key}
              adKey={key}
              adConfig={cfg}
              onChange={updateAdConfig}
              onDelete={deleteAdConfig}
            />
          ))}
        </CardContent>
      </Card>

      {/* AI 配置 */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            AI 配置
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            用于策略编辑器的 AI 总结功能，需要 OpenAI 兼容的 API
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="API 端点"
              value={aiCfg.endpoint}
              size="small"
              onChange={(e) => updateAi('endpoint', e.target.value)}
              placeholder="https://open.bigmodel.cn/api/paas/v4"
              helperText="OpenAI 兼容的 API 地址"
            />
            <TextField
              label="API Key"
              value={aiCfg.apiKey}
              size="small"
              type={showKey ? 'text' : 'password'}
              onChange={(e) => updateAi('apiKey', e.target.value)}
              placeholder="输入你的 API Key"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowKey(!showKey)}>
                      {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="模型ID"
              value={aiCfg.model}
              size="small"
              onChange={(e) => updateAi('model', e.target.value)}
              placeholder="glm-4-flash"
              helperText="例: glm-4-flash, gpt-4o-mini, deepseek-chat"
            />
          </Stack>
        </CardContent>
      </Card>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
