const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let nextCouponId = 26;
let nextRedemptionId = 1;
let lockEnabled = true;

const instances = ['coupon-app-1', 'coupon-app-2', 'coupon-app-3'];

const initialCoupons = [
  { id: 1, code: 'SUMMER50', totalRedemptions: 100, remainingRedemptions: 100, createdAt: '2026-06-01T10:00:00Z' },
  { id: 2, code: 'WELCOME10', totalRedemptions: 50, remainingRedemptions: 50, createdAt: '2026-06-01T11:00:00Z' },
  { id: 3, code: 'FLASH25', totalRedemptions: 200, remainingRedemptions: 200, createdAt: '2026-06-02T10:00:00Z' },
  { id: 4, code: 'SAVE20', totalRedemptions: 75, remainingRedemptions: 75, createdAt: '2026-06-02T12:00:00Z' },
  { id: 5, code: 'VIP100', totalRedemptions: 10, remainingRedemptions: 10, createdAt: '2026-06-03T09:00:00Z' },
  { id: 6, code: 'NEWUSER', totalRedemptions: 500, remainingRedemptions: 500, createdAt: '2026-06-03T14:00:00Z' },
  { id: 7, code: 'WEEKEND', totalRedemptions: 150, remainingRedemptions: 150, createdAt: '2026-06-04T08:00:00Z' },
  { id: 8, code: 'FREESHIP', totalRedemptions: 300, remainingRedemptions: 300, createdAt: '2026-06-04T16:00:00Z' },
  { id: 9, code: 'BONUS30', totalRedemptions: 80, remainingRedemptions: 80, createdAt: '2026-06-05T10:00:00Z' },
  { id: 10, code: 'LOYALTY', totalRedemptions: 25, remainingRedemptions: 25, createdAt: '2026-06-05T11:00:00Z' },
  { id: 11, code: 'FIRST50', totalRedemptions: 50, remainingRedemptions: 50, createdAt: '2026-06-06T10:00:00Z' },
  { id: 12, code: 'DEAL25', totalRedemptions: 25, remainingRedemptions: 25, createdAt: '2026-06-06T11:00:00Z' },
  { id: 13, code: 'MEGA100', totalRedemptions: 100, remainingRedemptions: 100, createdAt: '2026-06-07T10:00:00Z' },
  { id: 14, code: 'HOT50', totalRedemptions: 50, remainingRedemptions: 50, createdAt: '2026-06-07T12:00:00Z' },
  { id: 15, code: 'SALE20', totalRedemptions: 20, remainingRedemptions: 20, createdAt: '2026-06-08T09:00:00Z' },
  { id: 16, code: 'PREMIUM', totalRedemptions: 5, remainingRedemptions: 5, createdAt: '2026-06-08T14:00:00Z' },
  { id: 17, code: 'EXTRA10', totalRedemptions: 10, remainingRedemptions: 10, createdAt: '2026-06-09T10:00:00Z' },
  { id: 18, code: 'BIG100', totalRedemptions: 100, remainingRedemptions: 100, createdAt: '2026-06-09T11:00:00Z' },
  { id: 19, code: 'COUPON5', totalRedemptions: 5, remainingRedemptions: 5, createdAt: '2026-06-10T10:00:00Z' },
  { id: 20, code: 'SUPER25', totalRedemptions: 25, remainingRedemptions: 25, createdAt: '2026-06-10T12:00:00Z' },
  { id: 21, code: 'MEGA50', totalRedemptions: 50, remainingRedemptions: 50, createdAt: '2026-06-11T10:00:00Z' },
  { id: 22, code: 'VIPGOLD', totalRedemptions: 15, remainingRedemptions: 15, createdAt: '2026-06-11T11:00:00Z' },
  { id: 23, code: 'SEASON', totalRedemptions: 200, remainingRedemptions: 200, createdAt: '2026-06-12T10:00:00Z' },
  { id: 24, code: 'HOLIDAY', totalRedemptions: 100, remainingRedemptions: 100, createdAt: '2026-06-12T14:00:00Z' },
  { id: 25, code: 'SPECIAL', totalRedemptions: 10, remainingRedemptions: 10, createdAt: '2026-06-13T10:00:00Z' },
];

const coupons = [...initialCoupons];
const redemptions = [];

export function setLockEnabled(enabled) {
  lockEnabled = enabled;
}

export function getLockEnabled() {
  return lockEnabled;
}

export async function getCoupons(page = 0, size = 5) {
  await delay(200 + Math.random() * 200);
  const start = page * size;
  const end = start + size;
  const content = coupons.slice(start, end).map((c) => ({
    id: c.id,
    code: c.code,
    totalRedemptions: c.totalRedemptions,
    remainingRedemptions: c.remainingRedemptions,
    createdAt: c.createdAt,
  }));
  return {
    content,
    page,
    size,
    totalPages: Math.ceil(coupons.length / size),
    totalElements: coupons.length,
  };
}

export async function createCoupon({ code, totalRedemptions }) {
  await delay(300 + Math.random() * 200);
  const existing = coupons.find((c) => c.code === code);
  if (existing) {
    throw new Error('Coupon code already exists');
  }
  const coupon = {
    id: nextCouponId++,
    code,
    totalRedemptions,
    remainingRedemptions: totalRedemptions,
    createdAt: new Date().toISOString(),
  };
  coupons.push(coupon);
  return {
    id: coupon.id,
    code: coupon.code,
    remainingRedemptions: coupon.remainingRedemptions,
  };
}

export async function redeemCoupon({ couponCode, username }) {
  await delay(50 + Math.random() * 150);
  const coupon = coupons.find((c) => c.code === couponCode);
  if (!coupon) {
    return { success: false, message: 'Coupon Not Found' };
  }

  if (lockEnabled) {
    if (coupon.remainingRedemptions <= 0) {
      const redemption = {
        id: nextRedemptionId++,
        couponId: coupon.id,
        couponCode: coupon.code,
        username,
        status: 'FAILED',
        redeemedAt: new Date().toISOString(),
      };
      redemptions.push(redemption);
      const instanceName = instances[Math.floor(Math.random() * instances.length)];
      return { success: false, message: 'Coupon Exhausted', instanceName };
    }
    coupon.remainingRedemptions--;
  } else {
    coupon.remainingRedemptions--;
  }

  const redemption = {
    id: nextRedemptionId++,
    couponId: coupon.id,
    couponCode: coupon.code,
    username,
    status: 'SUCCESS',
    redeemedAt: new Date().toISOString(),
  };
  redemptions.push(redemption);
  const instanceName = instances[Math.floor(Math.random() * instances.length)];
  return { success: true, message: 'Coupon Redeemed', instanceName };
}

export async function getRedemptions(couponId, page = 0, size = 5) {
  await delay(200 + Math.random() * 200);
  const filtered = redemptions.filter(
    (r) => r.couponId === couponId
  );
  const start = page * size;
  const end = start + size;
  const content = filtered
    .slice(start, end)
    .map((r) => ({
      username: r.username,
      couponCode: r.couponCode,
      status: r.status,
      redeemedAt: r.redeemedAt,
    }));
  return {
    content,
    page,
    size,
    totalPages: Math.ceil(filtered.length / size) || 1,
    totalElements: filtered.length,
  };
}

export { coupons, redemptions };
