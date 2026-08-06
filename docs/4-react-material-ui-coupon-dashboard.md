# React + Material UI — Building a Real-Time Coupon Redemption Dashboard

> **How to build a production-quality coupon management dashboard with React 19 and Material UI — including pagination, concurrent API simulation, real-time progress dialogs, and a mock API layer for development.**

---

**Meta Description:** Build a coupon redemption dashboard with React 19 and Material UI. Learn pagination, concurrent API simulation with Promise.allSettled, mock API layer for development, real-time progress dialogs, and MUI component composition.

---

**Target Keywords:** React coupon redemption dashboard, Material UI React dashboard, React Promise.allSettled concurrent requests, React mock API pattern, React pagination MUI, React real-time progress dialog, React component architecture

---

## Introduction

The [coupon redemption system](1-distributed-coupon-redemption-architecture-overview.md) frontend is a **React 19 + Material UI 9** single-page application with two screens: a paginated coupon list with claim buttons, and a redemption history table. This article covers the component architecture, state management patterns, concurrent request handling, and the mock API layer that lets you develop the frontend without a backend.

---

## Component Architecture

```
App
├── ThemeProvider (MUI theme + CssBaseline)
└── Layout (AppBar with tabs + lock toggle)
    ├── Tab 0: CouponList
    │   ├── CreateCoupon (form)
    │   └── CouponCard (× N, paginated)
    │       └── RedemptionDialog (progress + results)
    └── Tab 1: RedemptionHistory
        └── Coupon selector dropdown + paginated table
```

### Screen 1 — Coupon List

Each coupon card displays:
- **Coupon code** (e.g., `SUMMER50`) with a tag icon
- **Remaining / Total** redemptions with a progress bar
- **Claim buttons:** Once, x10, x100, x1000

### Screen 2 — Redemption History

A paginated table showing all redemption records for a selected coupon:
- **Username**
- **Coupon code**
- **Status** (SUCCESS / FAILED chip)
- **Redeemed At** (timestamp)

---

## Key React Patterns

### 1. Concurrent Claim Simulation with Promise.allSettled

The most interesting feature. When a user clicks **Claim x100**, the frontend generates 100 random usernames and fires 100 parallel API requests. Results appear in real-time.

```jsx
const handleClaim = async (count) => {
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
  onRefresh(); // Refresh coupon list
};
```

**Why `Promise.allSettled` instead of `Promise.all`?**

- `Promise.all` fails fast — if one request fails, you lose all results
- `Promise.allSettled` waits for every request to complete, giving you the full picture of successes and failures

**Real-time progress:** Each `.then()` callback updates state immediately, so the dialog shows count `3/100`, `7/100`, etc. as requests complete.

### 2. The RedemptionDialog — Real-Time Results

```jsx
function RedemptionDialog({ open, results, total, completed, done, onClose }) {
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Dialog open={open} onClose={done ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6">Claiming {couponCode}</Typography>
          <Chip label={`${completed} / ${total}`} />
        </Stack>
      </DialogTitle>
      <DialogContent>
        {!done && (
          <Box mb={2}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption">
              Processing {completed} of {total} requests...
            </Typography>
          </Box>
        )}

        {done && successes.length > 0 && (
          <Box mb={2}>
            <Typography variant="subtitle2" color="success.main">
              Successful Redemption ({successes.length})
            </Typography>
            {successes.map((r, i) => (
              <Stack key={i} direction="row" spacing={1}>
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography>{r.username}</Typography>
                <Chip label={r.instanceName} size="small" />
              </Stack>
            ))}
          </Box>
        )}

        {done && failures.length > 0 && (
          <Box>
            <Typography variant="subtitle2" color="error.main">
              Coupon Exhausted ({failures.length})
            </Typography>
            {failures.map((r, i) => (
              <Stack key={i} direction="row" spacing={1}>
                <CancelIcon color="error" fontSize="small" />
                <Typography>{r.username}</Typography>
              </Stack>
            ))}
          </Box>
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
```

**Key UX decisions:**
- **Dialog can't be closed until all requests complete** — prevents accidental dismissal during simulation
- **Progress bar + count** — gives real-time feedback for batch operations
- **Success and failure sections** — clearly separates winners from losers, matching the real coupon system UX
- **Instance name on each success** — reinforces the distributed nature of the system

### 3. Lock Toggle in the App Bar

```jsx
<FormControlLabel
  control={<Switch checked={locked} onChange={handleLockToggle} />}
  label={
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      Lock
      <Chip label={locked ? 'ON' : 'OFF'} color={locked ? 'success' : 'error'} size="small" />
    </Box>
  }
/>
```

The lock toggle calls `setLockEnabled()` from the mock API, which changes how the mock processes redemptions:

- **Lock ON:** Strict check — remaining must be > 0, exact counting
- **Lock OFF:** No check — every request succeeds, remaining goes negative

This mirrors the backend's `coupon.lock.enabled` property and lets you demonstrate the race condition entirely in the browser.

### 4. Pagination with MUI

```jsx
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
```

Three-column responsive grid on desktop, two on tablet, full-width on mobile. Server-side pagination — the frontend requests `page=0&size=5` and the backend returns the correct slice.

### 5. Mock API Layer — Development Without a Backend

The mock API (`src/api/mockApi.js`) implements every endpoint with realistic delays and in-memory state:

```javascript
// Mock API — mirrors the real backend contract
export async function getCoupons(page = 0, size = 5) {
  await delay(200 + Math.random() * 200);
  const start = page * size;
  return {
    content: coupons.slice(start, start + size).map(/* ... */),
    page,
    size,
    totalPages: Math.ceil(coupons.length / size),
    totalElements: coupons.length,
  };
}

export async function redeemCoupon({ couponCode, username }) {
  await delay(50 + Math.random() * 150);
  const coupon = coupons.find((c) => c.code === couponCode);
  if (lockEnabled && coupon.remainingRedemptions <= 0) {
    return { success: false, message: 'Coupon Exhausted' };
  }
  coupon.remainingRedemptions--;
  return { success: true, message: 'Coupon Redeemed', instanceName };
}
```

**25 pre-seeded coupons** across 5 pages let you test pagination immediately. When the real backend is ready, you swap the API functions — the component code doesn't change.

---

## Random Name Generation

```javascript
const names = [
  'Rahul', 'Priya', 'Neha', 'Amit', 'Sonal', 'Deepak', 'Rakesh', 'Pooja',
  'Vikram', 'Anjali', 'Suresh', 'Kavita', 'Rajesh', 'Sunita', 'Manish',
  // ... 60 names total
];

export function generateRandomNames(count) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const baseName = names[i % names.length];
    const suffix = i >= names.length ? Math.floor(i / names.length) + 1 : '';
    result.push(suffix ? `${baseName}${suffix}` : baseName);
  }
  return result.sort(() => Math.random() - 0.5);
}
```

60 unique names with overflow numbering (`Rahul2`, `Rahul3`, etc.). Random sort ensures no ordering bias in the simulation.

---

## API Response Shapes

The frontend expects the same response format the [backend API](2-spring-boot-concepts-distributed-locking.md) returns:

```typescript
// Coupon list
interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
}

// Coupon
interface Coupon {
  id: number;
  code: string;
  totalRedemptions: number;
  remainingRedemptions: number;
  createdAt: string;
}

// Redeem
interface RedeemResponse {
  success: boolean;
  message: string;
  instanceName: string;
}

// Redemption
interface Redemption {
  username: string;
  couponCode: string;
  status: 'SUCCESS' | 'FAILED';
  redeemedAt: string;
}
```

---

## Running the Frontend

```bash
# Mock mode (no backend needed)
cd frontend-react
npm install
npm run dev
# Opens at http://localhost:5173

# Connected to real backend
docker compose up -d   # Start backend
# Update mockApi.js to use fetch() against http://localhost/api/
npm run dev
```

---

## MUI Components Used

| Component | Usage |
|-----------|-------|
| `AppBar`, `Toolbar`, `Tabs`, `Tab` | Navigation layout |
| `Card`, `CardContent` | Coupon cards |
| `Button` | Claim buttons (Once, x10, x100, x1000) |
| `TextField` | Create coupon form |
| `Table`, `TableContainer` | Redemption history |
| `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions` | Claim results dialog |
| `LinearProgress` | Claim progress bar |
| `Pagination` | Pagination controls |
| `Chip` | Status labels, instance names |
| `CssBaseline` | CSS reset |
| `Grid` | Responsive card layout |
| `Snackbar` | Success notifications |

---

## Conclusion

The React + MUI frontend demonstrates **production patterns** for building data-intensive dashboards:

- **Concurrent request handling** with `Promise.allSettled` and real-time state updates
- **Mock API layer** for backend-independent development
- **Responsive pagination** with MUI components
- **Server-driven UI** — the frontend adapts to whatever data the backend returns

The complete frontend source code is on GitHub:

**[github.com/.../coupon-redemption-system](https://github.com/)**

---

*For the full architecture overview including the Spring Boot backend, Nginx load balancing, and Redis distributed locking, read [Story 1: Architecture Overview](1-distributed-coupon-redemption-architecture-overview.md).*
