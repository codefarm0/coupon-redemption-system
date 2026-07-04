import { useState } from 'react';
import {
  Card, CardContent, Typography, Button, Stack,
  LinearProgress, Box,
} from '@mui/material';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import RedemptionDialog from './RedemptionDialog';
import { generateRandomNames } from '../utils/randomNames';
import { redeemCoupon } from '../api/client';

function CouponCard({ coupon, onRefresh }) {
  const [claiming, setClaiming] = useState(false);
  const [dialog, setDialog] = useState(null);

  const handleClaim = async (count) => {
    setClaiming(true);
    const users = generateRandomNames(count);
    const results = [];

    setDialog({
      open: true,
      users,
      results: [],
      total: count,
      completed: 0,
      done: false,
    });

    const promises = users.map((username) =>
      redeemCoupon({ couponCode: coupon.code, username }).then((res) => {
        results.push({ username, ...res });
        setDialog((prev) => ({
          ...prev,
          results: [...results],
          completed: results.length,
        }));
        return res;
      })
    );

    await Promise.allSettled(promises);
    setDialog((prev) => ({ ...prev, done: true }));
    setClaiming(false);
    onRefresh();
  };

  const handleCloseDialog = () => {
    setDialog(null);
  };

  const remaining = coupon.remainingRedemptions;
  const total = coupon.totalRedemptions;
  const pct = total > 0 ? (remaining / total) * 100 : 0;

  return (
    <>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
            <LocalOfferIcon color="primary" />
            <Typography variant="h5" fontWeight={700} letterSpacing={1}>
              {coupon.code}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={4} mb={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Remaining
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {remaining}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Total
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {total}
              </Typography>
            </Box>
          </Stack>

          <LinearProgress
            variant="determinate"
            value={pct}
            color={pct > 30 ? 'primary' : pct > 10 ? 'warning' : 'error'}
            sx={{ height: 8, borderRadius: 4, mb: 2 }}
          />

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              size="small"
              disabled={claiming || remaining <= 0}
              onClick={() => handleClaim(1)}
            >
              Claim Once
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={claiming || remaining <= 0}
              onClick={() => handleClaim(10)}
            >
              Claim x10
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={claiming || remaining <= 0}
              onClick={() => handleClaim(100)}
            >
              Claim x100
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={claiming || remaining <= 0}
              onClick={() => handleClaim(1000)}
            >
              Claim x1000
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {dialog && (
        <RedemptionDialog
          open={dialog.open}
          couponCode={coupon.code}
          results={dialog.results}
          total={dialog.total}
          completed={dialog.completed}
          done={dialog.done}
          onClose={handleCloseDialog}
        />
      )}
    </>
  );
}

export default CouponCard;
