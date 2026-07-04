import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, LinearProgress, List, ListItem,
  ListItemIcon, ListItemText, Chip, Stack, Box, Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

function RedemptionDialog({
  open, couponCode, results, total, completed, done, onClose,
}) {
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Dialog open={open} onClose={done ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6" fontWeight={600}>
            Claiming {couponCode}
          </Typography>
          <Chip
            label={`${completed} / ${total}`}
            size="small"
            color={done ? 'success' : 'primary'}
          />
        </Stack>
      </DialogTitle>
      <DialogContent>
        {!done && (
          <Box mb={2}>
            <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
            <Typography variant="caption" color="text.secondary" mt={0.5}>
              Processing {completed} of {total} requests...
            </Typography>
          </Box>
        )}

        {done && successes.length > 0 && (
          <Box mb={2}>
            <Typography variant="subtitle2" color="success.main" gutterBottom fontWeight={600}>
              Successful Redemption ({successes.length})
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {successes.map((r, i) => (
                <Stack key={i} direction="row" alignItems="center" spacing={1} py={0.3}>
                  <CheckCircleIcon color="success" fontSize="small" />
                  <Typography variant="body2">{r.username}</Typography>
                  <Chip label={r.instanceName} size="small" variant="outlined" sx={{ ml: 'auto', fontSize: '0.65rem' }} />
                </Stack>
              ))}
            </Box>
          </Box>
        )}

        {done && failures.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box>
              <Typography variant="subtitle2" color="error.main" gutterBottom fontWeight={600}>
                Coupon Exhausted ({failures.length})
              </Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {failures.map((r, i) => (
                  <Stack key={i} direction="row" alignItems="center" spacing={1} py={0.3}>
                    <CancelIcon color="error" fontSize="small" />
                    <Typography variant="body2">{r.username}</Typography>
                    <Chip label={r.instanceName} size="small" variant="outlined" sx={{ ml: 'auto', fontSize: '0.65rem' }} />
                  </Stack>
                ))}
              </Box>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" disabled={!done}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RedemptionDialog;
