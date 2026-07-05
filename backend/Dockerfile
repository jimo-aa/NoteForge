# NoteForge Backend — Multi-stage Docker build
# Build: docker build --build-arg SERVICE=note-service -t noteforge/note-service .
#        docker build --build-arg SERVICE=user-service -t noteforge/user-service .
#        docker build --build-arg SERVICE=gateway -t noteforge/gateway .

# === Stage 1: Build ===
FROM gradle:8.12-jdk21 AS builder
WORKDIR /build

# Copy dependency descriptors first for layer caching
COPY settings.gradle settings.gradle
COPY build.gradle build.gradle
COPY common/build.gradle common/build.gradle
COPY note-service/build.gradle note-service/build.gradle
COPY user-service/build.gradle user-service/build.gradle
COPY gateway/build.gradle gateway/build.gradle

# Pre-download dependencies (cached unless descriptors change)
RUN gradle :common:build --no-daemon --build-cache 2>/dev/null || true

# Copy source
COPY common/ common/
COPY note-service/ note-service/
COPY user-service/ user-service/
COPY gateway/ gateway/

# Build the specified service
ARG SERVICE=note-service
RUN gradle :${SERVICE}:bootJar --no-daemon --build-cache -x test

# === Stage 2: Runtime ===
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

ARG SERVICE=note-service
ENV SERVICE=${SERVICE}

RUN apk add --no-cache curl

# Copy built JAR
COPY --from=builder /build/${SERVICE}/build/libs/*.jar app.jar

# Expose port (overridden per service via ENV or CMD)
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8081}/actuator/health || exit 1

# Run
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
