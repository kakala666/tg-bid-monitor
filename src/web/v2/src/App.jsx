import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import theme from './theme';
import NavigationRail, { NAV_WIDTH } from './components/NavigationRail';
import useWebSocket from './hooks/useWebSocket';
import useStore from './stores/useStore';
import Dashboard from './pages/Dashboard';

function Placeholder({ title }) {
  return <Typography variant="h5" sx={{ p: 3 }}>{title}</Typography>;
}

export default function App() {
  useWebSocket();
  const fetchConfig = useStore((s) => s.fetchConfig);
  useEffect(() => { fetchConfig(); }, []);

  return (
    <ThemeProvider theme={theme} defaultMode="dark">
      <CssBaseline />
      <BrowserRouter>
        <Box sx={{ display: 'flex', height: '100vh' }}>
          <NavigationRail />
          <Box component="main" sx={{ flexGrow: 1, overflow: 'auto', ml: `${NAV_WIDTH}px` }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
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
