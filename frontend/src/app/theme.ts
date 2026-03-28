import { alpha, createTheme } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';

const palette = {
  primary: {
    main: '#0f766e',
    light: '#2ea99f',
    dark: '#0b4d48',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#b45309',
    contrastText: '#1f2937',
  },
  background: {
    default: '#f3f6f8',
    paper: '#ffffff',
  },
  text: {
    primary: '#111827',
    secondary: '#475467',
  },
  divider: '#d9e2ec',
};

const themeOptions: ThemeOptions = {
  palette,
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '"DM Sans", "Avenir Next", "Segoe UI", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.015em' },
    h6: { fontWeight: 700, letterSpacing: '-0.01em' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minHeight: '100vh',
          backgroundImage: [
            'radial-gradient(circle at 6% 6%, rgba(15,118,110,0.1), transparent 30%)',
            'radial-gradient(circle at 94% 12%, rgba(245,158,11,0.1), transparent 26%)',
            'linear-gradient(180deg, #f8fafc 0%, #f3f6f8 100%)',
          ].join(','),
          backgroundAttachment: 'fixed',
        },
        '#root': {
          minHeight: '100vh',
        },
        '*::-webkit-scrollbar': {
          width: 10,
          height: 10,
        },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(15, 118, 110, 0.25)',
          borderRadius: 999,
          border: '2px solid transparent',
          backgroundClip: 'padding-box',
        },
        '@media (max-width:900px)': {
          body: {
            backgroundImage: [
              'radial-gradient(circle at 8% 4%, rgba(15,118,110,0.11), transparent 32%)',
              'radial-gradient(circle at 92% 10%, rgba(245,158,11,0.1), transparent 28%)',
              'linear-gradient(180deg, #f8fafc 0%, #f3f6f8 100%)',
            ].join(','),
          },
          '.MuiPaper-root': {
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          },
          '.MuiPaper-root .MuiTable-root': {
            minWidth: '100%',
          },
          '.MuiTableCell-root': {
            paddingTop: 10,
            paddingBottom: 10,
          },
          '.MuiDialog-paper': {
            margin: 10,
            width: 'calc(100% - 20px)',
            maxHeight: 'calc(100% - 20px)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.84),
          color: '#111827',
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${alpha('#d9e2ec', 0.8)}`,
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: `1px solid ${alpha('#d9e2ec', 0.9)}`,
          boxShadow: '0 8px 24px rgba(16, 24, 40, 0.04)',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 14,
          minHeight: 38,
          '@media (max-width:900px)': {
            minHeight: 42,
            paddingInline: 12,
          },
        },
        contained: {
          boxShadow: '0 6px 14px rgba(15, 118, 110, 0.2)',
        },
        outlined: {
          borderColor: alpha('#98a2b3', 0.65),
          backgroundColor: alpha('#ffffff', 0.8),
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 600,
          '@media (max-width:900px)': {
            minHeight: 28,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          alignItems: 'center',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 14,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#0f766e', 0.04),
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          letterSpacing: '0.02em',
          color: '#344054',
          borderBottomColor: alpha('#d9e2ec', 0.9),
          whiteSpace: 'nowrap',
        },
        body: {
          borderBottomColor: alpha('#e4e7ec', 0.85),
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: alpha('#0f766e', 0.04),
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: alpha('#ffffff', 0.9),
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#98a2b3', 0.6),
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#667085', 0.7),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#0f766e',
            borderWidth: 2,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          border: `1px solid ${alpha('#d9e2ec', 0.95)}`,
          boxShadow: '0 20px 45px rgba(16, 24, 40, 0.18)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          borderBottom: `1px solid ${alpha('#e4e7ec', 0.8)}`,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          paddingTop: 18,
          paddingBottom: 18,
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '12px 20px 18px',
          borderTop: `1px solid ${alpha('#e4e7ec', 0.8)}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          borderRight: `1px solid ${alpha('#d9e2ec', 0.9)}`,
          backgroundColor: alpha('#fcfdff', 0.97),
          backgroundImage:
            'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(247,250,252,0.95) 100%)',
        },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          '@media (max-width:900px)': {
            minWidth: 34,
            height: 34,
          },
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 66,
          paddingTop: 8,
          paddingBottom: 8,
        },
        label: {
          fontWeight: 600,
        },
      },
    },
  },
};

export const appTheme = createTheme(themeOptions);
