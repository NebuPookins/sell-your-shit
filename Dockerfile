# ---- Frontend build stage ----
FROM node:22 AS frontend-builder
WORKDIR /app
COPY frontend/ ./
RUN npm ci && npm run build

# ---- Backend build stage ----
FROM gradle:8-jdk21 AS backend-builder
WORKDIR /app

# Copy dependency descriptors first for layer caching
COPY build.gradle.kts settings.gradle.kts ./
RUN gradle build --no-daemon || true

# Copy source code
COPY src/ src/

# Copy the pre-built frontend into static resources before running Gradle.
# The npmBuild task onlyIf check will see index.html already exists and skip.
COPY --from=frontend-builder /app/dist src/main/resources/static/

# Build the backend distribution
RUN gradle installDist --no-daemon

# ---- Runtime stage ----
FROM eclipse-temurin:21-jre

WORKDIR /app

# Static config and platform profiles (baked into the image)
COPY config/ config/
ENV CONFIG_DIR=/app/config

# Runtime data directory — mounted as a persistent volume by Coolify
RUN mkdir -p /app/data

# Copy the installed distribution from the builder
COPY --from=backend-builder /app/build/install/sell-your-shit/ .

EXPOSE 45966

VOLUME ["/app/data"]

CMD ["./bin/sell-your-shit"]
