# ==========================================
# Build Stage
# ==========================================
FROM eclipse-temurin:26-jdk AS builder

WORKDIR /app

# Copy Gradle wrapper and build files
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .

# Copy source code
COPY src src

# Make Gradle wrapper executable
RUN chmod +x gradlew

# Build the Spring Boot executable JAR
RUN ./gradlew clean bootJar --no-daemon

# ==========================================
# Runtime Stage
# ==========================================
FROM eclipse-temurin:26-jdk

WORKDIR /app

# Copy the generated JAR from the builder stage
COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]