# ---- Frontend build stage ----
FROM node:22 AS frontend-builder
WORKDIR /app
COPY frontend/ ./
RUN npm ci && npm run build

# ---- Backend build stage ----
# Use the JDK matching the project's jvmToolchain(26).
# Install Gradle on top since gradle:8-jdk26 is not published as an official tag.
FROM eclipse-temurin:26-jdk AS backend-builder

ENV GRADLE_VERSION=8.13

# Install Gradle
RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/* && \
    curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o gradle.zip && \
    unzip -q gradle.zip -d /opt && \
    rm gradle.zip && \
    ln -s "/opt/gradle-${GRADLE_VERSION}/bin/gradle" /usr/local/bin/gradle && \
    mkdir -p /app

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
FROM eclipse-temurin:23-jre

WORKDIR /app

# Create the data directory layout expected by the app
RUN mkdir -p /app/data/config /app/data/items /app/data/photos /app/data/platforms

# Copy the installed distribution from the builder
COPY --from=backend-builder /app/build/install/sell-your-shit/ .

EXPOSE 45966

VOLUME ["/app/data"]

CMD ["./bin/sell-your-shit"]
