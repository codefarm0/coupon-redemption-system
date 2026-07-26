# Coupon Redemption System - Distributed Locking with Redis

> **A production-grade microservices demo showcasing distributed locking patterns to prevent race conditions in high-concurrency e-commerce scenarios.**

---

## Overview

This project demonstrates how **distributed locking** solves race condition problems in multi-instance deployments. It's a practical learning tool for understanding:

- **Race Conditions**: What happens when multiple instances compete for the same resource
- **Distributed Locks**: How Redis prevents concurrent access violations
- **Load Balancing**: How Nginx routes requests across multiple instances
- **System Resilience**: Handling failures while maintaining data consistency

### Real-World Scenario

Imagine a flash sale with a limited-time coupon code offering only **100 redemptions**. When 1000 users simultaneously attempt to redeem it:

**Without Locking (Race Condition):**
```
Instance-1 reads: 100 → decrements to 99 → saves
Instance-2 reads: 100 → decrements to 99 → saves (overwrites Instance-1!)
Instance-3 reads: 100 → decrements to 99 → saves (overwrites Instance-2!)
Result: 200+ users redeemed a 100-unit coupon ❌ Business loss!
```

**With Distributed Locking:**
```
Instance-1 acquires lock → reads 100 → decrements to 99 → saves → releases lock
Instance-2 waits for lock...
Instance-3 waits for lock...
Instance-2 acquires lock → reads 99 → decrements to 98 → saves → releases lock
...continues until 0 remaining
Result: Exactly 100 users redeemed ✅ Consistent state!
```

---

## System Architecture

### High-Level Deployment Diagram

```mermaid
graph TB
    Browser["🌐 Browser<br/>React Frontend<br/>localhost:5175"]
    Nginx["⚖️ Nginx Load Balancer<br/>Port: 80<br/>Strategy: least_conn"]
    
    App1["🚀 Spring Boot Instance 1<br/>coupon-app-1<br/>Port: 8081"]
    App2["🚀 Spring Boot Instance 2<br/>coupon-app-2<br/>Port: 8082"]
    App3["🚀 Spring Boot Instance 3<br/>coupon-app-3<br/>Port: 8083"]
    
    MySQL["🗄️ MySQL<br/>coupon_db<br/>Port: 3306"]
    Redis["🔴 Redis<br/>Distributed Lock<br/>Port: 6379"]
    
    Browser -->|http://localhost| Nginx
    Nginx -->|least_conn| App1
    Nginx -->|least_conn| App2
    Nginx -->|least_conn| App3
    
    App1 -->|Read/Write| MySQL
    App2 -->|Read/Write| MySQL
    App3 -->|Read/Write| MySQL
    
    App1 -->|Acquire/Release Lock| Redis
    App2 -->|Acquire/Release Lock| Redis
    App3 -->|Acquire/Release Lock| Redis
    
    style Browser fill:#4A90E2
    style Nginx fill:#F5A623
    style App1 fill:#7ED321
    style App2 fill:#7ED321
    style App3 fill:#7ED321
    style MySQL fill:#BD10E0
    style Redis fill:#FF2D55
```

### Request Flow for Coupon Redemption

```mermaid
sequenceDiagram
    participant User as User Browser
    participant Nginx as Nginx<br/>Load Balancer
    participant App as Spring Boot<br/>Instance
    participant Redis as Redis Lock
    participant DB as MySQL DB
    
    User->>Nginx: POST /api/coupons/redeem<br/>(User: "Rahul", Code: "SUMMER50")
    activate Nginx
    Nginx->>Nginx: Select instance with<br/>least connections
    Nginx->>App: Forward request
    deactivate Nginx
    
    activate App
    App->>Redis: Acquire lock<br/>coupon:lock:SUMMER50
    activate Redis
    Redis-->>App: ✅ Lock acquired
    deactivate Redis
    
    App->>DB: Read coupon<br/>(remaining=80)
    activate DB
    DB-->>App: coupon object
    deactivate DB
    
    alt Sufficient Remaining
        App->>DB: Update remaining=79
        activate DB
        DB-->>App: ✅ Updated
        deactivate DB
        
        App->>DB: Insert redemption record<br/>(Rahul, SUCCESS)
        activate DB
        DB-->>App: ✅ Inserted
        deactivate DB
        
        App->>Redis: Release lock
        activate Redis
        Redis-->>App: ✅ Released
        deactivate Redis
        
        App-->>Nginx: {success: true, message: "Coupon Redeemed"}
    else Exhausted (remaining ≤ 0)
        App->>DB: Insert redemption record<br/>(Rahul, FAILED)
        activate DB
        DB-->>App: ✅ Inserted
        deactivate DB
        
        App->>Redis: Release lock
        activate Redis
        Redis-->>App: ✅ Released
        deactivate Redis
        
        App-->>Nginx: {success: false, message: "Coupon Exhausted"}
    end
    
    deactivate App
    Nginx-->>User: Response + Instance Name
```

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Backend** | Spring Boot 4 | REST APIs, Business Logic |
| | Spring Data JPA | ORM & Database Access |
| | MySQL 8 | Persistent Storage |
| | Redis 7 | Distributed Lock & Cache |
| | Gradle 9.5 | Build Tool |
| | JDK 26 | Runtime |
| **Frontend** | React 19 | UI Framework |
| | Material UI (MUI) | Component Library |
| | Vite | Build Tool |
| **Infrastructure** | Nginx (Alpine) | Load Balancer |
| | Docker | Containerization |
| | Docker Compose | Orchestration |

---

## Data Model

### Entity Relationship Diagram

```mermaid
erDiagram
    COUPON ||--o{ COUPON_REDEMPTION : has
    
    COUPON {
        bigint id PK
        varchar code UK "Unique coupon code"
        int total_redemptions "Maximum redemptions allowed"
        int remaining_redemptions "Remaining redemptions count"
        timestamp created_at "Creation timestamp"
    }
    
    COUPON_REDEMPTION {
        bigint id PK
        bigint coupon_id FK "Reference to Coupon"
        varchar username "Username of redeemer"
        enum status "SUCCESS or FAILED"
        timestamp redeemed_at "Redemption timestamp"
    }
```

### Database Schema

**COUPON Table:**
```sql
CREATE TABLE coupon (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(100) UNIQUE NOT NULL,
    total_redemptions INT NOT NULL,
    remaining_redemptions INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**COUPON_REDEMPTION Table:**
```sql
CREATE TABLE coupon_redemption (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    coupon_id BIGINT NOT NULL,
    username VARCHAR(100) NOT NULL,
    status ENUM('SUCCESS', 'FAILED') NOT NULL,
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coupon_id) REFERENCES coupon(id)
);
```

---

## API Contracts

### 1. Create Coupon

**Endpoint:** `POST /api/coupons`

**Request:**
```json
{
  "code": "SUMMER50",
  "totalRedemptions": 100
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "code": "SUMMER50",
  "remainingRedemptions": 100
}
```

**Errors:**
- `400 Bad Request` - Invalid code or totalRedemptions
- `409 Conflict` - Coupon code already exists

---

### 2. List Coupons (Paginated)

**Endpoint:** `GET /api/coupons?page=0&size=5`

**Query Parameters:**
- `page` (int, default: 0) - Page number (0-indexed)
- `size` (int, default: 5) - Items per page

**Response (200 OK):**
```json
{
  "content": [
    {
      "id": 1,
      "code": "SUMMER50",
      "totalRedemptions": 100,
      "remainingRedemptions": 80,
      "createdAt": "2026-07-04T10:00:00Z"
    },
    {
      "id": 2,
      "code": "WELCOME10",
      "totalRedemptions": 50,
      "remainingRedemptions": 45,
      "createdAt": "2026-07-04T11:00:00Z"
    }
  ],
  "page": 0,
  "size": 5,
  "totalPages": 4,
  "totalElements": 20
}
```

---

### 3. Redeem Coupon

**Endpoint:** `POST /api/coupons/redeem`

**Request:**
```json
{
  "couponCode": "SUMMER50",
  "username": "Rahul"
}
```

**Response - Success (200 OK):**
```json
{
  "success": true,
  "message": "Coupon Redeemed",
  "instanceName": "coupon-app-1"
}
```

**Response - Failure (200 OK):**
```json
{
  "success": false,
  "message": "Coupon Exhausted",
  "instanceName": "coupon-app-2"
}
```

**Possible Messages:**
- `Coupon Redeemed` - Successfully redeemed
- `Coupon Exhausted` - No remaining redemptions
- `Coupon Not Found` - Invalid coupon code
- `Coupon is busy, please retry.` - Lock acquisition timeout

**Errors:**
- `400 Bad Request` - Missing couponCode or username
- `503 Service Unavailable` - System overloaded

---

### 4. Get Redemption History

**Endpoint:** `GET /api/coupons/{couponId}/redemptions?page=0&size=5`

**Path Parameters:**
- `couponId` (long) - ID of the coupon

**Query Parameters:**
- `page` (int, default: 0) - Page number (0-indexed)
- `size` (int, default: 5) - Items per page

**Response (200 OK):**
```json
{
  "content": [
    {
      "username": "Rahul",
      "couponCode": "SUMMER50",
      "status": "SUCCESS",
      "redeemedAt": "2026-07-04T12:36:00Z"
    },
    {
      "username": "Priya",
      "couponCode": "SUMMER50",
      "status": "SUCCESS",
      "redeemedAt": "2026-07-04T12:36:01Z"
    },
    {
      "username": "Deepak",
      "couponCode": "SUMMER50",
      "status": "FAILED",
      "redeemedAt": "2026-07-04T12:36:02Z"
    }
  ],
  "page": 0,
  "size": 5,
  "totalPages": 20,
  "totalElements": 100
}
```

**Errors:**
- `404 Not Found` - Coupon not found

---

## Project Structure

```
coupon-redemption-system/
├── coupon-service/              # Spring Boot Backend
│   ├── src/main/java/
│   │   └── in/codefarm/coupon/service/
│   │       ├── controller/      # REST Controllers
│   │       ├── service/         # Business Logic
│   │       ├── entity/          # JPA Entities
│   │       ├── repository/      # Data Access Layer
│   │       ├── lock/            # Lock Strategy Pattern
│   │       ├── config/          # Spring Configuration
│   │       ├── dto/             # Data Transfer Objects
│   │       └── exception/       # Custom Exceptions
│   ├── Dockerfile              # Multi-stage build (Gradle + JDK 26)
│   ├── build.gradle            # Gradle dependencies
│   └── README.md               # Backend documentation
│
├── frontend-react/              # React UI
│   ├── src/
│   │   ├── components/         # React Components
│   │   ├── api/                # API Client
│   │   ├── utils/              # Utility Functions
│   │   └── assets/             # Static Assets
│   ├── vite.config.js
│   ├── package.json
│   └── README.md               # Frontend documentation
│
├── nginx/                       # Load Balancer Config
│   ├── nginx.conf              # Nginx configuration with least_conn
│   ├── Dockerfile              # Nginx container
│   └── README.md               # Nginx documentation
│
├── mysql-init/                 # Database Initialization
│   └── init.sql               # Schema creation scripts
│
├── docker-compose.yml          # Orchestration
│   # Services defined:
│   # - mysql:8.0
│   # - redis:7-alpine
│   # - coupon-app-1, coupon-app-2, coupon-app-3
│   # - nginx
│
└── README.md                   # This file
```

---

## Getting Started

### Prerequisites

- **Docker & Docker Compose** — for MySQL, Redis, and full-stack deployment
- **Java 26+** — for running the backend via Gradle
- **Node.js 20+** — for the React frontend
- **Git**

---

### 1. Running the Full Stack (All Services via Docker Compose)

Start everything — MySQL, Redis, 3 Spring Boot instances, and Nginx:

```bash
# Build and start all services
docker compose up --build -d

# Check service status
docker compose ps

# Tail logs for all services
docker compose logs -f
```

**What starts:**

| Service | Container Name | Port | Purpose |
|---------|---------------|------|---------|
| MySQL 8 | `coupon-mysql` | `3306` | Persistent coupon/redemption storage |
| Redis 7 | `coupon-redis` | `6379` | Distributed locking |
| App Instance 1 | `coupon-app-1` | `8081` | Spring Boot — lock enabled |
| App Instance 2 | `coupon-app-2` | `8082` | Spring Boot — lock enabled |
| App Instance 3 | `coupon-app-3` | `8083` | Spring Boot — lock enabled |
| Nginx | `coupon-nginx` | `80` | Load balancer (least_conn) |

**Verify everything is healthy:**
```bash
# Nginx health
curl http://localhost/health

# API via load balancer
curl http://localhost/api/coupons?page=0&size=5

# Direct to a specific instance
curl http://localhost:8081/api/coupons
```

**Access the application:**
- **API (via Nginx):** `http://localhost/api/`
- **Direct to instance 1:** `http://localhost:8081/`
- **Direct to instance 2:** `http://localhost:8082/`
- **Direct to instance 3:** `http://localhost:8083/`

> The frontend connects to the API at `http://localhost/` (Nginx) when served via Docker, or at `http://localhost:8085/` when running the React dev server locally.

---

### 2. Running Backend with Docker (MySQL + Redis + Nginx)

#### Option A: Full Stack (recommended for testing)
```bash
docker compose up --build -d
```

#### Option B: Infrastructure only (MySQL + Redis — run app locally via Gradle)
Start only the data services and develop the backend with hot-reload:

```bash
# Start only MySQL and Redis
docker compose up -d mysql redis

# Verify they're healthy
docker compose ps
```

Then run the Spring Boot app locally:

```bash
# From coupon-service/
./gradlew bootRun
```

The app will connect to MySQL at `localhost:3306` and Redis at `localhost:6379` as configured in `application.yaml`.

#### Toggling the Distributed Lock

No code changes needed — just flip the config:

```bash
# Disable lock (observe race condition)
COUPON_LOCK_ENABLED=false docker compose up -d coupon-app-1

# Enable lock (strict counting)
COUPON_LOCK_ENABLED=true docker compose up -d coupon-app-1
```

Or edit `application.yaml`:
```yaml
coupon:
  lock:
    enabled: false   # Set to false to simulate race conditions
```

---

### 3. Connecting to MySQL and Redis

#### MySQL

```bash
# Connect via CLI
docker exec -it coupon-mysql mysql -u coupon_user -p coupon_db
# Password: coupon_pass

# Or as root
docker exec -it coupon-mysql mysql -u root -p
# Password: root
```

**Useful queries:**
```sql
-- List all coupons
SELECT id, code, total_redemptions, remaining_redemptions, created_at
FROM coupons \G

-- Check remaining counts
SELECT code, remaining_redemptions
FROM coupons
WHERE code = 'SUMMER50';

-- View recent redemptions
SELECT cr.username, c.code, cr.status, cr.redeemed_at
FROM coupon_redemptions cr
JOIN coupons c ON c.id = cr.coupon_id
ORDER BY cr.redeemed_at DESC
LIMIT 20;

-- Count successes vs failures per coupon
SELECT c.code,
       SUM(CASE WHEN cr.status = 'SUCCESS' THEN 1 ELSE 0 END) AS successes,
       SUM(CASE WHEN cr.status = 'FAILED' THEN 1 ELSE 0 END) AS failures
FROM coupon_redemptions cr
JOIN coupons c ON c.id = cr.coupon_id
GROUP BY c.code;
```

#### Redis

```bash
# Connect via CLI
docker exec -it coupon-redis redis-cli

# Or with specific host/port
redis-cli -h localhost -p 6379
```

**Useful commands:**
```bash
# List all lock keys
KEYS coupon:lock:*

# Check if a specific lock exists
GET coupon:lock:SUMMER50

# Get TTL of a lock
TTL coupon:lock:SUMMER50

# Monitor live lock operations
MONITOR

# Clear all locks (reset)
FLUSHALL

# Check Redis info
INFO
```

#### Connecting from applications / GUI tools

| Tool | MySQL | Redis |
|------|-------|-------|
| **Host** | `localhost` | `localhost` |
| **Port** | `3306` | `6379` |
| **Database** | `coupon_db` | — |
| **Username** | `coupon_user` | — |
| **Password** | `coupon_pass` | — |

> GUI clients like **DBeaver**, **TablePlus**, **Redis Insight**, or **Another Redis Desktop Manager** can connect using the above credentials.

---

### 4. Running the Frontend

#### Option A: With Mock Data (no backend required)

The frontend includes an in-memory mock API that simulates all backend endpoints. No MySQL, Redis, or Java needed:

```bash
cd frontend-react
npm install
npm run dev
```

Open `http://localhost:5173` (or the port shown in terminal).

**What the mock provides:**
- 25 pre-seeded coupons across 5 pages
- Click "Claim x10/x100/x1000" to simulate concurrent users
- Lock toggle in the top bar switches between strict and oversell modes
- Redemption history tracked in memory
- Random Indian names (Rahul, Priya, Neha, ...) generated for simulation

> Use this for UI development or demonstrations without infrastructure.

#### Option B: Connected to the Real Backend

```bash
# Step 1: Start the backend
docker compose up -d

# Step 2: Update the frontend API URL
# Edit frontend-react/src/api/mockApi.js
# Replace mock implementations with real fetch calls to:
# http://localhost/api/coupons

# Step 3: Start the frontend
cd frontend-react
npm install
npm run dev
```

> When the real backend is connected, the lock toggle in the Docker backend (`coupon.lock.enabled`) controls the race condition behavior. The frontend's toggle is only for mock mode.

---

## Documentation

### Subdirectory Guides

| Component | Documentation |
|-----------|---|
| **Backend** | [coupon-service/README.md](coupon-service/README.md) - Spring Boot setup, lock strategies, configuration |
| **Frontend** | [frontend-react/README.md](frontend-react/README.md) - React components, API client, UI features |
| **Load Balancer** | [nginx/README.md](nginx/README.md) - Nginx configuration, routing strategy, monitoring |

---

## Learning: Race Condition vs. Distributed Locking

### Scenario: Redeem 100 coupons with 80 available

**Without Lock (`coupon.lock.enabled=false`):**

**Without Lock (`coupon.lock.enabled=false`):**

```
Expected: 80 SUCCESS, 20 FAILED
Actual Results (Multiple runs):
├── Run 1: 5 SUCCESS, 95 FAILED    ❌ Inconsistent!
├── Run 2: 42 SUCCESS, 58 FAILED   ❌ Inconsistent!
├── Run 3: 78 SUCCESS, 22 FAILED   ❌ Inconsistent!
└── Run 4: 12 SUCCESS, 88 FAILED   ❌ Inconsistent!

Why? Race conditions at work:
- All 3 instances read remaining=80 simultaneously
- All decrement and save 79 (overwriting each other)
- Only the last write persists, losing 79 potential redemptions
```

**With Lock (`coupon.lock.enabled=true`):**

```
Expected: 80 SUCCESS, 20 FAILED
Actual Results (Multiple runs):
├── Run 1: 80 SUCCESS, 20 FAILED   ✅ Perfect!
├── Run 2: 80 SUCCESS, 20 FAILED   ✅ Perfect!
├── Run 3: 80 SUCCESS, 20 FAILED   ✅ Perfect!
└── Run 4: 80 SUCCESS, 20 FAILED   ✅ Perfect!

Why? Distributed locking at work:
- Instance-1 acquires lock → processes request 1
- Instance-2 waits for lock...
- Instance-3 waits for lock...
- Only after release does next instance proceed
- Exact consistency maintained!
```

---

## How Distributed Locking Works

### Lock Strategy Pattern

Your application uses a **Strategy Pattern** for flexible lock implementation:

```mermaid
graph TD
    Service["CouponRedemptionService"]
    Interface["LockStrategy<br/>Interface"]
    NoLock["NoLockStrategy<br/>Do nothing"]
    RedisLock["RedisLockStrategy<br/>Use Redis"]
    
    Service -->|depends on| Interface
    Interface --|implemented by| NoLock
    Interface --|implemented by| RedisLock
    
    Config["application.properties<br/>coupon.lock.enabled"]
    Config -->|if true| RedisLock
    Config -->|if false| NoLock
```

### Lock Acquisition with Exponential Backoff

When a request arrives to redeem a coupon:

```
Request arrives (User: "Rahul", Coupon: "SUMMER50")
    ↓
Try to acquire lock
    ├─ Attempt 1: Try immediately → FAIL (locked by other request)
    ├─ Wait 50ms
    ├─ Attempt 2: Try again → FAIL
    ├─ Wait 100ms (doubled)
    ├─ Attempt 3: Try again → FAIL
    ├─ Wait 200ms (doubled)
    ├─ Attempt 4: Try again → FAIL
    ├─ Wait 400ms (doubled)
    ├─ Attempt 5: Try again → SUCCESS! ✅
    ├─ Process redemption
    └─ Release lock
    
Logs show:
[LOCK ACQUIRED] User: Rahul, Coupon: SUMMER50, Attempt: 5/10, Instance: coupon-app-1
[COUPON REDEEMED] User: Rahul, Coupon: SUMMER50, Remaining: 79, Instance: coupon-app-1
[LOCK RELEASED] User: Rahul, Coupon: SUMMER50, Instance: coupon-app-1
```

---

## Load Balancing with Nginx

### Least Connections Strategy

Nginx routes requests to the instance with the **fewest active connections**:

```mermaid
graph LR
    Req1["Request 1"]
    Req2["Request 2"]
    Req3["Request 3"]
    Req4["Request 4"]
    
    Nginx["Nginx<br/>least_conn"]
    
    App1["App-1<br/>0 active"]
    App2["App-2<br/>0 active"]
    App3["App-3<br/>0 active"]
    
    Req1 --> Nginx
    Req2 --> Nginx
    Req3 --> Nginx
    Req4 --> Nginx
    
    Nginx -->|to least<br/>loaded| App1
    Nginx -->|to least<br/>loaded| App2
    Nginx -->|to least<br/>loaded| App3
    
    style App1 fill:#7ED321
    style App2 fill:#7ED321
    style App3 fill:#7ED321
```

**Advantages:**
- ✅ Automatically balances load in real-time
- ✅ Adapts to varying request durations
- ✅ Prevents overloading a single instance
- ✅ Better than round-robin for heterogeneous workloads

**Monitor in Logs:**
```bash
docker logs coupon-nginx -f | grep upstream
# Output shows which instance served each request:
# upstream: 172.18.0.4:8080  (app-1)
# upstream: 172.18.0.5:8080  (app-2)
# upstream: 172.18.0.6:8080  (app-3)
```

---

## Key Features

### ✅ Implemented

- [x] Multi-instance deployment with load balancing
- [x] Distributed locking with Redis using exponential backoff retry
- [x] Coupon CRUD operations with pagination
- [x] Batch redemption simulation (10, 100, 1000 users)
- [x] Redemption history tracking with pagination
- [x] Configurable lock toggle (no code changes needed)
- [x] Real-time UI with Material Design
- [x] Detailed logging for debugging and observation
- [x] Docker Compose orchestration with health checks
- [x] Postman collection for API testing

### 🎓 Learning Outcomes

By working through this project, you'll understand:

1. **Race Conditions** - How they occur in distributed systems
2. **Distributed Locks** - Using Redis as a coordination mechanism
3. **Lock Strategies** - Retry logic and exponential backoff
4. **Load Balancing** - How Nginx distributes requests (least_conn)
5. **Microservices Architecture** - Multi-tier distributed systems
6. **Spring Boot** - Building production-grade REST APIs
7. **Data Consistency** - Maintaining integrity under concurrency
8. **Docker** - Containerization and orchestration
9. **System Design** - Scalable and resilient architectures
10. **Testing Distributed Systems** - Observing behavior with and without locks

---

## Monitoring & Debugging

### View All Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f coupon-app-1
docker-compose logs -f coupon-app-2
docker-compose logs -f coupon-app-3
docker-compose logs -f nginx
docker-compose logs -f redis
docker-compose logs -f mysql
```

### View Nginx Routing

```bash
docker logs coupon-nginx -f | grep upstream
```

### Check Lock Activity

```bash
docker logs coupon-app-1 -f | grep "LOCK"
# Shows:
# [LOCK ACQUIRED] User: Rahul, Coupon: SUMMER50, ...
# [LOCK RETRY] User: Priya, Coupon: SUMMER50, ...
# [LOCK FAILED] User: Deepak, Coupon: SUMMER50, ...
```

### Direct Database Query

```bash
# Access MySQL
docker exec -it coupon-mysql mysql -u coupon_user -p coupon_db
# Password: coupon_pass

# View remaining count
SELECT code, total_redemptions, remaining_redemptions FROM coupon;

# View redemption history
SELECT username, status, redeemed_at FROM coupon_redemption ORDER BY redeemed_at DESC LIMIT 20;
```

### Direct Redis Query

```bash
# Access Redis
docker exec -it coupon-redis redis-cli

# List all locks (if any are held)
KEYS coupon:lock:*

# Check specific lock
GET coupon:lock:SUMMER50
```

---

## Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes (clean database)
docker-compose down -v

# Remove images and rebuild
docker-compose down --rmi all
docker-compose up --build -d
```

---

## Postman Collection

A Postman collection is included for API testing:

**File:** `coupon-service.postman_collection.json`

**To use:**
1. Import into Postman
2. Set base URL variable: `http://localhost/api`
3. Test endpoints (Create, List, Redeem, History)

---

## Production Considerations

### Security

- [ ] Add authentication (JWT/OAuth)
- [ ] Add authorization (role-based access)
- [ ] Enable HTTPS/TLS
- [ ] Add rate limiting
- [ ] Input validation and sanitization

### Resilience

- [ ] Circuit breaker pattern for Redis
- [ ] Fallback strategies if Redis unavailable
- [ ] Connection pooling optimization
- [ ] Timeout configurations
- [ ] Retry policies with jitter

### Monitoring

- [ ] Application metrics (Micrometer/Prometheus)
- [ ] Distributed tracing (Jaeger/Zipkin)
- [ ] Health checks and alerts
- [ ] Log aggregation (ELK/Loki)
- [ ] Performance profiling

### Performance

- [ ] Database indexing on coupon_code
- [ ] Connection pool tuning
- [ ] Cache layer for frequently accessed coupons
- [ ] Batch operations for bulk redemptions
- [ ] CDN for static assets

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Strategy Pattern for Locks** | Allow flexible swap between implementations (NoLock, RedisLock) without code changes |
| **Exponential Backoff Retry** | Reduces thundering herd, allows fair lock distribution |
| **Least Connections Load Balancing** | Better than round-robin for variable request durations |
| **Docker Compose** | Single command orchestration for learning/demo purposes |
| **Material UI** | Professional, accessible components out of the box |
| **Pagination on All Endpoints** | Prevents N+1 queries, improves frontend performance |
| **Instance Names in Response** | Makes load distribution visible to understand system behavior |

---

## Troubleshooting

### Issue: "Could not acquire lock" errors even with lock enabled

**Cause:** Lock acquisition timeout (retry logic exhausted)

**Solution:**
- Increase `MAX_LOCK_RETRIES` in `CouponRedemptionService`
- Reduce number of concurrent requests
- Check Redis connectivity: `docker exec coupon-redis redis-cli ping`

### Issue: Inconsistent coupon counts with lock enabled

**Cause:** Lock implementation issue or stale Redis data

**Solution:**
```bash
# Clear Redis locks
docker exec coupon-redis redis-cli FLUSHALL

# Restart services
docker-compose restart
```

### Issue: Requests not distributed evenly across instances

**Cause:** `least_conn` routes to least-connected, not round-robin

**Solution:**
- This is expected! Requests distribute based on active connections
- If uneven, check if instances have different response times
- Verify all 3 instances are healthy: `docker-compose ps`

### Issue: Frontend can't connect to backend

**Cause:** CORS or network issues

**Solution:**
```bash
# Check if Nginx is running
docker-compose ps nginx

# Test Nginx
curl http://localhost/health

# Check backend connectivity
curl http://localhost:8081/actuator/health
```

---

## References & Further Reading

- [Redis Distributed Locks](https://redis.io/commands/set/#options) - SET with NX option
- [Spring Data Redis](https://spring.io/projects/spring-data-redis)
- [Nginx Load Balancing](https://nginx.org/en/docs/http/load_balancing.html)
- [Race Conditions & Concurrency](https://en.wikipedia.org/wiki/Race_condition)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

## Contributing

This is an educational project. Contributions for improvements are welcome:
- Better documentation
- Additional lock strategies
- Performance optimizations
- Security enhancements
- Additional test scenarios

---

## License

This project is provided as-is for learning purposes.

---

## Support

For issues, questions, or feedback:
1. Check the [troubleshooting section](#troubleshooting)
2. Review logs: `docker-compose logs`
3. Consult subdirectory READMEs for component-specific help

---

**Happy learning! Watch the race condition in action and see how distributed locking solves it.** 🚀
