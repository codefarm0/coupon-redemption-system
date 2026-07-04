// API Base URL - points to Nginx load balancer
const API_BASE_URL = 'http://localhost/api';

export async function getCoupons(page = 0, size = 5) {
  const response = await fetch(
    `${API_BASE_URL}/coupons?page=${page}&size=${size}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch coupons: ${response.statusText}`);
  }
  return response.json();
}

export async function createCoupon({ code, totalRedemptions }) {
  const response = await fetch(`${API_BASE_URL}/coupons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      totalRedemptions,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create coupon');
  }
  return response.json();
}

export async function redeemCoupon({ couponCode, username }) {
  const response = await fetch(`${API_BASE_URL}/coupons/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      couponCode,
      username,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to redeem coupon: ${response.statusText}`);
  }
  return response.json();
}

export async function getRedemptions(couponId, page = 0, size = 5) {
  const response = await fetch(
    `${API_BASE_URL}/coupons/${couponId}/redemptions?page=${page}&size=${size}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch redemptions: ${response.statusText}`);
  }
  return response.json();
}
