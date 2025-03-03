import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#3182f6',
      light: '#e7f0fe',
      dark: '#1b64da'
    },
    secondary: {
      main: '#4e5968',
      light: '#f2f4f6',
      dark: '#333d4b'
    },
    error: {
      main: '#f04452',
      light: '#fee4e2',
      dark: '#d92d3c'
    },
    success: {
      main: '#00c773',
      light: '#e8f8ef',
      dark: '#00a661'
    },
    warning: {
      main: '#ffa927',
      light: '#fff5e6',
      dark: '#f59300'
    },
    background: {
      default: '#f9fafb',
      paper: '#ffffff'
    },
    text: {
      primary: '#191f28',
      secondary: '#4e5968'
    }
  },
  typography: {
    fontFamily: '"Pretendard", -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
    h5: {
      fontWeight: 600,
      fontSize: '1.5rem'
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.25rem'
    },
    subtitle1: {
      fontWeight: 600,
      fontSize: '1rem'
    },
    body1: {
      fontSize: '0.95rem'
    },
    body2: {
      fontSize: '0.875rem'
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '8px 16px'
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none'
          }
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: '#f9fafb',
            '&:hover': {
              backgroundColor: '#f2f4f6'
            }
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)'
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600
        }
      }
    }
  }
});

export default theme; 