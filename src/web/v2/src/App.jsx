import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import Box from '@mui/material/Box';
import theme from './theme';
import NavigationRail, { NAV_WIDTH } from './components/NavigationRail';
import useWebSocket from './hooks/useWebSocket';
import useStore from './stores/useStore';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Debug from './pages/Debug';

export default function App() {
  useWebSocket();
  const fetchConfig = useStore((s) => s.fetchConfig);
  useEffect(() => { fetchConfig(); }, []);

  return (
    <ThemeProvider theme={theme} defaultMode="dark">
      <CssBaseline />
      <BrowserRouter basename="/v2">
        <Box sx={{ display: 'flex', height: '100vh' }}>
          <NavigationRail />
          <Box component="main" sx={{ flexGrow: 1, overflow: 'auto', ml: `${NAV_WIDTH}px` }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/debug" element={<Debug />} />
            </Routes>
          </Box>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}
