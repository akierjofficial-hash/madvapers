import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';

export const requestDialogSx: SxProps<Theme> = (theme) => ({
  '& .MuiDialog-paper': {
    borderRadius: 3,
    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
    backgroundImage: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.985)} 0%, ${alpha(
      theme.palette.background.default,
      0.985
    )} 100%)`,
    boxShadow: '0 28px 72px rgba(15, 23, 42, 0.18)',
    overflow: 'hidden',
  },
});

export const requestDialogTitleSx: SxProps<Theme> = (theme) => ({
  px: { xs: 2.25, sm: 3 },
  py: 2,
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
  backgroundImage: `linear-gradient(120deg, ${alpha(theme.palette.primary.light, 0.14)} 0%, ${alpha(
    theme.palette.background.paper,
    0.94
  )} 52%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
});

export const requestDialogContentSx: SxProps<Theme> = {
  px: { xs: 2, sm: 3 },
  py: 2.25,
};

export const requestDialogActionsSx: SxProps<Theme> = (theme) => ({
  px: { xs: 2, sm: 3 },
  py: 1.75,
  borderTop: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
});

export const requestSectionSx = (theme: Theme) => ({
  p: { xs: 1.2, sm: 1.5 },
  borderRadius: 2,
  borderColor: alpha(theme.palette.divider, 0.9),
  backgroundColor: alpha(theme.palette.background.paper, 0.72),
});
