import { useState } from 'react';
import {
  Card, CardContent, Typography, TextField, Button, Stack, Alert, Snackbar,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { createCoupon } from '../api/client';

function CreateCoupon({ onCreated }) {
  const [code, setCode] = useState('');
  const [totalRedemptions, setTotalRedemptions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Coupon code is required');
      return;
    }
    if (!totalRedemptions || parseInt(totalRedemptions, 10) <= 0) {
      setError('Total redemptions must be a positive number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await createCoupon({ code: code.trim().toUpperCase(), totalRedemptions: parseInt(totalRedemptions, 10) });
      setSnackbar(`Coupon ${code.trim().toUpperCase()} created successfully!`);
      setCode('');
      setTotalRedemptions('');
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <AddCircleIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Create Coupon
            </Typography>
          </Stack>
          <form onSubmit={handleSubmit}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <TextField
                label="Coupon Code"
                size="small"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. SUMMER50"
                sx={{ flexGrow: 1 }}
              />
              <TextField
                label="Total Redemptions"
                type="number"
                size="small"
                value={totalRedemptions}
                onChange={(e) => setTotalRedemptions(e.target.value)}
                placeholder="100"
                sx={{ width: 180 }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{ height: 40 }}
              >
                {loading ? 'Creating...' : 'Create'}
              </Button>
            </Stack>
            {error && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {error}
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar('')}
        message={snackbar}
      />
    </>
  );
}

export default CreateCoupon;
