import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { Branch } from '../types/models';

export function BranchSelect({
  branches,
  value,
  onChange,
  label = 'Branch',
  disabled = false,
}: {
  branches: Branch[];
  value: number | '';
  onChange: (branchId: number) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel id="branch-select-label">{label}</InputLabel>
      <Select
        labelId="branch-select-label"
        value={value}
        label={label}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {branches.map((b) => (
          <MenuItem key={b.id} value={b.id}>
            {b.code} — {b.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
