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

## ~~Slice 3 — Photo upload and serving~~ ✅ DONE

**Goal:** Upload photos with an item; view them on the item detail page.

**Completed:** `Item` model gains `photos: List<String>`. `ItemRepository` adds `addPhoto` (saves original + JPEG-resized copy via `javax.imageio`), `deletePhoto`, `reorderPhotos`, `getResizedPhotoFile`. `POST /api/v1/items` changed to multipart (fields + file parts). New routes: `POST /api/v1/items/{id}/photos`, `DELETE /api/v1/items/{id}/photos/{filename}`, `PATCH /api/v1/items/{id}/photos/order`. `GET /photos/{itemId}/{filename}` serves from `data/photos/{itemId}/resized/`. Frontend: `NewItem` sends `FormData` with file picker (max 10, 10 MB, JPEG/PNG). `ItemDetail` shows `PhotoStrip` (HTML5 drag-to-reorder, delete button) and `AddPhotos` uploader. `PhotoOrderRequest` added to models.

**Notes:**
- Image resizing uses pure JDK (`java.awt` + `javax.imageio`); no extra library needed.
- All resized copies stored as JPEG (quality 0.85, max 1024px). Original preserved as-is.
- `streamProvider` is deprecated in Ktor 3.x; suppressed with `@Suppress("DEPRECATION")` — acceptable until Ktor provides a stable `provider()` + kotlinx-io replacement.
- No new Gradle dependencies required for multipart or image processing.

---

## ~~Slice 4 — LLM generation~~ ✅ DONE

**Goal:** Call Claude API to generate listing fields; store results as DRAFT listings.

**Completed:** `ClaudeClient.kt` (new file) builds a multimodal prompt (system prompt + description + platform profiles JSON + base64 resized photos), calls `claude-sonnet-4-20250514`, strips markdown code fences from response, parses JSON. `ClaudeApiException` and `ClaudeParseException` defined. `GenerateRequest` model added to `ItemModels.kt`. `ItemRepository.addGeneratedListing` upserts a DRAFT `Listing` by platform ID. `POST /api/v1/items/{id}/generate` route added to `ItemRoutes.kt` — returns 502 on API error, 422 with `rawResponse` on parse error. `Application.kt` wires `ClaudeClient` from secrets, closes HTTP client on shutdown. `build.gradle.kts` adds `ktor-client-core` and `ktor-client-cio`. Frontend: `types.ts` gains `FieldSpec` and `PlatformProfile` interfaces; `NewItem.tsx` loads platforms from `/api/v1/config/platforms`, shows checkboxes (all pre-checked), runs generate after item creation, shows phase-aware button text, and displays an error banner with a retry button if generation fails.

**Notes:**
- Uncertain fields stored as `fieldname_uncertain: "true"` alongside normal fields in `generatedFields` map.
- `suggestedPrice` from LLM is stored on the `Listing` object directly.
- Item creation flow uses three phases: `idle → creating → generating → (navigate or error)`.
- If no platforms are selected, item is created and navigation happens without calling generate.
- Manual test steps (not yet run): create item with photos + platforms, verify DRAFT listings in YAML; test bad-API-key error path.

---

## ~~Slice 5 — Item detail: editable platform tabs~~ ✅ DONE

**Goal:** View and edit generated listings per platform; copy individual fields or all fields.

**Completed:** `PatchListingRequest` model added to `ItemModels.kt`. `ItemRepository.updateListing` searches all items for the listing ID and saves updated fields/price/notes. `PATCH /api/v1/listings/{listingId}` route added to `ItemRoutes.kt` (returns updated `Listing`). Frontend `ItemDetail.tsx` replaced JSON dump with: sidebar photos (column layout), tabbed listings (one tab per platform using `platform.label`), `ListingTab` component with per-field inputs typed by `FieldSpec.type` (text/number/textarea/select), yellow "uncertain" badge + background for `_uncertain` fields, per-field Copy button, Copy All button (formats as "Label: value\n…"), auto-save on blur (or onChange for select), asking price + notes inputs. Blur handlers use refs to avoid stale-closure bugs.

**Notes:**
- Listings are stored inside item YAML; `updateListing` scans all items to find the listing by ID.
- `PatchListingRequest.generatedFields` replaces the entire map on save (frontend always sends full map).
- Uncertain-field metadata keys (`fieldName_uncertain`) are excluded from display; only `PlatformProfile.fields` specs drive the rendered field list.
- `key={listings[activeTab].id}` causes `ListingTab` to remount on tab switch, so unsaved edits on another tab are lost — auto-save on blur mitigates this.

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
