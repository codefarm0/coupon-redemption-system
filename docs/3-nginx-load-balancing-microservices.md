# Nginx Load Balancing for Microservices — Configuration, Strategies, and Observability

> **How to configure Nginx as a reverse proxy and load balancer for multiple Spring Boot instances — with least_conn strategy, custom logging, health checks, and real-time routing observability.**

---

**Meta Description:** Master Nginx load balancing for microservices with this practical guide. Learn least_conn strategy, upstream configuration, custom logging for routing observability, Docker health checks, and production-ready proxy settings.

---

**Target Keywords:** Nginx load balancing microservices, Nginx least_conn, Nginx reverse proxy Spring Boot, Nginx upstream configuration, Nginx custom log format, Nginx health check Docker, Nginx microservices architecture

---

## Introduction

In the [coupon redemption system](1-distributed-coupon-redemption-architecture-overview.md), Nginx sits at the front of three Spring Boot instances, routing every API request to the least-loaded server. This article explains every line of the Nginx configuration, why `least_conn` beats round-robin for variable-length requests, and how to make load balancing visible.

---

## Why Nginx for Microservices?

When you have multiple application instances, you need a **single entry point** that:

1. **Distributes traffic** — no single instance gets overwhelmed
2. **Hides internal topology** — clients only know one URL
3. **Handles failures** — if an instance goes down, routes to healthy ones
4. **Provides observability** — you can see which instance served each request

Nginx excels at all four. It's lightweight, battle-tested at companies like Netflix and Airbnb, and configurable with minimal syntax.

---

## The Configuration — Line by Line

```nginx
events {
    worker_connections 1024;
}

http {
    # Custom log format to show upstream server routing
    log_format upstream_log '$remote_addr - $remote_user [$time_local] '
                          '"$request" $status $body_bytes_sent '
                          '"$http_referer" "$http_user_agent" '
                          'upstream: $upstream_addr';

    upstream coupon_service {
        least_conn;
        server coupon-app-1:8080;
        server coupon-app-2:8080;
        server coupon-app-3:8080;
    }

    server {
        listen 80;
        server_name localhost;
        client_max_body_size 10M;

        access_log /var/log/nginx/access.log upstream_log;
        error_log /var/log/nginx/error.log;

        location /health {
            access_log off;
            return 200 "healthy\n";
        }

        location /api/ {
            proxy_pass http://coupon_service;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 30s;
            proxy_connect_timeout 10s;
        }

        location / {
            proxy_pass http://coupon_service;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
```

---

## Deep Dive: Each Directive Explained

### 1. upstream Block — The Server Group

```nginx
upstream coupon_service {
    least_conn;
    server coupon-app-1:8080;
    server coupon-app-2:8080;
    server coupon-app-3:8080;
}
```

This defines a group of backend servers named `coupon_service`. Nginx will proxy requests to this group.

**Server names** (`coupon-app-1`, `coupon-app-2`, `coupon-app-3`) are Docker container names. Docker Compose creates a DNS resolution network where container names resolve to IPs automatically.

### 2. Load Balancing Strategies

Nginx supports several strategies:

| Strategy | How It Works | Best For |
|----------|-------------|----------|
| **`least_conn`** | Routes to the server with fewest active connections | Variable-length requests (our use case) |
| **round-robin** (default) | Cycles through servers in order | Equal-length, fast requests |
| **ip_hash** | Routes by client IP (same client → same server) | Session persistence |
| **weight** | Distributes by configured weight ratios | Unequal server capacity |

**Why we chose `least_conn`:** Coupon redemption requests take 50–200ms each (database write + Redis lock). If one instance is processing a batch of 100 redemptions while another is idle, `least_conn` routes new requests to the idle one. Round-robin would overload the busy instance.

### 3. log_format — Making Routing Visible

```nginx
log_format upstream_log '... upstream: $upstream_addr';
```

The **`$upstream_addr`** variable shows which backend server handled each request. Combined with Docker logs:

```bash
docker logs coupon-nginx -f | grep upstream
# Output:
# upstream: 172.18.0.4:8080  (coupon-app-1)
# upstream: 172.18.0.5:8080  (coupon-app-2)
# upstream: 172.18.0.6:8080  (coupon-app-3)
```

This is **invaluable for debugging** — you can confirm traffic is distributed, see if an instance is overloaded, and detect failures.

### 4. proxy_pass — Forwarding Requests

```nginx
location /api/ {
    proxy_pass http://coupon_service;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

- `proxy_pass http://coupon_service` — forwards to the upstream group
- `proxy_set_header Host $host` — preserves the original hostname
- `X-Real-IP` / `X-Forwarded-For` — passes the client's real IP (not Nginx's IP)

Without these headers, the Spring Boot application would see every request coming from Nginx's IP address, which breaks logging, rate limiting, and security checks.

### 5. Timeouts

```nginx
proxy_read_timeout 30s;
proxy_connect_timeout 10s;
```

- **`proxy_read_timeout`** — how long Nginx waits for a response from the backend. Lock acquisition with retry can take up to 10 seconds (exponential backoff, max 10 attempts × ~1s each). 30 seconds gives enough headroom.
- **`proxy_connect_timeout`** — how long to wait for the TCP connection to the backend.

### 6. Health Check Endpoint

```nginx
location /health {
    access_log off;
    return 200 "healthy\n";
}
```

A lightweight endpoint that returns immediately without proxying to the backend. Used by Docker Compose health checks and external monitoring.

---

## Docker Integration

### Dockerfile

```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Alpine-based Nginx is only ~20MB. The config is copied directly into the image.

### Docker Compose Service

```yaml
nginx:
  build:
    context: ./nginx
    dockerfile: Dockerfile
  ports:
    - "80:80"
  depends_on:
    - coupon-app-1
    - coupon-app-2
    - coupon-app-3
  networks:
    - coupon-network
```

Nginx depends on all three app instances. Docker Compose ensures they start before Nginx, but Nginx will also handle runtime failures gracefully — if an instance goes down, Nginx stops routing to it.

---

## Load Balancing in Action

Here's what happens when you click **Claim x100** in the frontend:

1. Frontend generates 100 random usernames
2. Fires 100 parallel `POST /api/coupons/redeem` requests
3. Nginx receives each request and checks active connections
4. Each request is routed to the instance with the fewest active connections
5. `$upstream_addr` in the logs shows the distribution

Watch it live:

```bash
docker logs coupon-nginx -f | grep "POST /api/coupons/redeem"
# 172.18.0.1 - - [05/Jul/2026:12:00:01 +0000] "POST /api/coupons/redeem" 200 ...
#   upstream: 172.18.0.4:8080
# 172.18.0.1 - - [05/Jul/2026:12:00:01 +0000] "POST /api/coupons/redeem" 200 ...
#   upstream: 172.18.0.5:8080
# 172.18.0.1 - - [05/Jul/2026:12:00:02 +0000] "POST /api/coupons/redeem" 200 ...
#   upstream: 172.18.0.6:8080
```

Each response also includes the instance name:

```json
{
  "success": true,
  "message": "Coupon Redeemed",
  "instanceName": "coupon-app-2"
}
```

This confirms Nginx is distributing load as expected.

---

## Production Considerations

The current configuration is demo-ready. For production, consider:

```nginx
upstream coupon_service {
    least_conn;
    server coupon-app-1:8080 max_fails=3 fail_timeout=30s;
    server coupon-app-2:8080 max_fails=3 fail_timeout=30s;
    server coupon-app-3:8080 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

| Setting | What It Does |
|---------|-------------|
| `max_fails=3` | Remove server after 3 consecutive failures |
| `fail_timeout=30s` | Wait 30 seconds before retrying a failed server |
| `keepalive 32` | Reuse connections to backends (reduces TCP handshake overhead) |

Additional production headers:

```nginx
proxy_set_header X-Request-Id $request_id;
add_header X-Upstream $upstream_addr;
```

`X-Request-Id` enables distributed tracing. `X-Upstream` lets clients see which instance served them (useful for debugging).

---

## Nginx Commands Reference

```bash
# Test configuration syntax
nginx -t

# Reload configuration without downtime
nginx -s reload

# Check active connections
curl http://localhost/nginx_status

# View routing in real-time
docker logs coupon-nginx -f | grep upstream

# Check Nginx process health
docker compose ps nginx
```

---

## Conclusion

Nginx is the invisible backbone of the coupon redemption system's multi-instance architecture. With just 60 lines of configuration, it provides:

- **Intelligent load balancing** — `least_conn` distributes traffic across instances
- **Observability** — custom logging shows every routing decision
- **Resilience** — automatic failover when instances go down
- **Minimal overhead** — Alpine-based container is ~20MB

The complete Nginx configuration is on GitHub:

**[github.com/.../coupon-redemption-system](https://github.com/)**

---

*For the full architecture including Redis locking and the transaction boundary bug, read [Story 1: Architecture Overview](1-distributed-coupon-redemption-architecture-overview.md). For the Spring Boot backend that Nginx proxies to, read [Story 2: Spring Boot Concepts](2-spring-boot-concepts-distributed-locking.md).*
