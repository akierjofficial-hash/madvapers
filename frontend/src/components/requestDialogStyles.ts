import type { SxProps, Theme } from '@mui/material/styles';

export const requestDialogSx: SxProps<Theme> = (theme) => ({
  '& .MuiDialog-paper': {
    borderRadius: 3,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    backgroundImage: 'none',
    boxShadow: '0 20px 44px rgba(16, 24, 40, 0.18)',
    overflow: 'hidden',
    color: theme.palette.text.primary,
  },
});

export const requestDialogTitleSx: SxProps<Theme> = (theme) => ({
  px: { xs: 2.25, sm: 3 },
  py: 2,
  borderBottom: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  color: theme.palette.text.primary,
});

export const requestDialogContentSx: SxProps<Theme> = (theme) => ({
  px: { xs: 2, sm: 3 },
  py: 2.25,
  background: theme.palette.background.paper,
  color: theme.palette.text.primary,
});

export const requestDialogActionsSx: SxProps<Theme> = (theme) => ({
  px: { xs: 2, sm: 3 },
  py: 1.75,
  borderTop: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
});

export const requestSectionSx = (theme: Theme) => ({
  p: { xs: 1.2, sm: 1.5 },
  borderRadius: 2,
  borderColor: theme.palette.divider,
  backgroundColor: theme.palette.background.paper,
});
