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
