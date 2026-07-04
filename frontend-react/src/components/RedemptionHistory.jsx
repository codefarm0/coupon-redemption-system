import { useState, useEffect, useCallback } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Chip, Pagination, Box, FormControl, InputLabel,
  Select, MenuItem, Stack, CircularProgress,
} from '@mui/material';
import { getCoupons, getRedemptions } from '../api/client';

function RedemptionHistory() {
  const [coupons, setCoupons] = useState([]);
  const [selectedCouponId, setSelectedCouponId] = useState('');
  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCoupons(0, 100).then((res) => setCoupons(res.content));
  }, []);

  const fetchRedemptions = useCallback(async () => {
    if (!selectedCouponId) return;
    setLoading(true);
    try {
      const result = await getRedemptions(parseInt(selectedCouponId, 10), page, 5);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [selectedCouponId, page]);

  useEffect(() => {
    fetchRedemptions();
  }, [fetchRedemptions]);

  const handleCouponChange = (e) => {
    setSelectedCouponId(e.target.value);
    setPage(0);
    setData(null);
  };

  const handlePageChange = (_, value) => {
    setPage(value - 1);
  };

  const selectedCoupon = coupons.find((c) => c.id === parseInt(selectedCouponId, 10));

  return (
    <>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Redemption History
      </Typography>

      <FormControl size="small" sx={{ minWidth: 280, mb: 3 }}>
        <InputLabel>Select Coupon</InputLabel>
        <Select
          value={selectedCouponId}
          label="Select Coupon"
          onChange={handleCouponChange}
        >
          {coupons.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.code} (Remaining: {c.remainingRedemptions}/{c.totalRedemptions})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {!selectedCouponId && (
        <Typography color="text.secondary" textAlign="center" py={4}>
          Select a coupon to view its redemption history.
        </Typography>
      )}

      {selectedCouponId && loading && !data && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {selectedCouponId && data && (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" color="text.secondary">
              Showing {data.totalElements} redemption{data.totalElements !== 1 ? 's' : ''} for <strong>{selectedCoupon?.code}</strong>
            </Typography>
          </Stack>

          {data.content.length > 0 ? (
            <>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Username</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Coupon</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Redeemed At</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.content.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.username}</TableCell>
                        <TableCell>{r.couponCode}</TableCell>
                        <TableCell>
                          <Chip
                            label={r.status}
                            size="small"
                            color={r.status === 'SUCCESS' ? 'success' : 'error'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(r.redeemedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {data.totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={2}>
                  <Pagination
                    count={data.totalPages}
                    page={page + 1}
                    onChange={handlePageChange}
                    color="primary"
                  />
                </Box>
              )}
            </>
          ) : (
            <Typography color="text.secondary" textAlign="center" py={4}>
              No redemptions yet for this coupon.
            </Typography>
          )}
        </>
      )}
    </>
  );
}

export default RedemptionHistory;
