# NoteForge note-service — Multi-stage Docker build
# Build: docker build -t noteforge/note-service .

# === Stage 1: Build ===
FROM gradle:8.12-jdk21 AS builder
WORKDIR /build

# Cache dependencies
COPY settings.gradle settings.gradle
COPY build.gradle build.gradle
COPY common/build.gradle common/build.gradle
COPY note-service/build.gradle note-service/build.gradle
COPY user-service/build.gradle user-service/build.gradle
RUN gradle :common:build --no-daemon --build-cache 2>/dev/null || true

# Copy source & build
COPY common/ common/
COPY note-service/ note-service/
RUN ./gradlew :note-service:bootJar --no-daemon --build-cache -x test

# === Stage 2: Runtime ===
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /build/note-service/build/libs/*.jar app.jar

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8081/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
