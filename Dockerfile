# ---- Build stage ----
FROM gradle:8-jdk23 AS builder

WORKDIR /app

# Install Node.js for the Vite/React frontend build
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency descriptors first for layer caching
COPY build.gradle.kts settings.gradle.kts ./
COPY frontend/package.json frontend/package-lock.json ./

# Download Gradle dependencies (cached unless build.gradle.kts changes)
RUN gradle build --no-daemon || true

# Install npm dependencies
WORKDIR /app/frontend
RUN npm ci
WORKDIR /app

# Copy all sources
COPY . .

# Build the frontend then the backend (processResources triggers copyFrontend)
RUN gradle installDist --no-daemon

# ---- Runtime stage ----
FROM eclipse-temurin:23-jre

WORKDIR /app

# Create the data directory layout expected by the app
RUN mkdir -p /app/data/config /app/data/items /app/data/photos /app/data/platforms

# Copy the installed distribution from the builder
COPY --from=builder /app/build/install/sell-your-shit/ .

# The app reads the PORT env var (set by Coolify) — required, no default.
EXPOSE 45966

VOLUME ["/app/data"]

CMD ["./bin/sell-your-shit"]
