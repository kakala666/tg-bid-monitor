import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import BugReportIcon from '@mui/icons-material/BugReport';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

const NAV_WIDTH = 72;

const navItems = [
  { path: '/', label: '仪表盘', icon: <DashboardIcon /> },
  { path: '/analytics', label: '统计趋势', icon: <BarChartIcon /> },
  { path: '/strategy', label: '策略编辑', icon: <AccountTreeIcon /> },
  { path: '/settings', label: '配置管理', icon: <SettingsIcon /> },
  { path: '/debug', label: '调试工具', icon: <BugReportIcon /> },
];

export default function NavigationRail() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: NAV_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: NAV_WIDTH,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 2,
        },
      }}
    >
      <List sx={{ width: '100%' }}>
        {navItems.map((item) => {
          const selected = location.pathname === item.path;
          return (
            <Tooltip title={item.label} placement="right" key={item.path}>
              <ListItemButton
                selected={selected}
                onClick={() => navigate(item.path)}
                sx={{
                  flexDirection: 'column',
                  alignItems: 'center',
                  py: 1.5,
                  px: 0,
                  minHeight: 64,
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 'unset', color: selected ? 'primary.main' : 'text.secondary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    variant: 'caption',
                    textAlign: 'center',
                    color: selected ? 'primary.main' : 'text.secondary',
                    fontSize: '0.65rem',
                  }}
                />
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>
    </Drawer>
  );
}

export { NAV_WIDTH };
