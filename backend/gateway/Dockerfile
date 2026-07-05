# NoteForge api-gateway — Multi-stage Docker build
# Build: docker build -t noteforge/gateway .

# === Stage 1: Build ===
FROM gradle:8.12-jdk21 AS builder
WORKDIR /build

# Cache dependencies
COPY settings.gradle settings.gradle
COPY build.gradle build.gradle
COPY common/build.gradle common/build.gradle
COPY gateway/build.gradle gateway/build.gradle
RUN gradle :common:build --no-daemon --build-cache 2>/dev/null || true

# Copy source & build
COPY common/ common/
COPY gateway/ gateway/
RUN gradle :gateway:bootJar --no-daemon --build-cache -x test

# === Stage 2: Runtime ===
FROM eclipse-temurin:21-jre-alpine
WORKDIR /opt/noteforge

RUN apk add --no-cache curl

COPY --from=builder /build/gateway/build/libs/*.jar app.jar

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8000/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "/opt/noteforge/app.jar"]
