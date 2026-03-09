import Chip from '@mui/material/Chip';
import CircleIcon from '@mui/icons-material/Circle';

export default function StatusChip({ label, active }) {
  return (
    <Chip
      icon={<CircleIcon sx={{ fontSize: 10 }} />}
      label={label}
      size="small"
      color={active ? 'success' : 'error'}
      variant="outlined"
      sx={{ '& .MuiChip-icon': { color: active ? 'success.main' : 'error.main' } }}
    />
  );
}
