package in.codefarm.coupon.service.config;

import in.codefarm.coupon.service.lock.LockStrategy;
import in.codefarm.coupon.service.lock.NoLockStrategy;
import in.codefarm.coupon.service.lock.RedisLockStrategy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
public class LockConfig {

    @Bean
    @ConditionalOnProperty(name = "coupon.lock.enabled", havingValue = "true", matchIfMissing = true)
    public LockStrategy redisLockStrategy(StringRedisTemplate redisTemplate) {
        return new RedisLockStrategy(redisTemplate);
    }

    @Bean
    @ConditionalOnProperty(name = "coupon.lock.enabled", havingValue = "false")
    public LockStrategy noLockStrategy() {
        return new NoLockStrategy();
    }
}
