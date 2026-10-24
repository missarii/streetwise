# 🗺️ Streetwise — Colombo City Maintenance Map

<div align="center">

![Streetwise Banner](https://img.shields.io/badge/Streetwise-Colombo%20City%20Maintenance-00b4d8?style=for-the-badge&logo=cloudflare&logoColor=white)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Cloudflare%20Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://streetwise.orangeuni.workers.dev)
[![Tests](https://img.shields.io/badge/Tests-57%20Passed-10b981?style=for-the-badge&logo=vitest&logoColor=white)](#run-tests)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Deployed%20On-Cloudflare%20Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

</div>

---

## 🎯 What is Streetwise?

**Streetwise** is a real-time city maintenance transparency platform for **Colombo, Sri Lanka**. It bridges the gap between citizens who spot urban problems and the municipal crews who fix them.

**The problem it solves:** Colombo residents currently have no reliable way to report infrastructure issues (potholes, flooding, broken street lights, rubbish dumps) and have zero visibility into whether anything was done about it. Reports go into a black hole.

**How Streetwise fixes this:**
1. A citizen photographs a pothole and submits a quick report from their phone
2. **Cloudflare Workers AI** (LLaMA 3.1-8B) instantly classifies the type, estimates danger level, and assigns the correct city zone
3. **Deterministic routing rules** decide: publish immediately, send to staff review, or reject
4. **Staff** review edge cases, approve/reject/merge, and update progress
5. The **public map** updates in real time — citizens watch the city get fixed
6. The citizen gets a **private follow link** to track their specific report from submission to resolution

Built in **96 hours** as the Dynarq Systems engineering assessment.

---

## 🌐 Live URL

| | URL |
|---|---|
| 🌍 **Public Map** | **https://streetwise.orangeuni.workers.dev/** |
| 📝 Report a problem | https://streetwise.orangeuni.workers.dev/report |
| 🔍 Track your report | https://streetwise.orangeuni.workers.dev/follow?id=…&token=… |
| 🔐 Staff portal | https://streetwise.orangeuni.workers.dev/staff/login |

---

## 🔐 Marking Credentials

> Use these to sign in at `/staff/login`

| Role | Email | Password | Access |
|------|-------|----------|--------|
| **Admin** | `admin@streetwise.mark` | `Streetwise#Admin2026` | Full access: queue, zones, settings, audit log |
| **Staff** | `staff@streetwise.mark` | `Streetwise#Staff2026` | Review queue and report actions only |

---

## ✨ Features

### 🌍 Public-facing
| Feature | Description |
|---------|-------------|
| **Interactive dark map** | MapLibre GL + OpenFreeMap tiles, Colombo centred, no API key required |
| **Live report pins** | Colour-coded by type (🕳️ pothole, 💧 flooding, 💡 street light, 🗑️ rubbish) |
| **Cluster badges** | Dense areas cluster automatically with count badges |
| **Live stats** | Open reports, fixed in last 30 days, total fixed — updates without reload |
| **Zone overlay** | 6 Colombo maintenance zones shown on the map |
| **Report submission** | 3-step form: describe → pin location → optional photo |
| **Photo upload** | JPEG/PNG up to 5 MB, validated server-side |
| **Private follow link** | Unique token per report — only you can see your report's full timeline |
| **Status timeline** | Every status change shown with timestamp on the follow page |

### 🤖 AI Triage Pipeline
| Feature | Description |
|---------|-------------|
| **Workers AI classification** | LLaMA 3.1-8B classifies type, size, priority (1–5), confidence, and reason |
| **Structured JSON extraction** | Prompt engineered to return JSON; parser handles model preamble |
| **8-second timeout + 1 retry** | AI calls never block the request; fallback fires automatically |
| **Keyword fallback** | If AI fails: keyword rules classify type with 93% accuracy |
| **Zone assignment** | Ray-casting point-in-polygon; nearest-centroid fallback for out-of-bounds |
| **Deterministic routing rules** | Override AI: `not_relevant`→reject, priority≥4→review, confidence<0.7→review |
| **Open triage contract** | `POST /api/triage` is a public endpoint — third parties can call it |

### 👮 Staff Portal
| Feature | Description |
|---------|-------------|
| **Review queue** | All `needs_review` reports sorted by priority, with age and zone |
| **Duplicate detection** | Same-type reports within 200 m shown as possible duplicates |
| **Approve** | Publishes a report to the public map |
| **Reject** | Removes from queue with reason (logged to audit) |
| **Merge** | Links a duplicate to an existing report |
| **Edit** | Change type, priority, or status in-line |
| **Zone management** | Pause/unpause any of the 6 zones with reason and end-date |
| **Live settings** | Change routing thresholds and AI timeout — no redeploy required |
| **Audit log** | Every change to every report, actor, field, old→new value, timestamp |

### 🔒 Security
| Feature | Description |
|---------|-------------|
| **JWT authentication** | HMAC-SHA256, Workers-native Web Crypto API, no polyfills |
| **HttpOnly cookies** | Session cookie invisible to JavaScript, SameSite=Strict, Secure |
| **bcrypt passwords** | Cost 12, constant-time comparison, pure-JS (bcryptjs) |
| **Rate limiting** | Per-IP sliding window: reports 10/hr, triage 20/hr, login 5/15 min |
| **Input validation** | All inputs through Zod schemas before any DB write |
| **SQL injection proof** | Every query uses D1 prepared statements |

---

## 🛠️ Technologies Used

### Core Runtime
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Cloudflare Workers** | V8 isolates | Serverless runtime — zero cold starts, global edge |
| **Cloudflare D1** | SQLite | Relational database — reports, zones, audit log, settings |
| **Cloudflare Workers AI** | LLaMA 3.1-8B | Report classification and triage |
| **Hono.js** | ^4 | Lightweight typed HTTP router for Cloudflare Workers |

### Language & Validation
| Technology | Version | Purpose |
|-----------|---------|---------|
| **TypeScript** | ^5 | Strict mode, full type safety end-to-end |
| **Zod** | ^3 | Runtime schema validation for all API inputs |
| **bcryptjs** | ^2 | Password hashing (pure JS, no native deps) |

### Frontend
| Technology | Purpose |
|-----------|---------|
| **MapLibre GL JS** | WebGL-powered interactive map |
| **OpenFreeMap** | Free dark map tiles (no API key) |
| **Vanilla HTML/CSS/JS** | No framework overhead — HTML bundled by wrangler at deploy |
| **Inter (Google Fonts)** | Premium typography |

### Testing & Tooling
| Technology | Purpose |
|-----------|---------|
| **Vitest** | Fast unit test runner (57 tests) |
| **Wrangler CLI** | Cloudflare Workers build, dev server, and deploy |
| **tsx** | TypeScript execution for scripts |

### Cryptography
| Technology | Purpose |
|-----------|---------|
| **Web Crypto API** | HMAC-SHA256 JWT signing and verification — Workers native |

---

## 💻 Run on Localhost

### Requirements
- Node.js 18+ — `node --version`
- npm — `npm --version`
- Cloudflare account (free) + logged-in wrangler

### Quick start

```bash
# 1. Clone
git clone https://github.com/missarii/streetwise.git
cd streetwise

# 2. Install
npm install

# 3. Create local secrets file
echo 'JWT_SECRET=any-local-dev-secret-minimum-32-chars-here' > .dev.vars

# 4. Create & seed the local database
npm run db:migrate:local

# 5. Start dev server
npm run dev
```

Open **http://localhost:8787** — the full app is running locally.

> ℹ️ **Local AI note:** Workers AI always calls Cloudflare's network — it is not available offline. In local mode, all reports use the keyword-based fallback triage (`confidence=0.55`), which correctly routes everything to `needs_review`. This is expected. The live AI pipeline runs at the Cloudflare URL.

### npm scripts

```bash
npm run dev                  # Local dev server → http://localhost:8787
npm test                     # Run all 57 unit tests
npm run test:watch           # Tests in watch mode
npm run db:migrate:local     # Apply all 3 SQL migrations locally
npm run db:migrate:remote    # Apply migrations to production D1
npm run db:create            # Create a new D1 database on Cloudflare
npm run accuracy             # Measure triage accuracy against 40 labelled reports
wrangler deploy              # Build and deploy to Cloudflare
```

---

## 🚀 Deploy from Scratch

```bash
# 1. Log in to Cloudflare
wrangler login

# 2. Create D1 database
npm run db:create
# Copy the database_id into wrangler.toml → database_id = "…"

# 3. Set JWT secret (production)
wrangler secret put JWT_SECRET
# Enter: openssl rand -base64 64

# 4. Apply migrations to production
npm run db:migrate:remote
# Confirm each of the 3 prompts with Y

# 5. Deploy
wrangler deploy
# → https://streetwise.YOUR-SUBDOMAIN.workers.dev
```

---

## 🧪 Tests

```bash
npm test
```

```
 ✓ tests/rules.test.ts      (13 tests)  Routing rules — all combinations + boundary values
 ✓ tests/fallback.test.ts   (14 tests)  Keyword triage — type detection + priority escalation
 ✓ tests/validation.test.ts (21 tests)  Input schemas — text length, lat/lng, photo type/size
 ✓ tests/roles.test.ts       (9 tests)  JWT — sign, verify, tamper, expiry, role gates

 Test Files  4 passed (4)
      Tests 57 passed (57)
   Duration  ~900ms
```

---

## 📊 Triage Accuracy

Measured against `data/labelled-reports.json` (40 expert-labelled Colombo reports):

| Mode | Type Accuracy | Priority Accuracy |
|------|:---:|:---:|
| **Keyword fallback** | **93%** (37/40) | **58%** (23/40) |
| **Workers AI (LLaMA 3.1-8B)** | Higher (live) | Higher (live) |

> All fallback results have `confidence=0.55`, routing them to `needs_review` for human correction. The conservative priority accuracy is by design — staff review catches the gaps.

---

## 📐 Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     Cloudflare Edge (APAC)                         │
│                                                                    │
│  ┌──────────────┐    ┌─────────────────────────────────────────┐  │
│  │   Browser    │────│           Cloudflare Worker              │  │
│  │              │    │                                         │  │
│  │  MapLibre GL │    │  Hono Router                            │  │
│  │  HTML pages  │    │  ├── GET /                              │  │
│  │              │    │  ├── POST /api/reports  ──► AI Triage   │  │
│  └──────────────┘    │  │                          │           │  │
│                      │  │                    ┌─────┴──────┐    │  │
│                      │  │                    │ Workers AI │    │  │
│                      │  │                    │ LLaMA 3.1  │    │  │
│                      │  │                    │   8B-instr │    │  │
│                      │  │                    └─────┬──────┘    │  │
│                      │  │                          │           │  │
│                      │  │                    ┌─────▼──────┐    │  │
│                      │  │                    │  Routing   │    │  │
│                      │  │                    │   Rules    │    │  │
│                      │  │                    └─────┬──────┘    │  │
│                      │  │                          │           │  │
│                      │  │  ├── Staff routes ◄──────┘           │  │
│                      │  │  │   Auth / Queue / Review            │  │
│                      │  │  │   Zones / Settings / Audit         │  │
│                      │  │  │                                   │  │
│                      │  └──┼───────────────────────────────────┘  │
│                      │     │                                       │
│                      │  ┌──▼──────────────────────────────────┐   │
│                      │  │         Cloudflare D1 (SQLite)       │   │
│                      │  │  reports · report_events · zones     │   │
│                      │  │  users · settings · rate_limits      │   │
│                      │  └─────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### Routing Rules (deterministic — override AI every time)

```
type == "not_relevant"  ──────────────────► reject
priority >= 4           ──────────────────► needs_approval (staff review)
confidence < 0.70       ──────────────────► needs_approval (staff review)
else                    ──────────────────► publish (visible on public map)
```

---

## 🗂️ Project Structure

```
streetwise/
├── 📄 wrangler.toml                 Cloudflare config (D1 + AI bindings)
├── 📄 package.json
├── 📄 tsconfig.json
├── 📄 vitest.config.ts
│
├── 📁 data/
│   ├── zones.json                   6 Colombo maintenance zone polygons
│   ├── labelled-reports.json        40 expert-labelled test reports
│   └── past-reports.json            240 seeded historical reports
│
├── 📁 src/
│   ├── index.ts                     Worker entry + Hono router
│   │
│   ├── 📁 middleware/
│   │   └── auth.ts                  JWT verify · requireAuth · requireAdmin
│   │
│   ├── 📁 routes/
│   │   ├── triage.ts                POST /api/triage
│   │   ├── reports.ts               GET/POST /api/reports + /follow
│   │   ├── stats.ts                 GET /api/stats
│   │   └── 📁 staff/
│   │       ├── auth.ts              Login / logout
│   │       ├── queue.ts             Review queue
│   │       ├── review.ts            Approve / reject / merge / edit
│   │       ├── zones.ts             Zone pause/unpause
│   │       ├── settings.ts          Live settings CRUD
│   │       └── audit.ts             Audit log
│   │
│   ├── 📁 services/
│   │   ├── auth.ts                  JWT sign/verify + bcrypt + cookies
│   │   ├── events.ts                Audit event logger
│   │   ├── rateLimit.ts             Per-IP sliding window (D1-backed)
│   │   └── 📁 triage/
│   │       ├── model.ts             Workers AI call + timeout + retry
│   │       ├── fallback.ts          Keyword fallback (always returns a result)
│   │       ├── rules.ts             Deterministic routing rules engine
│   │       └── zone.ts              Ray-casting point-in-polygon
│   │
│   ├── 📁 validators/
│   │   ├── report.ts                Zod — citizen report submission
│   │   └── triage.ts                Zod — /api/triage contract
│   │
│   ├── 📁 db/migrations/
│   │   ├── 0001_init.sql            Tables + indexes
│   │   ├── 0002_seed.sql            Zones + settings + marking users
│   │   └── 0003_past_reports.sql    240 historical reports
│   │
│   └── 📁 public/                   HTML pages (bundled by wrangler)
│       ├── index.html               Public map
│       ├── report.html              Citizen report form
│       ├── follow.html              Private status follow page
│       └── 📁 staff/
│           ├── login.html           Sign in
│           ├── queue.html           Review queue
│           ├── review.html          Report detail + actions
│           ├── zones.html           Zone management
│           ├── settings.html        Live settings
│           └── audit.html           Audit log
│
├── 📁 tests/
│   ├── rules.test.ts               (13 tests) Routing rules
│   ├── fallback.test.ts            (14 tests) Keyword triage
│   ├── validation.test.ts          (21 tests) Input schemas
│   └── roles.test.ts               (9 tests)  JWT + roles
│
└── 📁 scripts/
    ├── measure-accuracy.ts         Accuracy against labelled data (live API)
    └── check-accuracy.ts           Quick local accuracy check
```

---

## 🔌 API Reference

### `POST /api/triage` — AI Classification (Public)

Classify a report without persisting it. Third-party callable.

**Request:**
```json
{
  "id": "r-0412",
  "text": "Deep pothole by the bus stop, a scooter nearly fell",
  "lat": 6.9147,
  "lng": 79.873,
  "reported_at": "2026-10-27T08:14:00+05:30",
  "photo_url": null
}
```

**Response `200`:**
```json
{
  "id": "r-0412",
  "type": "pothole",
  "size": "medium",
  "priority": 4,
  "zone": "Z-03",
  "confidence": 0.87,
  "reason": "Scooter incident near bus stop indicates injury risk.",
  "route": "needs_approval",
  "triaged_by": "model"
}
```

### `POST /api/reports` — Submit Report (Public)
```json
// Request
{ "text": "...", "lat": 6.91, "lng": 79.87, "photo": "data:image/jpeg;base64,..." }

// Response 201
{ "id": "r-abc123", "follow_link": "https://…/follow?id=…&token=…", "status": "needs_review", "zone": "Z-03" }
```

### `GET /api/stats` — Public Counters
```json
{ "totals": { "open": 58, "fixed_30d": 182, "fixed_total": 182 }, "zones": [...] }
```

### Staff endpoints (JWT cookie required)

| Method | Path | Role | Action |
|--------|------|------|--------|
| `POST` | `/api/staff/login` | — | Get session cookie |
| `GET` | `/api/staff/queue` | Staff | Review queue |
| `POST` | `/api/staff/reports/:id/approve` | Staff | Publish report |
| `POST` | `/api/staff/reports/:id/reject` | Staff | Reject with reason |
| `POST` | `/api/staff/reports/:id/merge` | Staff | Merge duplicate |
| `PATCH` | `/api/staff/reports/:id` | Staff | Edit type/priority/status |
| `GET/PATCH` | `/api/staff/zones/:id` | Admin | Zone pause/unpause |
| `GET/PUT` | `/api/staff/settings` | Admin | Live configuration |
| `GET` | `/api/staff/audit` | Admin | Full audit log |

---

## 📋 Status

| Component | Status |
|-----------|--------|
| 🌍 Public map with live report pins | ✅ Complete |
| 📝 3-step citizen report form | ✅ Complete |
| 📸 Photo upload (JPEG/PNG, ≤5 MB) | ✅ Complete |
| 🔍 Private follow page + timeline | ✅ Complete |
| 🤖 Workers AI triage (LLaMA 3.1-8B) | ✅ Complete |
| 📋 Keyword fallback (93% type accuracy) | ✅ Complete |
| ⚖️ Deterministic routing rules | ✅ Complete |
| 🗺️ Zone assignment (ray-casting polygon) | ✅ Complete |
| 🔐 JWT authentication + bcrypt | ✅ Complete |
| 🛡️ Rate limiting (per-IP, D1-backed) | ✅ Complete |
| 📋 Staff review queue | ✅ Complete |
| ✅ Report approve / reject / merge / edit | ✅ Complete |
| 🗺️ Admin zone pause/unpause | ✅ Complete |
| ⚙️ Live settings (no redeploy) | ✅ Complete |
| 📜 Audit log (full event trail) | ✅ Complete |
| 🧪 57/57 unit tests passing | ✅ Complete |
| 🌐 Live on Cloudflare Workers | ✅ Live |
| 📄 AI.md (3 mistakes + 1 self-written) | ✅ Complete |
| ⏱️ Replay time slider | ⬜ Bonus — not built |
| 📊 Weekly AI summary | ⬜ Bonus — not built |
| 🔮 Forecast heat map | ⬜ Bonus — not built |

---

## ⚠️ Known Limitations

| Issue | Detail |
|-------|--------|
| Photo storage limit | Base64 in D1; rows capped ~700 KB on free plan. Production would use R2. |
| AI in local mode | Workers AI calls the real network — offline dev uses keyword fallback. |
| Real-time push | Map polls every 30 s. Durable Objects would enable WebSocket push. |
| 30-day chart | Series data returned by `/api/stats` but chart UI not yet rendered. |
| Email notifications | Citizens use the follow link; no email/SMS integration. |

---

## 🤝 Built By

**Missari Ahil** — [missariahil10@gmail.com](mailto:missariahil10@gmail.com)

Built in 96 hours for the **Dynarq Systems Full-Stack Engineering Assessment**.

Stack: Cloudflare Workers · D1 · Workers AI · Hono · TypeScript · MapLibre GL
