import type { SxProps, Theme } from '@mui/material/styles';

export const requestDialogSx: SxProps<Theme> = (_theme) => ({
  '& .MuiDialog-paper': {
    borderRadius: 3,
    border: '1px solid #364156',
    backgroundColor: 'rgba(10, 17, 30, 0.98)',
    backgroundImage: 'none',
    boxShadow: '0 28px 72px rgba(2, 8, 22, 0.58)',
    overflow: 'hidden',
    color: '#f4f7ff',
  },
});

export const requestDialogTitleSx: SxProps<Theme> = () => ({
  px: { xs: 2.25, sm: 3 },
  py: 2,
  borderBottom: '1px solid rgba(54, 65, 86, 0.9)',
  background: 'rgba(14, 22, 36, 0.95)',
  color: '#f4f7ff',
});

export const requestDialogContentSx: SxProps<Theme> = {
  px: { xs: 2, sm: 3 },
  py: 2.25,
  background: 'rgba(10, 17, 30, 0.98)',
  color: '#f4f7ff',
};

export const requestDialogActionsSx: SxProps<Theme> = () => ({
  px: { xs: 2, sm: 3 },
  py: 1.75,
  borderTop: '1px solid rgba(54, 65, 86, 0.9)',
  background: 'rgba(14, 22, 36, 0.95)',
});

export const requestSectionSx = (_theme: Theme) => ({
  p: { xs: 1.2, sm: 1.5 },
  borderRadius: 2,
  borderColor: 'rgba(54, 65, 86, 0.9)',
  backgroundColor: 'rgba(34, 42, 56, 0.9)',
});
