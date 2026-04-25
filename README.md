# Listing Manager

A personal-use web app for managing second-hand item listings across platforms (Craigslist, Facebook Marketplace, Kijiji, OfferUp, eBay, Nextdoor). Enter a description and photos, let Claude generate platform-optimised listings, copy-paste them manually, and track status with expiry/price-decay reminders.

## Prerequisites

- JDK 26+
- Node.js 18+ (for the frontend build)
- An [Anthropic API key](https://console.anthropic.com/)

## First-time setup

### 1. Create the config files

```bash
mkdir -p data/config
```

**`data/config/config.yaml`**
```yaml
port: 45966
decay:
  check-interval-days: 7
  drop-percent: 0.10
```

**`data/config/secrets.yaml`** (keep out of version control)
```yaml
anthropic-api-key: "sk-ant-..."
```

### 2. Install frontend dependencies

```bash
cd frontend && npm install && cd ..
```

## Running

### Production mode

Builds the frontend, embeds it in the backend, and serves everything from one port.

```bash
gradle run
```

Open http://localhost:45966

### Development mode

Starts the Kotlin backend and Vite dev server concurrently. Vite proxies `/api` and `/photos` to the backend, so hot-reload works for frontend changes without a full rebuild.

```bash
gradle runDev
```

Open http://localhost:5173

## Data

All state is stored as YAML files under `data/`:

```
data/
  config/       # config.yaml, secrets.yaml
  platforms/    # per-platform field profiles (craigslist.yaml, facebook.yaml, …)
  items/        # one .yaml file per item, includes all listings inline
  photos/       # original + resized copies of uploaded photos
```

To back up or move the app, copy the `data/` directory — no database to dump.

Config changes (port, decay settings, API key) take effect on the next restart.
