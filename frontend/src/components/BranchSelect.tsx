import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
} from '@mui/material';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Branch } from '../types/models';

export function BranchSelect({
  branches,
  value,
  onChange,
  label = 'Branch',
  disabled = false,
  showAlertDot = false,
  alertDotTitle = 'Pending branch alerts',
  onAlertDotClick,
  showBranchAlertDots = false,
  alertCountsByBranchId,
}: {
  branches: Branch[];
  value: number | '';
  onChange: (branchId: number) => void;
  label?: string;
  disabled?: boolean;
  showAlertDot?: boolean;
  alertDotTitle?: string;
  onAlertDotClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  showBranchAlertDots?: boolean;
  alertCountsByBranchId?: Record<number, number>;
}) {
  const handleAlertDotClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onAlertDotClick?.(event);
  };
  const branchLabelById = new Map<number, string>();
  for (const branch of branches) {
    branchLabelById.set(branch.id, `${branch.code} - ${branch.name}`);
  }

  return (
    <FormControl fullWidth size="small" sx={{ position: 'relative' }}>
      {showAlertDot && (
        <Tooltip title={alertDotTitle} arrow>
          <IconButton
            size="small"
            aria-label="Open pending branch alerts"
            onClick={handleAlertDotClick}
            sx={(theme) => ({
              position: 'absolute',
              top: -7,
              right: -7,
              zIndex: 3,
              width: 20,
              height: 20,
              p: 0,
              bgcolor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              '&:hover': { bgcolor: theme.palette.background.paper },
            })}
          >
            <Box
              component="span"
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: 'error.main',
              }}
            />
          </IconButton>
        </Tooltip>
      )}
      <InputLabel id="branch-select-label">{label}</InputLabel>
      <Select
        labelId="branch-select-label"
        value={value}
        label={label}
        disabled={disabled}
        renderValue={(selectedValue) => {
          const id = Number(selectedValue);
          if (!Number.isFinite(id) || id <= 0) return '';
          return branchLabelById.get(id) ?? '';
        }}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {branches.map((b) => (
          <MenuItem key={b.id} value={b.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
              <span>{b.code} - {b.name}</span>
              {showBranchAlertDots && Number(alertCountsByBranchId?.[b.id] ?? 0) > 0 ? (
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    flexShrink: 0,
                  }}
                />
              ) : null}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
