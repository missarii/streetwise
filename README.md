# Streetwise

Colombo city maintenance map. Citizens report problems, AI classifies each one, staff review edge cases, the public watches the city get fixed.

**Live:** https://streetwise.orangeuni.workers.dev

---

## Logins for marking

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@streetwise.mark` | `Streetwise#Admin2026` |
| Staff | `staff@streetwise.mark` | `Streetwise#Staff2026` |

Admin has access to zones, settings, and audit log in addition to the review queue.

---

## How to run it locally

### Prerequisites

- Node.js 18 or above
- npm (bundled with Node)
- A Cloudflare account (free tier is enough)
- Wrangler CLI (`npx wrangler --version` to confirm)

### 1. Clone and install

```bash
git clone https://github.com/missarii/streetwise.git
cd streetwise
npm install
```

### 2. Create a local secrets file

```bash
echo 'JWT_SECRET=any-string-at-least-32-characters-long' > .dev.vars
```

This file is git-ignored and only used by `wrangler dev`.

### 3. Create and seed the local database

```bash
npm run db:migrate:local
```

This runs three SQL files in order:
- `0001_init.sql` — creates all tables and indexes
- `0002_seed.sql` — loads the 6 Colombo zones, default settings, and the two marking accounts
- `0003_past_reports.sql` — loads 240 historical reports so the map is not empty

### 4. Start the server

```bash
npm run dev
```

Open `http://localhost:8787`.

> The Workers AI binding calls Cloudflare's real network even in local mode. Because this is not available in offline dev, the triage fallback runs instead. Every report will be classified by keyword rules and sent to `needs_review`. This is the correct and expected behaviour for local development. The full AI pipeline runs at the live Cloudflare URL.

---

## How to deploy it from nothing

Starting from a fresh Cloudflare account with no existing Workers or D1 databases.

### 1. Log in to Cloudflare

```bash
npx wrangler login
wrangler whoami   # confirm
```

### 2. Create the D1 database

```bash
npm run db:create
```

The output includes a line like:

```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Open `wrangler.toml` and paste that ID into the `database_id` field under `[[d1_databases]]`.

### 3. Set the JWT secret

```bash
wrangler secret put JWT_SECRET
```

When prompted, enter a random string of at least 64 characters. You can generate one with:

```bash
openssl rand -base64 64
```

### 4. Run the production migrations

```bash
npm run db:migrate:remote
```

Three prompts will appear, one per migration file. Confirm each with `Y`. After this the database contains the schema, zones, marking accounts, settings, and 240 past reports.

### 5. Deploy

```bash
wrangler deploy
```

The live URL is printed at the end. The app is fully operational immediately.

---

## Decisions I took and why

**Hono over a minimal router.** Hono gives typed bindings, middleware composition, and a file-per-route structure that is easy to review. The bundle overhead is negligible.

**Ray-casting point-in-polygon, not Turf.js.** The 6 Colombo zones are simple polygons with five or six points each. Ray casting is 20 lines of code, no external dependency, no `Buffer` polyfill needed in the Workers runtime, and I can read and test every line. Turf adds 150 KB and has Node.js assumptions I would have to polyfill.

**Keyword fallback that always returns a result.** Workers AI can time out, return garbled JSON, or be unavailable. The fallback ensures no report is ever lost. It sets `confidence = 0.55`, which is below the 0.70 threshold, so the routing rules always send fallback results to staff review. A human corrects the classification; the report is never silently dropped.

**Deterministic routing rules on top of the AI.** The AI is not trusted to make the routing decision. Three rules always run after the model responds, regardless of what it returns: `not_relevant` type rejects the report, priority ≥ 4 sends it to staff review, confidence < 0.70 sends it to staff review. This means a miscalibrated model cannot bypass the review step for high-risk reports.

**bcryptjs not bcrypt.** The `bcrypt` package uses native Node.js crypto bindings that do not exist in the Workers runtime. `bcryptjs` is a pure-JavaScript implementation that works everywhere. I found this by running `wrangler dev` and seeing the startup error before switching.

**HTML bundled by wrangler, not served from R2.** The free plan has no R2 quota for the demo period. Wrangler bundles the HTML at deploy time via `import ... with { type: 'text' }`. The total bundle is 184 KB gzipped, which is well within the 1 MB Worker size limit and serves fast from the edge.

**Base64 photos stored in D1.** The free plan has no R2. D1 has a roughly 1 MB per-row limit on the free tier, which caps photos at approximately 700 KB. This is a known limitation documented below. The server validates photo size before storage so that oversized photos get a clear error rather than a silent database failure.

**Per-IP rate limiting backed by D1.** Workers does not have a built-in rate limiter on the free tier. A D1 table with sliding-window counters is sufficient for the expected load and does not require Durable Objects.

---

## Accuracy

Measured against `data/labelled-reports.json`, which contains 40 reports with expert-assigned type and priority labels.

### Keyword fallback (runs when AI is unavailable)

| Metric | Score |
|--------|-------|
| Type | 37 / 40 = **93%** |
| Priority | 23 / 40 = **58%** |

All fallback results have `confidence = 0.55`, which is below the 0.70 threshold, so all 40 are routed to `needs_review`. Priority accuracy of the fallback is conservative by design — human review corrects the gaps.

To reproduce:

```bash
npm run accuracy
```

---

## 3 reports it gets wrong and why

### 1. r-0112 — "Lights very dim on the railway underpass, hard to see the steps"

**Expected:** `type = street_light`, `priority = 3`
**Got:** `type = street_light`, `priority = 2`

The type is correct. The priority fails because the fallback assigns `priority = 2` as the default for street lights. "Railway underpass" is a high-traffic enclosed space where dim lighting is a fall risk, but the keyword list has no term for enclosed pedestrian routes. Adding `underpass`, `tunnel`, `flyover`, and `subway` to the sensitive-places list raises this to 3 correctly.

### 2. r-0119 — "Bridge railing missing a section over the canal, a drop of 3 metres"

**Expected:** `type = pothole`, `priority = 5`
**Got:** `type = pothole`, `priority = 2`

The type is correct (`bridge`, `railing`, `missing` all match the pothole list). The priority fails completely. A 3-metre drop into a canal is a life-threatening hazard, but the keywords `missing section`, `drop of`, and the number `3 metres` are not in the danger list. The model (when available) catches this correctly because it understands context. The fix for the fallback is to add `missing section`, `drop`, `metres deep`, and `fell into` to the P5 escalation list.

### 3. r-0122 — "Market bins overflowing into the drain"

**Expected:** `type = rubbish`, `priority = 3`
**Got:** `type = flooding`, `priority = 4`

Both type and priority are wrong. The text contains both `bin` (rubbish) and `drain` (flooding). The flooding list scores two matches because `overflow` and `drain` both appear, while the rubbish list scores one match for `bin`. The tie-breaking logic picks flooding. The AI model reads the sentence structure and understands that rubbish is the subject and the drain is just where it is going — it classifies correctly. The fallback fix is to check for `bin` or `waste` as a tiebreaker when flooding and rubbish scores are close.

---

## What is missing

| Item | Detail |
|------|--------|
| Photo storage above 700 KB | D1 has a ~1 MB row limit on the free plan. In production, photos would be uploaded to R2 and stored by URL, not base64. |
| Real-time map updates | The map polls every 30 seconds. Durable Objects with WebSockets would push updates immediately. |
| 30-day trend chart | The `/api/stats` endpoint returns daily series data, but the chart component on the public map is not rendered yet. |
| Replay time slider | Bonus feature listed in the spec. Not built. |
| Weekly AI summary | Bonus feature listed in the spec. Not built. |
| Forecast heat map | Bonus feature listed in the spec. Not built. |
| Email and SMS notifications | Citizens track their report via the follow link. No outbound notification channel is wired up. |
| GitHub Actions CI/CD | Deployment is manual via `wrangler deploy`. A workflow that runs tests and deploys on push to `main` is not configured. |
