# Nginx Load Balancer

## Overview

This directory contains the Nginx configuration and Dockerfile for the load balancer that distributes requests across multiple Coupon Service instances.

## Architecture

```
Client Requests
      ↓
   Nginx (Port 80)
      ↓
   ┌─┴─┬────┬────┐
   ↓   ↓    ↓    ↓
App-1 App-2 App-3
(8080) (8080) (8080)
```

## Configuration

### nginx.conf

**Upstream Block**
- Defines the three coupon service instances: `coupon-app-1`, `coupon-app-2`, `coupon-app-3`
- Uses `least_conn` load balancing algorithm (routes to server with fewest active connections)
- Ideal for long-lived connections

**Server Block**
- Listens on port 80
- Proxies all `/api/*` routes to the upstream coupon services
- Sets proper headers:
  - `X-Real-IP`: Client's original IP
  - `X-Forwarded-For`: Chain of IPs for tracking request path
  - `X-Forwarded-Proto`: Original protocol (http/https)
- Health check endpoint: `/health` (returns 200 for monitoring)

### Dockerfile

- Uses `nginx:alpine` for minimal image size
- Copies custom `nginx.conf` configuration
- Exposes port 80 for HTTP traffic

## How to Test

### Direct Access (Behind Nginx)
```bash
curl http://localhost/api/coupons
```

### Direct Access (Individual Instances)
```bash
curl http://localhost:8081/api/coupons  # App-1
curl http://localhost:8082/api/coupons  # App-2
curl http://localhost:8083/api/coupons  # App-3
```

### Health Check
```bash
curl http://localhost/health
```

## Load Balancing Algorithm

**least_conn** - Sends requests to the server with the fewest active connections. This is ideal for:
- Long-lived connections
- Connection pooling scenarios
- Uneven request handling times

Alternative algorithms available:
- `round_robin` - Rotate through servers sequentially
- `ip_hash` - Route based on client IP (sticky sessions)
- `random` - Random selection

## Monitoring

Monitor Nginx logs for request distribution:
```bash
docker logs coupon-nginx -f
```

**Log Format Explanation:**
Each request logs the upstream server that handled it in this format:
```
192.168.65.1 - - [04/Jul/2026:09:31:02 +0000] "POST /api/coupons/redeem HTTP/1.1" 200 85 "http://localhost:5175/" "Mozilla/5.0..." upstream: 172.18.0.4:8080
                                                                                                                                                            ↑
                                                                                         This is the upstream server (coupon-app-1, 2, or 3)
```

**Decoding the upstream address:**
- `172.18.0.4:8080` - IP of the Docker container + port
- Maps to one of:
  - `coupon-app-1:8080`
  - `coupon-app-2:8080`
  - `coupon-app-3:8080`

**Watch real-time routing:**
```bash
docker logs coupon-nginx -f | grep upstream
```

**Example output showing load distribution across all 3 instances:**
```
upstream: 172.18.0.4:8080  ← coupon-app-1
upstream: 172.18.0.5:8080  ← coupon-app-2
upstream: 172.18.0.6:8080  ← coupon-app-3
upstream: 172.18.0.4:8080  ← coupon-app-1 (balanced)
```

Each request logs the upstream server and response time, helping verify load distribution across the three instances.

## Key Headers Forwarded

| Header | Purpose |
|--------|---------|
| X-Real-IP | Client's actual IP address |
| X-Forwarded-For | All IPs in the request chain |
| X-Forwarded-Proto | Original protocol (http/https) |
| Host | Original host header |

These allow the backend service to identify the actual client, useful for logging and debugging.

## Performance Tuning

### Current Settings
- `worker_connections: 1024` - Maximum concurrent connections per worker
- `client_max_body_size: 10M` - Maximum request body size
- `proxy_read_timeout: 30s` - Wait up to 30 seconds for backend response
- `proxy_connect_timeout: 10s` - Wait up to 10 seconds to connect to backend

Adjust these based on your traffic patterns and latency requirements.

## Troubleshooting

### 502 Bad Gateway
- One or more upstream servers are unreachable
- Check if coupon service instances are running: `docker ps`
- Verify MySQL and Redis dependencies are healthy

### High Latency
- Check if all three instances are healthy
- Monitor database connection pool
- Verify Redis availability

### Uneven Load Distribution
- `least_conn` algorithm adapts to request duration
- Verify all three instances have similar response times
- Check if any instance is slow or hanging

## Advanced Logging Variables

The `upstream_log` format uses these Nginx variables:

| Variable | Purpose |
|----------|---------|
| `$remote_addr` | Client IP address |
| `$time_local` | Request time |
| `$request` | HTTP method, URL, protocol |
| `$status` | HTTP status code (200, 404, 500, etc.) |
| `$body_bytes_sent` | Response body size |
| `$http_referer` | Referrer (where request came from) |
| `$http_user_agent` | Browser/client info |
| `$upstream_addr` | Backend server that processed the request |

**Custom Log Format Definition:**
```nginx
log_format upstream_log '$remote_addr - $remote_user [$time_local] '
                      '"$request" $status $body_bytes_sent '
                      '"$http_referer" "$http_user_agent" '
                      'upstream: $upstream_addr';
```

**To add more variables to logs, edit nginx.conf and restart:**
```bash
docker restart coupon-nginx
```

Examples of additional useful variables:
- `$upstream_response_time` - Time backend took to respond
- `$request_time` - Total request time (including Nginx processing)
- `$connection` - Connection number
- `$pipe` - Pipeline request indicator
