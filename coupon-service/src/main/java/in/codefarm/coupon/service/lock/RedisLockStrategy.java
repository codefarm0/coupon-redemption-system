package in.codefarm.coupon.service.lock;

import java.time.Duration;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

public class RedisLockStrategy implements LockStrategy {

    private static final String UNLOCK_SCRIPT = """
            if redis.call('get', KEYS[1]) == ARGV[1] then
                return redis.call('del', KEYS[1])
            else
                return 0
            end
            """;

    private final StringRedisTemplate redisTemplate;
    private final DefaultRedisScript<Long> unlockScript;

    public RedisLockStrategy(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.unlockScript = new DefaultRedisScript<>(UNLOCK_SCRIPT, Long.class);
    }

    @Override
    public boolean acquireLock(String key, String value, long timeoutMs) {
        Boolean acquired = redisTemplate.opsForValue()
                .setIfAbsent(key, value, Duration.ofMillis(timeoutMs));
        return Boolean.TRUE.equals(acquired);
    }

    @Override
    public void releaseLock(String key, String value) {
        redisTemplate.execute(unlockScript, List.of(key), value);
    }
}
