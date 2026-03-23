# Implementation Plan — Listing Manager

Vertical slices ordered so each step is independently runnable and testable.

---

## ~~Slice 0 — Skeleton: "Hello World" full-stack~~ ✅ DONE

**Goal:** Prove the build pipeline works end-to-end before writing any real logic.

**Completed:** Gradle + Ktor (Netty) backend, React/Vite/TypeScript frontend, `npmBuild` + `copyFrontend` Gradle tasks, `/api/v1/health` route, static file serving. Smoke-tested: health endpoint returns `{"status":"ok"}`, `/` serves the React HTML shell.

**Notes:**
- Package: `net.nebupookins.sellyourshit`
- JDK 26 installed; Kotlin compiled with `jvmTarget = JVM_23` via toolchain to avoid mismatch.
- Netty emits `sun.misc.Unsafe` warnings on JDK 26 — harmless, ignore for now.

---

## ~~Slice 1 — Config loading~~ ✅ DONE

**Goal:** App reads `data/config/config.yaml` and `data/secrets.yaml` on startup; exposes platform profiles via API.

**Completed:** `ConfigModels.kt` defines `AppConfig`, `DecayConfig`, `SecretsConfig`, `PlatformProfile`, `FieldSpec`. `ConfigLoader.kt` loads YAML via kaml on startup; crashes with clear message if files missing. 6 platform YAML files written under `data/platforms/` (craigslist, facebook, kijiji, offerup, ebay, nextdoor). `GET /api/v1/config/platforms` and `GET /api/v1/config/decay` routes added. `Application.kt` updated to read port from config. `App.tsx` gains a collapsible `PlatformsDebug` dev-only component.

**Notes:**
- `data/config/secrets.yaml` is gitignored-by-convention; placeholder file created with `sk-ant-REPLACE-WITH-YOUR-KEY`.
- Port is now read from `data/config/config.yaml` (default 45966).
- Run: `gradle run` (not `./gradlew run`) on this machine.

---

## ~~Slice 2 — Item CRUD (no photos, no LLM)~~ ✅ DONE

**Goal:** Create, list, and view items stored as YAML files. No photos or LLM yet.

**Completed:** `ItemModels.kt` defines `Item`, `Listing`, `ListingStatus`, `PriceHistoryEntry`, `CreateItemRequest`, `PatchItemRequest`. `ItemRepository.kt` reads/writes `data/items/{id}.yaml` using write-to-temp-then-rename; uses kaml for YAML. `ItemRoutes.kt` registers POST/GET/GET:id/PATCH/DELETE under `/api/v1/items`. `Application.kt` updated to pass `dataDir` to `module()` and wire `ItemRepository`. Frontend: `react-router-dom` installed; `BrowserRouter` wraps app; `App.tsx` uses `<Routes>`; `ItemList`, `NewItem`, `ItemDetail` pages created; `types.ts` defines TypeScript interfaces.

**Notes:**
- Item YAML uses camelCase keys (no kebab-case) so same model class works for both YAML storage and JSON API.
- `GET /api/v1/items` returns all items including archived; frontend filters `archivedAt != null` client-side.
- `/items/:id` shows pretty-printed raw JSON for now (upgraded in Slice 5).

---

## Slice 3 — Photo upload and serving

**Goal:** Upload photos with an item; view them on the item detail page.

### Backend
- `POST /api/v1/items` — extend to accept multipart (description + photos); save originals to `data/photos/{id}/original/`.
- Generate resized copies (max 1024px, JPEG 85) using a pure-Kotlin/JVM image library (e.g. `java.awt.Image` + ImageIO or `scrimage`). Save to `data/photos/{id}/resized/`.
- `GET /photos/{itemId}/{filename}` — serve photo files statically.
- `POST /api/v1/items/{id}/photos` — upload additional photos.
- `DELETE /api/v1/items/{id}/photos/{filename}` — delete a photo.
- `PATCH /api/v1/items/{id}/photos/order` — reorder photo list in item YAML.

### Frontend
- `/items/new` — add file picker (multi, JPEG/PNG, max 10, 10 MB each); submit as multipart.
- `/items/:id` — show photo thumbnails (served from `/photos/...`) in a horizontal strip with delete buttons.
- Add drag-to-reorder on the photo strip (react-beautiful-dnd or similar).

### Test
- Create item with 2–3 photos; verify files appear in `data/photos/{id}/original/` and `resized/`.
- View item page; thumbnails render.
- Delete a photo; confirm it disappears from UI and filesystem.
- Reorder; confirm YAML reflects new order.

---

## Slice 4 — LLM generation

**Goal:** Call Claude API to generate listing fields; store results as DRAFT listings.

### Backend
- `ClaudeClient`: builds the multimodal prompt (system prompt + description + platform profiles JSON + base64 resized photos), calls `claude-sonnet-4-20250514`, parses response JSON.
- Handle `_uncertain` flags in parsed fields.
- `POST /api/v1/items/{id}/generate` — accepts `{platforms: ["CRAIGSLIST","FACEBOOK",...]}`.
  - Calls `ClaudeClient`.
  - On success: upsert one DRAFT `Listing` per platform into the item file.
  - On API error: return 502 with error details (do not lose existing data).
  - On JSON parse error: return 422 with raw response in body.
- Expose `suggestedPrice` from LLM response in the listing.

### Frontend
- `/items/new` — add platform multi-select checkboxes (all checked by default); show "Generate" button.
- After item is created (POST `/api/v1/items`), immediately POST `/api/v1/items/{id}/generate`; show a spinner.
- On success: navigate to `/items/:id`.
- On error: show error banner with retry button (re-POSTs generate without re-uploading photos).

### Test
- Create item with description + photos + platforms selected.
- Spinner appears; after ~5s, redirected to item detail.
- Item YAML contains one DRAFT listing per selected platform with generated fields.
- Test error path: temporarily use a bad API key; error banner appears with retry.

---

## Slice 5 — Item detail: editable platform tabs

**Goal:** View and edit generated listings per platform; copy individual fields or all fields.

### Backend
- `PATCH /api/v1/listings/{listingId}` — update any subset of `generatedFields`, `askingPrice`, `notes`.

### Frontend
- `/items/:id` — replace JSON dump with tabbed UI (one tab per listing).
- Each tab renders generated fields as labeled inputs (text, number, textarea for multiline, select for enum).
- Uncertain fields (`_uncertain: true`) rendered with a yellow highlight.
- Each field has a **Copy** button (copies field value to clipboard).
- **Copy All** button formats all fields as "FieldLabel: value\n..." and copies.
- On blur of any input, auto-save via PATCH `/api/v1/listings/{id}`.
- Show photo thumbnails in a sidebar.

### Test
- Open item; tabs appear for each platform.
- Edit a field; blur; refresh page — edit persisted.
- Click Copy on a field; paste elsewhere → correct value.
- Click Copy All; paste → formatted block with all fields.

---

## Slice 6 — Mark as Posted modal

**Goal:** Transition a listing from DRAFT to ACTIVE.

### Backend
- `POST /api/v1/listings/{id}/mark-posted` — accepts `{postedAt, expiresAt, externalId?}`; sets status ACTIVE.

### Frontend
- On each listing tab, show **Mark as Posted** button (visible when status is DRAFT).
- Clicking opens a modal with:
  - Posted date (date picker, default today).
  - Expiry date (date picker).
  - External listing URL (optional text input).
- On submit, POST `/api/v1/listings/{id}/mark-posted`; refresh tab; button replaced by status badge "ACTIVE".

### Test
- Mark a listing as posted; YAML shows `status: ACTIVE`, `posted-at`, `expires-at`.
- Refresh page; tab shows ACTIVE badge.

---

## Slice 7 — Dashboard

**Goal:** Landing page with renewal queue and active listings table.

### Backend
- `GET /api/v1/dashboard` — reads all item files, computes:
  - **Renewal queue**: ACTIVE listings where `expiresAt` is past, within 2 days, or days-since-last-price-drop ≥ `checkIntervalDays`.
  - **Active listings**: all ACTIVE listings sorted by `postedAt` desc.
  - **Closed items**: items where all listings are SOLD or CANCELLED.
- Returns three arrays.

### Frontend
- `/` — renders three sections:
  - **Renewal Queue**: cards showing item thumbnail, title, platform, current price, days active, reason flagged.
  - **All Active Listings**: table with columns from spec.
  - **Recently Sold/Cancelled**: collapsible section.

### Test
- Create an item, mark one listing as posted with an expiry yesterday.
- Dashboard shows that listing in the renewal queue.
- Active listings table shows other ACTIVE listings.

---

## Slice 8 — Renewal flow

**Goal:** User can renew a listing with a decayed price from the dashboard.

### Backend
- `POST /api/v1/listings/{id}/renew` — accepts optional `{newPrice}`; otherwise calculates `currentPrice * (1 - dropPercent)`, floor at `minimumPrice`; updates `askingPrice`; appends to `priceHistory` with reason "decay".

### Frontend
- Renewal Queue cards get a **Renew** button.
- Clicking opens a modal: "Suggested price: $X" (editable input) + Confirm button.
- On confirm, POST `/api/v1/listings/{id}/renew`; refresh dashboard.
- After renewing, user is prompted to copy and re-post — the Mark as Posted flow from Slice 6 handles the reset.

### Test
- From dashboard, click Renew on a queued listing.
- Modal shows calculated price.
- Confirm; YAML shows updated `askingPrice` and new entry in `priceHistory`.

---

## Slice 9 — Mark as Sold / Cancel + Archive

**Goal:** Close listings and archive fully-closed items.

### Backend
- `POST /api/v1/listings/{id}/mark-sold` — set status SOLD.
- `POST /api/v1/listings/{id}/cancel` — set status CANCELLED.
- Update `GET /api/v1/items` to include an `archived` flag for items where all listings are SOLD or CANCELLED.
- `GET /archive` page data already covered by dashboard endpoint (closed items section).

### Frontend
- Item detail tab: add **Mark as Sold** and **Cancel** buttons (with confirmation dialog).
- Dashboard: sold/cancelled items appear in collapsible section.
- `/archive` route: list of archived items, each linking to its detail page (read-only view).

### Test
- Mark all listings for an item as sold; item disappears from active list, appears in archive.
- Cancel a single listing; others remain active.

---

## Slice 10 — Polish and edge cases

**Goal:** Harden the app for real use.

- Photo validation: enforce 10-photo limit, 10 MB per file, JPEG/PNG only — in both backend and frontend.
- Error states: show toast notifications for failed saves (auto-save in Slice 5).
- Loading states: skeleton loaders on list/detail pages.
- Responsive layout: ensure usable on a phone browser.
- Decay scheduler: add a Kotlin coroutine loop at startup that logs (but does not act) when decay is due — dashboard already surfaces the queue; this is just a log reminder.
- Confirm `DELETE /api/v1/items/{id}` soft-deletes correctly and item no longer appears in lists.
- Write a brief `data/config/config.yaml.example` and `data/secrets.yaml.example` for first-time setup.

---

## Development conventions

- **Backend tests**: use Ktor test engine (`testApplication {}`) for route tests; use real temp directories for file I/O tests.
- **Frontend tests**: Vitest + React Testing Library for unit/component tests.
- **No mock DB**: file I/O tests write to `System.getProperty("java.io.tmpdir")`.
- **Commit discipline**: one commit per slice completion.
