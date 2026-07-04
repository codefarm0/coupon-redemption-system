package in.codefarm.coupon.service.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class RedisConfigLogger {

    @Value("${spring.data.redis.host}")
    private String host;

    @Value("${spring.data.redis.port}")
    private int port;

    @PostConstruct
    public void print() {
        System.out.println("Redis Host = " + host);
        System.out.println("Redis Port = " + port);
    }
}