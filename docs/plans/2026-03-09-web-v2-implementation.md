# Web V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用 React + MUI v6 + Vite 重写前端控制台，遵循 MD3 设计规范，包含仪表盘、统计趋势、配置管理、调试工具四个页面。

**Architecture:** Vite 项目位于 `src/web/v2/`，构建产物输出到 `src/web/public-v2/`。后端 Express 加一行静态路由 `/v2` 指向新前端，不改动现有 API 和 WebSocket。前端用 Zustand 管理全局状态，WebSocket 在自定义 hook 中连接并写入 store。

**Tech Stack:** React 18, MUI v6, MUI X Charts, Zustand, React Router v6, Vite

**Design Doc:** `docs/plans/2026-03-09-web-v2-design.md`

---

### Task 1: 初始化 Vite 项目 + 安装依赖

**Files:**
- Create: `src/web/v2/package.json`
- Create: `src/web/v2/vite.config.js`
- Create: `src/web/v2/index.html`
- Create: `src/web/v2/src/main.jsx`

**Step 1: 创建项目目录并初始化 package.json**

```bash
mkdir -p src/web/v2/src
```

创建 `src/web/v2/package.json`:

```json
{
  "name": "tg-bid-monitor-v2",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

**Step 2: 安装依赖**

```bash
cd src/web/v2
npm install react react-dom react-router-dom @mui/material @mui/icons-material @emotion/react @emotion/styled @mui/x-charts zustand
npm install -D vite @vitejs/plugin-react
```

**Step 3: 创建 vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../public-v2',
    emptyOutDir: true,
  },
});
```

**Step 4: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TG竞价监控 V2</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

**Step 5: 创建入口 main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

创建占位 `src/web/v2/src/App.jsx`:

```jsx
export default function App() {
  return <div>V2 Loading...</div>;
}
```

**Step 6: 验证开发服务器启动**

```bash
cd src/web/v2 && npm run dev
```

预期: 浏览器打开 http://localhost:5173 显示 "V2 Loading..."

**Step 7: Commit**

```bash
git add src/web/v2/
git commit -m "feat(v2): initialize Vite project with React + MUI dependencies"
```

---

### Task 2: MUI 主题 + 全局布局 (Navigation Rail)

**Files:**
- Create: `src/web/v2/src/theme.js`
- Modify: `src/web/v2/src/App.jsx`
- Create: `src/web/v2/src/components/NavigationRail.jsx`

**Step 1: 创建 MD3 深色主题**

`src/web/v2/src/theme.js`:

```js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    dark: {
      palette: {
        primary: { main: '#A0C4FF' },
        secondary: { main: '#F39C12' },
        error: { main: '#E74C3C' },
        success: { main: '#2ECC71' },
        warning: { main: '#F39C12' },
        background: {
          default: '#1A1A2E',
          paper: '#16213E',
        },
      },
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: {
    borderRadius: 12,
  },
});

export default theme;
```

**Step 2: 创建 NavigationRail 组件**

```bash
mkdir -p src/web/v2/src/components
```

`src/web/v2/src/components/NavigationRail.jsx`:

```jsx
import { useState } from 'react';
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

const NAV_WIDTH = 72;

const navItems = [
  { path: '/', label: '仪表盘', icon: <DashboardIcon /> },
  { path: '/analytics', label: '统计趋势', icon: <BarChartIcon /> },
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
```

**Step 3: 更新 App.jsx — 路由 + 布局骨架**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import theme from './theme';
import NavigationRail, { NAV_WIDTH } from './components/NavigationRail';

function Placeholder({ title }) {
  return <Typography variant="h5" sx={{ p: 3 }}>{title}</Typography>;
}

export default function App() {
  return (
    <ThemeProvider theme={theme} defaultMode="dark">
      <CssBaseline />
      <BrowserRouter>
        <Box sx={{ display: 'flex', height: '100vh' }}>
          <NavigationRail />
          <Box component="main" sx={{ flexGrow: 1, overflow: 'auto', ml: `${NAV_WIDTH}px` }}>
            <Routes>
              <Route path="/" element={<Placeholder title="仪表盘" />} />
              <Route path="/analytics" element={<Placeholder title="统计趋势" />} />
              <Route path="/settings" element={<Placeholder title="配置管理" />} />
              <Route path="/debug" element={<Placeholder title="调试工具" />} />
            </Routes>
          </Box>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}
```

**Step 4: 验证**

```bash
cd src/web/v2 && npm run dev
```

预期: 左侧 72px Navigation Rail 有 4 个图标，点击可切换页面标题。

**Step 5: Commit**

```bash
git add src/web/v2/src/
git commit -m "feat(v2): add MD3 dark theme and Navigation Rail layout"
```

---

### Task 3: Zustand Store + WebSocket Hook

**Files:**
- Create: `src/web/v2/src/stores/useStore.js`
- Create: `src/web/v2/src/hooks/useWebSocket.js`

**Step 1: 创建 Zustand store**

```bash
mkdir -p src/web/v2/src/stores src/web/v2/src/hooks
```

`src/web/v2/src/stores/useStore.js`:

```js
import { create } from 'zustand';

const MAX_LOGS = 500;

const useStore = create((set, get) => ({
  // 连接状态
  connected: false,
  setConnected: (v) => set({ connected: v }),

  // 监控状态
  monitoring: false,
  setMonitoring: (v) => set({ monitoring: v }),

  // 排名数据
  rankings: [],
  rankingsText: '',
  rankingsTime: null,
  setRankings: (data) => set({
    rankings: data.rankings || [],
    rankingsText: data.text || '',
    rankingsTime: Date.now(),
  }),

  // 竞价建议
  suggestions: [],
  setSuggestions: (data) => set({
    suggestions: data.suggestions || [],
  }),

  // 日志
  logs: [],
  addLog: (entry) => set((state) => ({
    logs: [...state.logs, { ...entry, _id: Date.now() + Math.random() }].slice(-MAX_LOGS),
  })),
  clearLogs: () => set({ logs: [] }),

  // 配置
  config: {},
  setConfig: (cfg) => set({ config: cfg }),

  // 广告详情
  myAdsDetail: [],
  setMyAdsDetail: (details) => set({ myAdsDetail: details }),

  // API 调用
  async fetchConfig() {
    try {
      const res = await fetch('/api/config');
      const cfg = await res.json();
      set({ config: cfg });
      return cfg;
    } catch (e) {
      get().addLog({ level: 'ERROR', message: `获取配置失败: ${e.message}`, time: new Date().toISOString() });
    }
  },

  async saveConfig(cfg) {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (data.ok) {
        set({ config: cfg });
        get().addLog({ level: 'INFO', message: '配置已保存', time: new Date().toISOString() });
      }
      return data;
    } catch (e) {
      get().addLog({ level: 'ERROR', message: `保存配置失败: ${e.message}`, time: new Date().toISOString() });
    }
  },

  async apiCall(url, method = 'POST') {
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.rankings) get().setRankings(data);
      if (data.strategy) get().setSuggestions(data.strategy);
      return data;
    } catch (e) {
      get().addLog({ level: 'ERROR', message: `API错误: ${e.message}`, time: new Date().toISOString() });
    }
  },

  async applyBid(adId, price) {
    try {
      const res = await fetch('/api/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId, price }),
      });
      const data = await res.json();
      get().addLog({
        level: data.success ? 'ACTION' : 'ERROR',
        message: data.success ? `改价成功: ${adId} → ${price}U` : `改价失败: ${data.error || data.confirmText}`,
        time: new Date().toISOString(),
      });
      return data;
    } catch (e) {
      get().addLog({ level: 'ERROR', message: `改价请求失败: ${e.message}`, time: new Date().toISOString() });
    }
  },

  async fetchMyAds() {
    try {
      const res = await fetch('/api/myads', { method: 'POST' });
      const data = await res.json();
      if (data.details) set({ myAdsDetail: data.details });
      return data;
    } catch (e) {
      get().addLog({ level: 'ERROR', message: `获取广告详情失败: ${e.message}`, time: new Date().toISOString() });
    }
  },

  async fetchStats(granularity = '1h', adId = null) {
    try {
      const params = new URLSearchParams({ granularity });
      if (adId) params.set('adId', adId);
      const res = await fetch(`/api/stats?${params}`);
      return await res.json();
    } catch (e) {
      get().addLog({ level: 'ERROR', message: `获取统计失败: ${e.message}`, time: new Date().toISOString() });
    }
  },
}));

export default useStore;
```

**Step 2: 创建 WebSocket hook**

`src/web/v2/src/hooks/useWebSocket.js`:

```js
import { useEffect, useRef } from 'react';
import useStore from '../stores/useStore';

export default function useWebSocket() {
  const wsRef = useRef(null);
  const setConnected = useStore((s) => s.setConnected);
  const setMonitoring = useStore((s) => s.setMonitoring);
  const setRankings = useStore((s) => s.setRankings);
  const setSuggestions = useStore((s) => s.setSuggestions);
  const addLog = useStore((s) => s.addLog);
  const setConfig = useStore((s) => s.setConfig);

  useEffect(() => {
    let reconnectTimer = null;

    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          switch (msg.type) {
            case 'log': addLog(msg.data); break;
            case 'rankings': setRankings(msg.data); break;
            case 'status': setMonitoring(msg.data.monitoring); break;
            case 'config': setConfig(msg.data); break;
            case 'suggestions': setSuggestions(msg.data); break;
            case 'bidResult':
              addLog({
                level: msg.data.success ? 'ACTION' : 'ERROR',
                message: msg.data.success
                  ? `自动改价成功: ${msg.data.adId} → ${msg.data.newPrice}U | ${msg.data.confirmText}`
                  : `自动改价失败: ${msg.data.adId} | ${msg.data.error || msg.data.confirmText}`,
                time: new Date().toISOString(),
              });
              break;
          }
        } catch {}
      };
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);
}
```

**Step 3: 在 App.jsx 中挂载 WebSocket + 初始化配置**

在 `App.jsx` 中添加:

```jsx
// 在 App 组件内部、return 之前添加:
import useWebSocket from './hooks/useWebSocket';
import useStore from './stores/useStore';
import { useEffect } from 'react';

// App 组件内:
useWebSocket();
const fetchConfig = useStore((s) => s.fetchConfig);
useEffect(() => { fetchConfig(); }, []);
```

**Step 4: 验证**

启动后端 `npm start`，启动前端 `cd src/web/v2 && npm run dev`。打开浏览器控制台检查 WebSocket 连接状态。

**Step 5: Commit**

```bash
git add src/web/v2/src/stores/ src/web/v2/src/hooks/ src/web/v2/src/App.jsx
git commit -m "feat(v2): add Zustand store and WebSocket hook"
```

---

### Task 4: 仪表盘 — ControlPanel + StatusChip

**Files:**
- Create: `src/web/v2/src/components/StatusChip.jsx`
- Create: `src/web/v2/src/components/ControlPanel.jsx`
- Create: `src/web/v2/src/pages/Dashboard.jsx`

**Step 1: 创建 StatusChip**

`src/web/v2/src/components/StatusChip.jsx`:

```jsx
import Chip from '@mui/material/Chip';
import CircleIcon from '@mui/icons-material/Circle';

export default function StatusChip({ label, active }) {
  return (
    <Chip
      icon={<CircleIcon sx={{ fontSize: 10 }} />}
      label={label}
      size="small"
      color={active ? 'success' : 'error'}
      variant="outlined"
      sx={{ '& .MuiChip-icon': { color: active ? 'success.main' : 'error.main' } }}
    />
  );
}
```

**Step 2: 创建 ControlPanel**

`src/web/v2/src/components/ControlPanel.jsx`:

```jsx
import Box from '@mui/material/Box';
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
          <Button
            variant="outlined"
            size="small"
            startIcon={<ExploreIcon />}
            onClick={() => apiCall('/api/navigate')}
            fullWidth
          >
            首次导航
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => apiCall('/api/refresh')}
            fullWidth
          >
            手动刷新
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<InfoOutlinedIcon />}
            onClick={fetchMyAds}
            fullWidth
          >
            广告详情
          </Button>

          <Divider sx={{ my: 1 }} />

          {monitoring ? (
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<StopIcon />}
              onClick={() => apiCall('/api/monitor/stop')}
              fullWidth
            >
              停止监控
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<PlayArrowIcon />}
              onClick={() => apiCall('/api/monitor/start')}
              fullWidth
            >
              启动监控
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
```

**Step 3: 创建 Dashboard 页面骨架**

`src/web/v2/src/pages/Dashboard.jsx`:

```jsx
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
```

**Step 4: 更新 App.jsx 路由**

将 Dashboard 占位替换为真实组件:

```jsx
import Dashboard from './pages/Dashboard';
// Route: <Route path="/" element={<Dashboard />} />
```

**Step 5: 验证**

预期: 仪表盘左栏显示控制面板，有连接状态、监控状态、操作按钮。

**Step 6: Commit**

```bash
git add src/web/v2/src/
git commit -m "feat(v2): add Dashboard with ControlPanel and StatusChip"
```

---

### Task 5: 仪表盘 — RankingTable

**Files:**
- Create: `src/web/v2/src/components/RankingTable.jsx`
- Modify: `src/web/v2/src/pages/Dashboard.jsx`

**Step 1: 创建 RankingTable**

`src/web/v2/src/components/RankingTable.jsx`:

```jsx
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import useStore from '../stores/useStore';

export default function RankingTable() {
  const rankings = useStore((s) => s.rankings);
  const rankingsTime = useStore((s) => s.rankingsTime);

  const timeStr = rankingsTime ? new Date(rankingsTime).toLocaleTimeString() : '--';

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" color="primary">
            实时排名
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {timeStr}
          </Typography>
        </Box>

        <TableContainer sx={{ flex: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>排名</TableCell>
                <TableCell>广告ID</TableCell>
                <TableCell>用户</TableCell>
                <TableCell align="right">价格(U/天)</TableCell>
                <TableCell align="center">标记</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rankings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      暂无数据，请先导航或刷新
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rankings.map((r, i) => (
                  <TableRow
                    key={i}
                    sx={{
                      bgcolor: r.isMine ? 'rgba(46, 204, 113, 0.08)' : 'transparent',
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={r.isMine ? 700 : 400}>
                        #{r.rank}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.adId}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {r.userId}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="secondary" fontWeight={700}>
                        {r.price}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {r.isMine && (
                        <Chip label="我的" size="small" color="success" variant="outlined" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 2: 集成到 Dashboard 中栏**

替换 Dashboard 中栏占位:

```jsx
import RankingTable from '../components/RankingTable';
// 中栏内容替换为: <RankingTable />
```

**Step 3: 验证 + Commit**

```bash
git add src/web/v2/src/
git commit -m "feat(v2): add RankingTable component to Dashboard"
```

---

### Task 6: 仪表盘 — SuggestionCard + LogPanel

**Files:**
- Create: `src/web/v2/src/components/SuggestionCard.jsx`
- Create: `src/web/v2/src/components/LogPanel.jsx`
- Modify: `src/web/v2/src/pages/Dashboard.jsx`

**Step 1: 创建 SuggestionCard**

`src/web/v2/src/components/SuggestionCard.jsx`:

```jsx
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import useStore from '../stores/useStore';

const actionConfig = {
  KEEP: { color: 'default', icon: '⏸', label: '保持' },
  RAISE: { color: 'error', icon: '⬆️', label: '加价' },
  LOWER: { color: 'success', icon: '⬇️', label: '降价' },
  SKIP: { color: 'warning', icon: '⏭️', label: '跳过' },
};

function SuggestionItem({ s }) {
  const config = useStore((s) => s.config);
  const applyBid = useStore((s) => s.applyBid);
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
            suggestions.map((s, i) => <SuggestionItem key={i} s={s} />)
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
```

**Step 2: 创建 LogPanel**

`src/web/v2/src/components/LogPanel.jsx`:

```jsx
import { useRef, useEffect } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import useStore from '../stores/useStore';

const levelColors = {
  INFO: 'info.main',
  WARN: 'warning.main',
  ERROR: 'error.main',
  ACTION: 'success.main',
};

export default function LogPanel() {
  const logs = useStore((s) => s.logs);
  const clearLogs = useStore((s) => s.clearLogs);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 200 }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', py: 1, '&:last-child': { pb: 1 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="subtitle2" color="primary">
            操作日志
          </Typography>
          <IconButton size="small" onClick={clearLogs}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', fontFamily: 'monospace', fontSize: '0.75rem' }}>
          {logs.map((entry) => (
            <Box key={entry._id} sx={{ py: 0.25, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography component="span" variant="caption" color="text.disabled" sx={{ mr: 1 }}>
                {new Date(entry.time).toLocaleTimeString()}
              </Typography>
              <Typography component="span" variant="caption" color={levelColors[entry.level] || 'text.primary'} fontWeight={700} sx={{ mr: 1 }}>
                [{entry.level}]
              </Typography>
              <Typography component="span" variant="caption">
                {entry.message}
              </Typography>
            </Box>
          ))}
          <div ref={bottomRef} />
        </Box>
      </CardContent>
    </Card>
  );
}
```

**Step 3: 集成到 Dashboard 右栏**

更新 Dashboard.jsx 右栏:

```jsx
import SuggestionPanel from '../components/SuggestionCard';
import LogPanel from '../components/LogPanel';

// 右栏:
<Box sx={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
  <SuggestionPanel />
  <LogPanel />
</Box>
```

**Step 4: 验证 + Commit**

```bash
git add src/web/v2/src/
git commit -m "feat(v2): add SuggestionPanel and LogPanel to Dashboard"
```

---

### Task 7: 统计趋势页 — Analytics (MUI X Charts)

**Files:**
- Create: `src/web/v2/src/pages/Analytics.jsx`
- Modify: `src/web/v2/src/App.jsx`

**Step 1: 创建 Analytics 页面**

`src/web/v2/src/pages/Analytics.jsx`:

```jsx
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
```

**Step 2: 更新 App.jsx 路由**

```jsx
import Analytics from './pages/Analytics';
// <Route path="/analytics" element={<Analytics />} />
```

**Step 3: 验证 + Commit**

```bash
git add src/web/v2/src/
git commit -m "feat(v2): add Analytics page with MUI X Charts"
```

---

### Task 8: 配置管理页 — Settings

**Files:**
- Create: `src/web/v2/src/components/AdConfigForm.jsx`
- Create: `src/web/v2/src/pages/Settings.jsx`
- Modify: `src/web/v2/src/App.jsx`

**Step 1: 创建 AdConfigForm**

`src/web/v2/src/components/AdConfigForm.jsx`:

```jsx
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
```

**Step 2: 创建 Settings 页面**

`src/web/v2/src/pages/Settings.jsx`:

```jsx
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AdConfigForm from '../components/AdConfigForm';
import useStore from '../stores/useStore';

export default function Settings() {
  const storeConfig = useStore((s) => s.config);
  const saveConfigApi = useStore((s) => s.saveConfig);
  const [config, setConfig] = useState({});
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    setConfig(JSON.parse(JSON.stringify(storeConfig)));
  }, [storeConfig]);

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

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
```

**Step 3: 更新 App.jsx 路由**

```jsx
import Settings from './pages/Settings';
// <Route path="/settings" element={<Settings />} />
```

**Step 4: 验证 + Commit**

```bash
git add src/web/v2/src/
git commit -m "feat(v2): add Settings page with AdConfigForm"
```

---

### Task 9: 调试工具页 — Debug

**Files:**
- Create: `src/web/v2/src/pages/Debug.jsx`
- Modify: `src/web/v2/src/App.jsx`

**Step 1: 创建 Debug 页面**

`src/web/v2/src/pages/Debug.jsx`:

```jsx
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
```

**Step 2: 更新 App.jsx 路由**

```jsx
import Debug from './pages/Debug';
// <Route path="/debug" element={<Debug />} />
```

**Step 3: 验证 + Commit**

```bash
git add src/web/v2/src/
git commit -m "feat(v2): add Debug page"
```

---

### Task 10: 后端路由 + 构建 + 最终集成

**Files:**
- Modify: `src/web/server.js:185-188` — 添加 V2 静态路由
- Modify: `src/web/v2/vite.config.js` — 确认 build 输出路径

**Step 1: 修改后端 server.js，添加 V2 路由**

在 `server.js` 的 `startWebServer` 函数中，`app.use(express.static(...))` 之后添加:

```js
// V2 前端
const v2Path = path.join(__dirname, 'public-v2');
app.use('/v2', express.static(v2Path));
// V2 SPA fallback: 所有 /v2/* 路由返回 index.html
app.get('/v2/*', (req, res) => {
  res.sendFile(path.join(v2Path, 'index.html'));
});
```

**Step 2: 更新 vite.config.js — base 路径**

```js
export default defineConfig({
  plugins: [react()],
  base: '/v2/',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../public-v2',
    emptyOutDir: true,
  },
});
```

同时更新 `App.jsx` 的 BrowserRouter:

```jsx
<BrowserRouter basename="/v2">
```

**Step 3: 构建**

```bash
cd src/web/v2 && npm run build
```

预期: 构建产物输出到 `src/web/public-v2/`。

**Step 4: 验证**

启动后端 `npm start`，访问 `http://localhost:3000/v2` 能看到 V2 界面。

**Step 5: 将 public-v2 加入 gitignore**

在项目根目录 `.gitignore` 中添加:

```
src/web/public-v2/
```

**Step 6: Commit**

```bash
git add src/web/server.js src/web/v2/ .gitignore
git commit -m "feat(v2): add backend route and build config for V2 frontend"
```

---

## 任务依赖关系

```
Task 1 (Vite初始化)
  → Task 2 (主题+导航)
    → Task 3 (Store+WS)
      → Task 4 (控制面板)
      → Task 5 (排名表)
      → Task 6 (建议+日志)
        → Task 7 (统计页)
        → Task 8 (配置页)
        → Task 9 (调试页)
          → Task 10 (集成)
```

Task 4/5/6 可并行，Task 7/8/9 可并行。
