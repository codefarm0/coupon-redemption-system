# Redis Distributed Locking — Commands, Patterns, and Production Pitfalls

> **How to implement safe distributed locking with Redis: SET NX, Lua unlock scripts, exponential backoff retry, TTL management, and the race condition that almost slipped through.**

---

**Meta Description:** Master Redis distributed locking with this practical guide. Learn SET NX with TTL, Lua unlock scripts, exponential backoff retry, monitoring commands, and why releasing a lock before the transaction commits causes race conditions.

---

**Target Keywords:** Redis distributed locking, Redis SET NX, Redis Lua unlock script, Spring Boot Redis lock, Redis distributed lock pattern, Redis TTL lock, Redis lock retry exponential backoff, Redis lock monitoring commands

---

## Introduction

Redis is at the heart of the [coupon redemption system's](1-distributed-coupon-redemption-architecture-overview.md) race condition prevention. Its `SET NX` command provides the atomic "set if not exists" semantics needed for distributed locks — fast, simple, and battle-tested at companies like GitHub, Twitter, and Stack Overflow.

This article covers every Redis concept the project uses: lock acquisition, safe release, retry logic, monitoring, and a critical lesson about transaction boundaries.

---

## The Distributed Lock Pattern

A distributed lock must solve four problems:

| Problem | Solution |
|---------|----------|
| Mutual exclusion | Only one process holds the lock at a time |
| Deadlock prevention | Lock has a TTL — auto-releases if the holder crashes |
| Safe release | Only the lock owner can release it (Lua script) |
| Fairness | Exponential backoff retry prevents thundering herd |

---

## 1. Lock Acquisition — SET NX with TTL

```java
public class RedisLockStrategy implements LockStrategy {

    @Override
    public boolean acquireLock(String key, String value, long timeoutMs) {
        Boolean acquired = redisTemplate.opsForValue()
                .setIfAbsent(key, value, Duration.ofMillis(timeoutMs));
        return Boolean.TRUE.equals(acquired);
    }
}
```

**The Redis command:**
```
SET coupon:lock:SUMMER50 "uuid-abc-123" NX EX 5
```

| Part | Meaning |
|------|---------|
| `SET` | Redis command to set a key-value |
| `NX` | **N** if not e **X** ists — only set if the key doesn't exist |
| `EX 5` | Expire after 5 seconds — deadlock prevention |
| Value = UUID | Unique identifier — ensures only the owner can release |

**Lock key format:** `coupon:lock:{couponCode}` — scoped per coupon, not global.

**Why use a random UUID as the value?** Without it, you might release someone else's lock. Instance A acquires the lock, its transaction takes longer than the TTL, the lock auto-expires, Instance B acquires the lock, then Instance A finally finishes and calls `DEL` — accidentally releasing Instance B's lock.

---

## 2. Safe Unlock — The Lua Script

Releasing a lock is NOT a simple `DEL` command. You must verify that you still own the lock:

```lua
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
else
    return 0
end
```

**Why Lua?** Atomicity. The Lua script runs entirely on the Redis server — no other command can interleave between the `GET` and `DEL`.

```java
private static final String UNLOCK_SCRIPT = """
        if redis.call('get', KEYS[1]) == ARGV[1] then
            return redis.call('del', KEYS[1])
        else
            return 0
        end
        """;

@Override
public void releaseLock(String key, String value) {
    redisTemplate.execute(unlockScript, List.of(key), value);
}
```

**Without this script:**
```
Instance A: GET coupon:lock:SUMMER50 → "uuid-abc" (my lock)
// Instance B's lock expires and gets acquired by C
Instance C: SET coupon:lock:SUMMER50 "uuid-xyz" NX → OK
Instance A: DEL coupon:lock:SUMMER50 → ❌ Deletes C's lock!
Instance C: thinks lock is held but it's gone
```

**With the Lua script:**
```
Instance A: GET coupon:lock:SUMMER50 → value matches → DEL
// Only deletes if still our lock
Instance A: Lua returns 1 → lock released safely
```

---

## 3. Exponential Backoff Retry

When a lock is held by another request, you don't want to hammer Redis with retries. The solution: exponential backoff.

```java
private static final int MAX_LOCK_RETRIES = 10;
private static final long INITIAL_RETRY_DELAY_MS = 50;

private boolean acquireLockWithRetry(String lockKey, String lockValue,
        String couponCode, String username) {
    long delayMs = INITIAL_RETRY_DELAY_MS;

    for (int attempt = 0; attempt < MAX_LOCK_RETRIES; attempt++) {
        boolean acquired = lockStrategy.acquireLock(lockKey, lockValue, LOCK_TIMEOUT_MS);
        if (acquired) {
            logger.info("[LOCK ACQUIRED] Attempt: {}/{}", attempt + 1, MAX_LOCK_RETRIES);
            return true;
        }

        if (attempt < MAX_LOCK_RETRIES - 1) {
            Thread.sleep(delayMs);
            delayMs = Math.min(delayMs * 2, 1000); // Double, cap at 1 second
        }
    }

    logger.warn("[LOCK FAILED] All {} attempts exhausted", MAX_LOCK_RETRIES);
    return false;
}
```

**Retry sequence:**

| Attempt | Wait Before | Total Elapsed |
|---------|-------------|---------------|
| 1 | 0ms | 0ms |
| 2 | 50ms | 50ms |
| 3 | 100ms | 150ms |
| 4 | 200ms | 350ms |
| 5 | 400ms | 750ms |
| 6 | 800ms | 1,550ms |
| 7 | 1,000ms | 2,550ms |
| 8 | 1,000ms | 3,550ms |
| 9 | 1,000ms | 4,550ms |
| 10 | — (last attempt) | 4,550ms |

Total: ~4.5 seconds before giving up. The lock TTL is 5 seconds, so by attempt 7–8, a stuck lock would have expired.

**Why not constant 50ms retries?** 100 requests × 50ms × 10 retries = 50,000 Redis calls in 5 seconds. Exponential backoff reduces this to ~1,000 — and prevents the **thundering herd** problem (all instances retrying simultaneously).

---

## 4. The TTL Bug We Found

The lock TTL must be **longer** than the maximum expected transaction duration. In our system:

- Redis lock TTL: 5,000ms (5 seconds)
- Max retry duration: ~4.5 seconds
- Database transaction: typically <100ms

If the TTL is too short, the lock expires while the transaction is still running. Another instance acquires the lock, processes the same coupon, and you get **double redemptions**.

If the TTL is too long, a crashed instance holds the lock for the full duration, blocking all other requests.

**Our approach:** 5 seconds is generous for sub-100ms transactions, but short enough that a crash doesn't block the system for long.

---

## 5. The Transaction Boundary Bug

This was the most critical finding in the project. **The lock was being released before the database transaction committed.**

```java
// ❌ BAD
@Transactional
public RedeemResponse redeemCoupon(RedeemRequest request) {
    acquireLock();   // Step 1: Lock acquired
    // ... JPA operations (not flushed!)
    releaseLock();   // Step 2: ❌ Lock released
}                    // Step 3: Transaction commits (too late!)
```

Another request could acquire the lock between step 2 and step 3, read the old remaining value from MySQL (which hasn't been updated yet), and cause a race condition **even with the lock**.

**The fix:** Acquire the lock before the transaction starts, release it after.

```java
// ✅ FIXED
public RedeemResponse redeemCoupon(RedeemRequest request) {
    acquireLock();   // Step 1: Lock acquired

    return transactionTemplate.execute(status -> {
        // ... JPA operations
    });               // Step 2: Transaction commits

    releaseLock();   // Step 3: Lock released AFTER commit
}
```

**Lesson:** A distributed lock is only as safe as the transaction boundary it protects.

---

## 6. Monitoring Commands

These Redis commands helped us debug the locking behavior:

### Check Active Locks
```bash
# List all lock keys
KEYS coupon:lock:*

# Inspect a specific lock
GET coupon:lock:SUMMER50
# "uuid-abc-123"
```

### Check Lock TTL
```bash
# Remaining time before auto-release
TTL coupon:lock:SUMMER50
# (integer) 3
```

### Monitor Live Operations
```bash
# Watch every Redis command in real-time
docker exec -it coupon-redis redis-cli MONITOR

# Filter for lock-related commands
docker exec -it coupon-redis redis-cli MONITOR | grep "coupon:lock"
```

### Clear All Locks (for testing)
```bash
docker exec -it coupon-redis redis-cli FLUSHALL
```

### Redis CLI Connection
```bash
# Interactive mode
docker exec -it coupon-redis redis-cli

# One-off commands
docker exec -it coupon-redis redis-cli KEYS "coupon:lock:*"
```

---

## 7. NoLockStrategy — The Race Condition Simulator

```java
public class NoLockStrategy implements LockStrategy {
    @Override
    public boolean acquireLock(String key, String value, long timeoutMs) {
        return true; // Every request "acquires" the lock
    }

    @Override
    public void releaseLock(String key, String value) {
        // No-op — never acquired, never released
    }
}
```

When `coupon.lock.enabled=false`, every redemption request passes through without coordination. The database transaction runs, but without the Redis lock, concurrent requests on different instances read stale data from MySQL.

**This is how you demonstrate the race condition.** All 10 requests in a batch claim success, but the remaining count drops by only 7 or 8 — exactly what the [architecture overview](1-distributed-coupon-redemption-architecture-overview.md) describes.

---

## 8. Production Considerations

For production Redis locking, consider:

### Redlock Algorithm
For environments where absolute safety matters, implement the [Redlock algorithm](https://redis.io/docs/reference/patterns/distributed-locks/) — acquire the lock on multiple Redis nodes (typically 5) and require a majority to succeed.

### Clock Drift
Redis lock safety depends on monotonically increasing clocks. In containers, clock drift can cause TTL issues. Use NTP-synchronized clocks in production.

### Connection Resilience
```yaml
spring:
  data:
    redis:
      timeout: 2000ms
      connect-timeout: 1000ms
      lettuce:
        pool:
          max-active: 16
          max-idle: 8
```

Connection timeouts prevent the application from hanging when Redis is temporarily unavailable.

---

## Redis Commands Reference

| Command | Purpose |
|---------|---------|
| `SET key value NX EX seconds` | Acquire lock atomically |
| `GET key` | Check lock value |
| `DEL key` | Delete lock (raw, without ownership check) |
| `TTL key` | Check remaining lock duration |
| `KEYS pattern` | Find all locks matching a pattern |
| `MONITOR` | Stream all Redis commands in real-time |
| `FLUSHALL` | Clear all Redis data (for testing) |
| `INFO` | Redis server statistics |

---

## Conclusion

Redis distributed locking is simple to implement but has subtle edge cases:

- **Use `SET NX` with TTL** for atomic lock acquisition with deadlock prevention
- **Use a Lua script** for safe unlock (only the owner releases)
- **Use exponential backoff** for retry — prevents thundering herd
- **The lock must span the entire transaction** — releasing before commit creates race conditions
- **Monitor with `KEYS`, `TTL`, and `MONITOR`** during development

The complete Redis lock implementation is on GitHub:

**[github.com/.../coupon-redemption-system](https://github.com/)**

---

*For the full architecture including Nginx load balancing and the Spring Boot backend, read [Story 1: Architecture Overview](1-distributed-coupon-redemption-architecture-overview.md). For the transaction boundary fix in detail, read [Story 2: Spring Boot Concepts](2-spring-boot-concepts-distributed-locking.md).*
