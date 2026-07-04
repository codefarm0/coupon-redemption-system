### 1. Build the Docker image

```bash
docker build -t coupon-service .
```

---

### 2. Run the container

```bash
docker run -d \
  --name coupon-service \
  -p 8080:8080 \
  coupon-service
```

---

### 3. Check running containers

```bash
docker ps
```

---

### 4. View application logs

```bash
docker logs -f coupon-service
```

---

### 5. Stop the container

```bash
docker stop coupon-service
```

---

### 6. Remove the container

```bash
docker rm coupon-service
```

---

### 7. Remove the image (optional)

```bash
docker rmi coupon-service
```

---

## If your application depends on MySQL and Redis

The above `docker run` command is **not enough**, because your Spring Boot application needs to connect to MySQL and Redis.

You'll need to pass the required environment variables, for example:

```bash
docker run -d \
  --name coupon-service \
  -p 8080:8080 \
  -e SPRING_DATASOURCE_URL=jdbc:mysql://host.docker.internal:3306/coupon_db \
  -e SPRING_DATASOURCE_USERNAME=coupon_user \
  -e SPRING_DATASOURCE_PASSWORD=coupon_pass \
  -e SPRING_REDIS_HOST=host.docker.internal \
  -e SPRING_REDIS_PORT=6379 \
  coupon-service
```

## if i make any change in source code then stoping the coupon service and then running docker compose up - d is engouhg?

Not quite. **`docker compose up -d` alone is not enough** if you've changed your application source code.

Here's what happens:

* `docker compose up -d` starts existing containers if they already exist.
* It **does not automatically rebuild** the Docker image when your source code changes.

### Option 1: Rebuild and restart (Recommended)

```bash
docker compose up --build -d
```

This will:

* Rebuild the image for your Spring Boot service(s).
* Recreate the containers using the new image.
* Leave MySQL and Redis data intact (assuming you're using named volumes).

---

### Option 2: Build only the application image

If only the coupon service changed:

```bash
docker compose build coupon-app-1 coupon-app-2 coupon-app-3
docker compose up -d
```

Since all three services use the same image, Docker will build it once and reuse it.

---

### Option 3: Recreate only the application containers

If the image has already been rebuilt:

```bash
docker compose up -d --force-recreate coupon-app-1 coupon-app-2 coupon-app-3
```

---

### Option 4: Full clean rebuild (use when needed)

If Docker seems to be using stale layers or you're troubleshooting:

```bash
docker compose down
docker compose up --build -d
```

Your MySQL and Redis data will remain because they're stored in named volumes (`mysql_data` and `redis_data`).

---

## For your video series

The command you'll probably use most often while developing is:

```bash
docker compose up --build -d
```

It's the simplest and ensures your code changes are included in the new containers without having to remember separate build steps.

