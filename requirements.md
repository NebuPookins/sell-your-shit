# Listing Manager — Requirements

## Overview

A personal-use web app that takes a brief item description and photos, uses an LLM to generate platform-optimized product listings, presents them for copy-paste posting, and manages active listings including expiry tracking and price decay suggestions.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Language | Kotlin |
| Backend framework | Ktor |
| Persistence | YAML files on local filesystem (no database) |
| YAML library | kaml (Kotlin multiplatform YAML, kotlinx.serialization-based) |
| Frontend | React (single-page app, served by Ktor) |
| LLM | Anthropic Claude API (claude-sonnet-4-20250514) — vision + structured JSON output |
| Scheduler | Kotlin coroutine-based polling loop (no external scheduler dependency) |
| Photo storage | Local filesystem |
| Config | YAML files (see File Layout) |

---

## Running the App

The app is run on demand via a Gradle task — no packaging or deployment step required.

```bash
./gradlew run
```

- Listens on a configurable port (default: 45966)
- All data lives in a `data/` directory relative to the project root (configurable)
- The app reads its config from `data/config/config.yaml` on startup

---

## Supported Platforms

The app ships with field profiles for the following platforms. New platforms can be added by extending the profile list without code changes (profiles are data-driven).

- Craigslist
- Facebook Marketplace
- Kijiji
- OfferUp
- eBay
- Nextdoor

Each platform profile defines:
- Platform name and display label
- List of fields (name, label, max length if applicable, type: text / number / enum / multiline)
- Enum value sets where applicable (e.g. condition: New / Like New / Good / Fair / Poor)

---

## File Layout

All persistent state is stored as YAML files under the data directory:

```
data/
  config/
    config.yaml          # global settings (port, paths, decay config)
    secrets.yaml         # API keys (Anthropic, etc.) — keep out of version control
  platforms/
    craigslist.yaml      # field profile for Craigslist
    facebook.yaml        # field profile for Facebook Marketplace
    kijiji.yaml
    offerup.yaml
    ebay.yaml
    nextdoor.yaml
  items/
    {item-id}.yaml       # one file per item, includes all listings inline
  photos/
    {item-id}/           # original + resized copies of uploaded photos
      original/
      resized/
```

### config.yaml

```yaml
port: 45966
decay:
  check-interval-days: 7
  drop-percent: 0.10
```

### secrets.yaml

```yaml
anthropic-api-key: "sk-ant-..."
```

### Platform profile (e.g. craigslist.yaml)

```yaml
id: CRAIGSLIST
label: "Craigslist"
fields:
  - name: title
    label: "Title"
    type: text
    max-length: 70
  - name: price
    label: "Price"
    type: number
  - name: category
    label: "Category"
    type: text
  - name: condition
    label: "Condition"
    type: enum
    values: [New, Like New, Good, Fair, Poor]
  - name: description
    label: "Description"
    type: multiline
```

### Item file (e.g. items/{item-id}.yaml)

```yaml
id: "550e8400-e29b-41d4-a716-446655440000"
created-at: "2025-03-18T10:00:00Z"
raw-description: "IKEA KALLAX shelf unit, 2x4, white, good condition, minor scuffs on base"
photos:
  - "photo1.jpg"
  - "photo2.jpg"
minimum-price: 40.00
decay-config: null   # null = use global config; or override inline:
  # check-interval-days: 14
  # drop-percent: 0.15

listings:
  - platform: CRAIGSLIST
    status: ACTIVE           # DRAFT | ACTIVE | EXPIRED | SOLD | CANCELLED
    asking-price: 85.00
    posted-at: "2025-03-18T12:00:00Z"
    expires-at: "2025-04-01T12:00:00Z"
    external-id: "https://surrey.craigslist.org/fuo/d/kallax/123456789.html"
    notes: "Got one inquiry, no show"
    generated-fields:
      title: "IKEA KALLAX 2x4 Shelf Unit — White"
      price: 85.00
      category: "furniture"
      condition: "Good"
      description: "Solid IKEA KALLAX in white ..."
    price-history:
      - price: 95.00
        changed-at: "2025-03-18T12:00:00Z"
        reason: initial
      - price: 85.00
        changed-at: "2025-03-25T10:00:00Z"
        reason: decay

  - platform: FACEBOOK
    status: DRAFT
    asking-price: 85.00
    posted-at: null
    expires-at: null
    external-id: null
    notes: ""
    generated-fields:
      title: "IKEA KALLAX 2x4 Shelf — White, Good Condition"
      price: 85.00
      category: "Home Goods"
      condition: "Good"
      description: "..."
      availability: "Local pickup"
    price-history:
      - price: 85.00
        changed-at: "2025-03-18T12:00:00Z"
        reason: initial
```

Each item file is the single source of truth for that item and all its listings. The backend reads and writes these files directly; there is no database layer. File writes use a write-to-temp-then-rename pattern to avoid corruption on crash.

---

## Core Workflows

### 1. Create Item and Generate Listings

1. User navigates to **New Item**.
2. User enters a free-text description of the item.
3. User uploads one or more photos (JPEG or PNG; max 10MB each; max 10 photos).
4. User selects which platforms to generate listings for (multi-select checkboxes; all selected by default).
5. User clicks **Generate**.
6. Backend sends the description, photos (base64-encoded), and a structured prompt to the Claude API.
7. Claude returns a JSON object keyed by platform, each containing all fields for that platform's profile, plus a suggested asking price.
8. App saves the Item and one Listing per platform (status: DRAFT) with the generated fields.
9. UI navigates to the **Item Detail** page.

### 2. Review and Copy-Paste Listings

1. Item Detail page shows a tab per platform.
2. Each tab displays all generated fields in labeled, editable text inputs.
3. Each field has a **Copy** button that copies just that field's value to clipboard.
4. There is also a **Copy All** button that copies all fields as a formatted block (e.g. "Title: ...\nPrice: ...\nDescription: ...").
5. User can edit any field inline; edits are saved on blur (auto-save, no explicit save button).
6. Once the user has posted on a platform, they click **Mark as Posted**, which opens a small modal asking for:
   - Posted date (defaults to today)
   - Expiry date
   - External listing ID or URL (optional)
7. Submitting the modal sets the listing status to ACTIVE and records `posted_at` and `expires_at`.

### 3. Dashboard

The default landing page. Shows:

- **Renewal Queue** (top section): Listings that are ACTIVE and either:
  - Past their `expires_at`, or
  - Within 2 days of `expires_at`, or
  - Have been active for more than `decay.check-interval-days` without a price drop
- **All Active Listings** (main table): Sorted by age descending. Columns: item thumbnail, title, platform, asking price, posted date, expiry date, days active, status.
- **Recently Sold / Cancelled** (collapsible section at bottom)

### 4. Renewal Flow

1. From the Renewal Queue, user clicks **Renew** on a listing card.
2. App calculates the suggested new price: `current_price * (1 - drop_percent)`, floored at `minimum_price`.
3. A modal shows the suggested price (editable) and asks the user to confirm.
4. On confirm, the listing's `asking_price` is updated. The existing generated fields are left as-is — the user can manually edit the description in the fields view if it references price or urgency.
5. User copies the updated fields, posts manually, then clicks **Mark as Posted** to reset `posted_at` and `expires_at`.
6. Old price is appended to the listing's `price-history` with reason "decay".

### 5. Mark as Sold / Cancel

- From the Item Detail or Dashboard, user can mark a listing as SOLD or CANCELLED.
- SOLD listings are excluded from renewal queue.
- If all listings for an item are SOLD or CANCELLED, the item is considered closed and moves to an archive view.

---

## LLM Integration

### Prompt Design

The system prompt instructs Claude to:
- Act as an expert reseller copywriter
- Analyze the provided photos and description
- Return only a valid JSON object (no markdown, no preamble)
- Fill every field in every requested platform profile

The user prompt includes:
- The raw description
- The list of platform profiles with their field specs (injected as JSON)
- A suggested price (Claude should use this as the listing price)
- Photos as base64 image blocks

### Response Format

```json
{
  "suggested_price": 85.00,
  "platforms": {
    "CRAIGSLIST": {
      "title": "...",
      "price": 85.00,
      "category": "furniture",
      "condition": "Good",
      "description": "..."
    },
    "FACEBOOK": {
      "title": "...",
      "price": 85.00,
      "category": "Home Goods",
      "condition": "Good",
      "description": "...",
      "availability": "Local pickup"
    }
  }
}
```

If any field cannot be determined from the provided information, Claude should make a reasonable inference and flag it with a `"_uncertain": true` sibling key so the UI can highlight it for user review.

### Error Handling

- If the Claude API call fails, surface the error in the UI and allow the user to retry without re-uploading photos.
- If the returned JSON fails to parse, show the raw response in a debug panel and allow the user to manually correct and save fields.

---

## Photo Handling

- Photos are stored under `data/photos/{item-id}/`, with originals in `original/` and LLM-submission copies in `resized/`.
- Original files are preserved. A resized copy (max 1024px on longest side, JPEG quality 85) is generated for LLM submission to reduce token cost.
- The UI displays photos in an ordered list with drag-to-reorder and individual delete.
- Photos are served via a static file route: `GET /photos/{item-id}/{filename}`.

---

## API Endpoints

All endpoints are under `/api/v1`.

### Items
- `POST /items` — create item, upload photos (multipart)
- `GET /items` — list all items (with summary of listing statuses)
- `GET /items/{id}` — item detail with all listings
- `PATCH /items/{id}` — update raw description or minimum price
- `DELETE /items/{id}` — soft delete (archive)

### Listings
- `POST /items/{id}/generate` — trigger LLM generation for selected platforms
- `PATCH /listings/{id}` — update any listing fields (generated_fields, asking_price, status, notes, etc.)
- `POST /listings/{id}/mark-posted` — set status ACTIVE, record posted_at / expires_at / external_id
- `POST /listings/{id}/renew` — update asking price (apply decay or manual override), append to price-history; does not call LLM
- `POST /listings/{id}/mark-sold` — set status SOLD
- `POST /listings/{id}/cancel` — set status CANCELLED

### Photos
- `POST /items/{id}/photos` — upload additional photos
- `DELETE /items/{id}/photos/{filename}` — remove a photo
- `PATCH /items/{id}/photos/order` — reorder photos

### Dashboard
- `GET /dashboard` — returns renewal queue + active listings summary

### Config
- `GET /config/platforms` — returns all platform profiles
- `GET /config/decay` — returns current decay config

> Config changes (port, decay settings, API key) are made by editing the YAML files directly and restarting the app.

---

## UI Pages

| Route | Description |
|---|---|
| `/` | Dashboard |
| `/items/new` | New item form |
| `/items/{id}` | Item detail with platform tabs |
| `/items/{id}/edit` | Edit description / photos / minimum price |
| `/archive` | Closed items (all listings SOLD or CANCELLED) |

---

## Non-Functional Requirements

- **Single-user**: no authentication, no multi-tenancy. The app assumes it is accessible only on a local network.
- **Resilient to API outages**: all generated data is persisted immediately; API failures do not lose work.
- **No external dependencies at runtime** beyond the Anthropic API: no Redis, no message queues, no separate services.
- **Portable**: the entire app state can be backed up by copying the `data/` directory. No database to dump, no migrations to run.

---

## Out of Scope

- Automated posting to any platform (all posting is manual copy-paste)
- Buyer messaging or inquiry management
- Authentication / user accounts
- Mobile app (browser on phone accessing the local web UI is sufficient)
- Analytics or sales reporting beyond basic status tracking
