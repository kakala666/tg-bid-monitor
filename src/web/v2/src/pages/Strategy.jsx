import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import useStore from '../stores/useStore';

const LEFT_WIDTH = 200;
const RIGHT_WIDTH = 280;

export default function Strategy() {
  const config = useStore((s) => s.config);
  const [tabIndex, setTabIndex] = useState(0); // 0=广告策略, 1=策略模板
  const [selectedId, setSelectedId] = useState(null);

  // 从 config 提取列表
  const adStrategies = config.adStrategies || {};
  const adConfigs = config.adConfigs || {};
  const templates = config.strategyTemplates || {};

  // 广告策略列表：所有已配置的广告（不管有没有自定义策略）
  const adIds = Object.keys(adConfigs);
  const templateIds = Object.keys(templates);

  const currentList = tabIndex === 0 ? adIds : templateIds;

  // 选中第一个
  useEffect(() => {
    if (currentList.length > 0 && !currentList.includes(selectedId)) {
      setSelectedId(currentList[0]);
    }
  }, [tabIndex, currentList.length]);

  const handleAddTemplate = () => {
    const name = prompt('输入模板名称（英文，如 aggressive）：');
    if (!name) return;
    // 后续 Task 实现实际逻辑
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 顶部 Tab 栏 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)}>
          <Tab label="广告策略" />
          <Tab label="策略模板" />
        </Tabs>
      </Box>

      {/* 三栏主体 */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左栏：策略列表 */}
        <Box sx={{
          width: LEFT_WIDTH,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
        }}>
          <List sx={{ flex: 1, overflow: 'auto' }}>
            {currentList.map((id) => {
              const label = tabIndex === 0
                ? `${id}${adConfigs[id]?.note ? ` (${adConfigs[id].note})` : ''}`
                : templates[id]?.name || id;
              const hasCustom = tabIndex === 0 ? !!adStrategies[id] : true;
              return (
                <ListItemButton
                  key={id}
                  selected={selectedId === id}
                  onClick={() => setSelectedId(id)}
                >
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                    secondary={tabIndex === 0 && !hasCustom ? '默认策略' : null}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              );
            })}
          </List>
          {tabIndex === 1 && (
            <Box sx={{ p: 1 }}>
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddTemplate} fullWidth>
                新建模板
              </Button>
            </Box>
          )}
        </Box>

        {/* 中栏：画布占位 */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper' }}>
          <Typography color="text.secondary">
            {selectedId ? `编辑: ${selectedId}` : '请选择一个策略'}
          </Typography>
        </Box>

        {/* 右栏：属性面板占位 */}
        <Box sx={{
          width: RIGHT_WIDTH,
          borderLeft: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
          p: 2,
        }}>
          <Typography variant="subtitle2" color="text.secondary">
            属性面板
          </Typography>
          <Typography variant="caption" color="text.secondary">
            选中节点后在此编辑
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
