# Docker Compose for Microservices — Orchestrating a 6-Service Coupon System

> **How to orchestrate MySQL, Redis, three Spring Boot instances, and Nginx with a single docker compose command — including multi-stage Dockerfiles, health checks, networking, and environment configuration.**

---

**Meta Description:** Master Docker Compose for microservices with this practical guide. Learn multi-stage Dockerfiles, service health checks, container networking, Spring Boot environment configuration, and production-ready orchestration patterns.

---

**Target Keywords:** Docker Compose microservices, Docker Compose Spring Boot, Docker Compose MySQL Redis, Docker multi-stage build, Docker health checks, Docker container networking, Docker Compose environment variables, Docker orchestration

---

## Introduction

The [coupon redemption system](1-distributed-coupon-redemption-architecture-overview.md) runs six services in production: MySQL, Redis, three Spring Boot application instances, and an Nginx load balancer. **With Docker Compose, all six start with a single command.**

This article covers every Docker concept the project demonstrates: building efficient container images, orchestrating dependent services with health checks, wiring environment variables using Spring Boot's relaxed binding, and practical debugging commands.

---

## The Architecture — Six Containers, One Network

```
┌─────────────────────────────────────────────────────────────┐
│                    coupon-network (bridge)                    │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│  │  MySQL   │   │  Redis   │   │  Nginx   │   │   App    │ │
│  │  :3306   │   │  :6379   │   │  :80     │   │ :8080×3  │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Each service has a container name that resolves via Docker's internal DNS:
- `coupon-mysql` → MySQL server
- `coupon-redis` → Redis server
- `coupon-app-1`, `coupon-app-2`, `coupon-app-3` → Spring Boot instances
- `coupon-nginx` → Nginx load balancer

---

## 1. The Dockerfile — Multi-Stage Build

```dockerfile
# Stage 1: Build the application
FROM gradle:8-jdk26-alpine AS build
WORKDIR /app
COPY build.gradle settings.gradle ./
COPY gradle ./gradle
COPY src ./src
RUN gradle bootJar --no-daemon

# Stage 2: Minimal runtime image
FROM eclipse-temurin:26-jre-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Stage 1 — Build
- Uses `gradle:8-jdk26-alpine` — a complete build environment with Gradle and JDK 26
- Copies only the files Gradle needs (source + build config)
- Runs `gradle bootJar` to produce a fat JAR

### Stage 2 — Runtime
- Uses `eclipse-temurin:26-jre-alpine` — minimal JRE (no compiler, no build tools)
- Installs `curl` for Docker health checks (~1MB)
- Copies only the JAR from the build stage (build tools are discarded)
- Final image is **~180MB** — compared to ~800MB if we kept the JDK

### .dockerignore

```
.git
.gitattributes
.gitignore
.gradle
build
*.md
.DS_Store
```

Without `.dockerignore`, Docker sends the entire project directory (including `.git`, `build`, `node_modules`) to the Docker daemon. The `.dockerignore` keeps the build context lean and fast.

---

## 2. Docker Compose — Full Configuration

```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: coupon-mysql
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: coupon_db
      MYSQL_USER: coupon_user
      MYSQL_PASSWORD: coupon_pass
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql-init:/docker-entrypoint-initdb.d
    networks:
      - coupon-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 20s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: coupon-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - coupon-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      timeout: 10s
      retries: 5

  coupon-app-1:
    build:
      context: ./coupon-service
      dockerfile: Dockerfile
    container_name: coupon-app-1
    environment:
      SPRING_APPLICATION_NAME: coupon-app-1
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/coupon_db
      SPRING_DATASOURCE_USERNAME: coupon_user
      SPRING_DATASOURCE_PASSWORD: coupon_pass
      SPRING_DATA_REDIS_HOST: redis
      SPRING_DATA_REDIS_PORT: 6379
      COUPON_LOCK_ENABLED: "true"
      COUPON_INSTANCE_NAME: coupon-app-1
      SERVER_PORT: 8080
    ports:
      - "8081:8080"
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 60s

  nginx:
    build:
      context: ./nginx
      dockerfile: Dockerfile
    container_name: coupon-nginx
    ports:
      - "80:80"
    depends_on:
      - coupon-app-1
      - coupon-app-2
      - coupon-app-3

volumes:
  mysql_data:
  redis_data:

networks:
  coupon-network:
    driver: bridge
```

---

## 3. Deep Dive: Each Docker Concept

### Service Dependencies with Health Checks

```yaml
depends_on:
  mysql:
    condition: service_healthy
  redis:
    condition: service_healthy
```

**Why not just `depends_on: - mysql`?** Without `condition: service_healthy`, Docker Compose starts the app as soon as the MySQL container starts — not when MySQL is ready to accept connections. MySQL can take 10–30 seconds to initialize on first run.

**The health check ensures:**
1. MySQL container starts
2. `mysqladmin ping` succeeds (MySQL is accepting connections)
3. Only then does the app container start

### Health Check Strategies

| Service | Health Check | Why This Works |
|---------|-------------|----------------|
| **MySQL** | `mysqladmin ping -h localhost` | Built-in MySQL tool, returns exit code 0 when server is up |
| **Redis** | `redis-cli ping` | Returns `PONG` when server is up |
| **Spring Boot** | `curl http://localhost:8080/actuator/health` | Spring Boot Actuator endpoint — returns 200 when the app is ready |
| **Nginx** | No health check needed | Nginx starts immediately and handles failures at the upstream level |

### start_period — Graceful Startup

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
  interval: 15s
  timeout: 5s
  retries: 10
  start_period: 60s
```

**`start_period: 60s`** gives the Spring Boot application up to 60 seconds to start before Docker considers health checks "failed". Without this, a slow startup (JVM warmup, JPA schema generation, connection pool initialization) triggers unnecessary restarts.

### Environment Variable Configuration

```yaml
environment:
  SPRING_APPLICATION_NAME: coupon-app-1
  SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/coupon_db
  SPRING_DATASOURCE_USERNAME: coupon_user
  SPRING_DATASOURCE_PASSWORD: coupon_pass
  SPRING_DATA_REDIS_HOST: redis
  COUPON_LOCK_ENABLED: "true"
  COUPON_INSTANCE_NAME: coupon-app-1
  SERVER_PORT: 8080
```

**Spring Boot's relaxed binding** maps environment variables to `application.yaml` properties automatically:

| Environment Variable | application.yaml Property |
|---------------------|--------------------------|
| `SPRING_DATASOURCE_URL` | `spring.datasource.url` |
| `SPRING_DATA_REDIS_HOST` | `spring.data.redis.host` |
| `COUPON_LOCK_ENABLED` | `coupon.lock.enabled` |
| `COUPON_INSTANCE_NAME` | `coupon.instance.name` |
| `SERVER_PORT` | `server.port` |

This is why the same JAR works in development (reading `application.yaml`) and in Docker (reading environment variables) — **no code changes needed**.

### Container Networking — DNS Resolution

All services share the `coupon-network` bridge network. Docker Compose sets up DNS resolution where each container is reachable by its service name.

```yaml
networks:
  coupon-network:
    driver: bridge
```

In the application:
- Database URL: `jdbc:mysql://mysql:3306/coupon_db` (not `localhost`)
- Redis host: `redis` (not `localhost`)
- Nginx upstream: `server coupon-app-1:8080` (not `localhost:8081`)

**No hardcoded IPs.** Docker DNS resolves these automatically.

### Volumes — Data Persistence

```yaml
volumes:
  mysql_data:
  redis_data:
```

```yaml
services:
  mysql:
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql-init:/docker-entrypoint-initdb.d
```

MySQL stores data in the `mysql_data` volume. **Without a volume, all data is lost when the container restarts.** With a volume, data survives restarts, rebuilds, and even `docker compose down`.

The `mysql-init` directory is bind-mounted into `/docker-entrypoint-initdb.d`. MySQL executes any `.sql` files in this directory on first startup — in our case, granting privileges to the `coupon_user`.

```sql
-- mysql-init/init.sql
GRANT ALL PRIVILEGES ON coupon_db.* TO 'coupon_user'@'%';
FLUSH PRIVILEGES;
```

---

## 4. Running the System

```bash
# Build and start all services
docker compose up --build -d

# Check status
docker compose ps

# View logs for all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f coupon-app-1

# Execute a command in a running container
docker exec -it coupon-mysql mysql -u coupon_user -p coupon_db

# Connect to Redis
docker exec -it coupon-redis redis-cli

# Stop all services
docker compose down

# Stop and remove volumes (clean database)
docker compose down -v

# Rebuild a specific service
docker compose up --build -d coupon-app-1
```

---

## 5. Service Configuration Comparison

Each Spring Boot instance is identical except for **two environment variables**:

| Variable | app-1 | app-2 | app-3 |
|----------|-------|-------|-------|
| `SPRING_APPLICATION_NAME` | `coupon-app-1` | `coupon-app-2` | `coupon-app-3` |
| `COUPON_INSTANCE_NAME` | `coupon-app-1` | `coupon-app-2` | `coupon-app-3` |
| Published Port | `8081` | `8082` | `8083` |

**Same Dockerfile, same JAR, different configuration.** This is the essence of containerized microservices.

---

## 6. Toggling the Distributed Lock

To demonstrate the race condition:

```yaml
# docker-compose.yml
services:
  coupon-app-1:
    environment:
      COUPON_LOCK_ENABLED: "false"  # Disable lock on this instance
```

Or without editing the file:

```bash
COUPON_LOCK_ENABLED=false docker compose up -d coupon-app-1
```

When lock is disabled, the `NoLockStrategy` is used (always returns true). The application runs the same code path — but without coordination. **Race conditions become visible immediately.**

---

## Docker Commands Reference

| Command | Description |
|---------|-------------|
| `docker compose up --build -d` | Build and start all services in background |
| `docker compose down` | Stop and remove all containers |
| `docker compose down -v` | Stop and remove volumes (clean state) |
| `docker compose ps` | List service status |
| `docker compose logs -f` | Tail logs from all services |
| `docker compose logs -f app-1` | Tail logs from one service |
| `docker compose build app-1` | Rebuild a single service image |
| `docker compose restart app-1` | Restart a single service |
| `docker exec -it coupon-mysql bash` | Shell into a running container |
| `docker compose config` | Validate docker-compose.yml syntax |
| `docker system prune` | Clean up unused Docker resources |

---

## Conclusion

Docker Compose transforms a complex 6-service microservices architecture into a **single-command setup**. This project demonstrates:

- **Multi-stage Dockerfiles** — separating build from runtime for minimal images
- **Health checks with `start_period`** — ensuring services start in the right order
- **Environment variable configuration** — Spring Boot's relaxed binding for zero-code-change deployments
- **Docker DNS networking** — service discovery by container name
- **Persistent volumes** — database data survives restarts

All six services, one command:

```bash
docker compose up --build -d
```

**[github.com/.../coupon-redemption-system](https://github.com/)**

---

*For the full architecture overview including how these containers interact, read [Story 1: Architecture Overview](1-distributed-coupon-redemption-architecture-overview.md). For the Spring Boot application each container runs, read [Story 2: Spring Boot Concepts](2-spring-boot-concepts-distributed-locking.md).*
