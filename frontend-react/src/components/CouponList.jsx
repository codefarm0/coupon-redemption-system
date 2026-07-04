import { useState, useEffect, useCallback } from 'react';
import {
  Grid, Pagination, Typography, Box, Stack, Chip, CircularProgress,
} from '@mui/material';
import CouponCard from './CouponCard';
import CreateCoupon from './CreateCoupon';
import { getCoupons } from '../api/client';

function CouponList({ refreshKey }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCoupons(page, 5);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons, refreshKey]);

  const handlePageChange = (_, value) => {
    setPage(value - 1);
  };

  const handleRefresh = () => {
    fetchCoupons();
  };

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <CreateCoupon onCreated={handleRefresh} />
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          Coupons
        </Typography>
        {data && (
          <Chip
            label={`${data.totalElements} total`}
            size="small"
            variant="outlined"
          />
        )}
      </Stack>
      {data && data.content.length > 0 ? (
        <>
          <Grid container spacing={2}>
            {data.content.map((coupon) => (
              <Grid item xs={12} sm={6} md={4} key={coupon.id}>
                <CouponCard coupon={coupon} onRefresh={handleRefresh} />
              </Grid>
            ))}
          </Grid>
          {data.totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
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
          No coupons yet. Create one above.
        </Typography>
      )}
    </>
  );
}

export default CouponList;
