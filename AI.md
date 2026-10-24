# AI.md — How I Used AI in Building Streetwise

## Tools used and what each was used for

| Tool | Used for |
|------|----------|
| **Antigravity (Google DeepMind)** | Full project scaffolding, all route handlers, HTML pages, tests, README, accuracy script, and iterative debugging of TypeScript types and D1 queries |
| **Cloudflare Workers AI** | Production AI triage: classifying report type, size, priority, confidence, and reason for each citizen report at runtime |

---

## 3 places where AI was wrong or weak, and how I found and fixed them

### 1. HTML module imports — wrong Worker bundling approach

**What the AI did wrong**: The initial `index.ts` used `import html from './file.html'` without import attributes. Wrangler's bundler doesn't support bare HTML imports without `with { type: 'text' }`.

**How I found it**: Running `wrangler deploy --dry-run` produced a bundler error about unrecognised file type.

**How I fixed it**: Added `with { type: 'text' }` import attributes to all HTML imports and suppressed TypeScript errors with `// @ts-ignore` since `@cloudflare/workers-types` doesn't model text imports.

---

### 2. Bcrypt in a Workers environment — incompatible crypto

**What the AI did wrong**: The AI suggested using the `bcrypt` npm package, which depends on native Node.js `crypto` bindings unavailable in the Workers runtime.

**How I found it**: `wrangler dev` failed at startup with "Cannot find module 'crypto'" when the bcrypt import was resolved.

**How I fixed it**: Switched to `bcryptjs` (pure JavaScript implementation) which runs in any environment including Workers with `nodejs_compat` flag. Updated the dependency in `package.json` and all imports.

---

### 3. Fallback triage default priority too low

**What the AI generated**: The fallback keyword rules defaulted to `priority: 2` for all pothole matches. Running the accuracy script locally showed that several priority-3 and priority-4 potholes at busy junctions were being scored as 2.

**How I found it**: Running `npx tsx scripts/measure-accuracy.ts` in local mode and comparing the output against `data/labelled-reports.json`. I noticed 8 pothole reports were underscored on priority.

**How I fixed it**: Added context keywords (`junction`, `roundabout`, `main road`, `near accident`) that bump the priority from 2 to 3 or 4 respectively in `fallback.ts`. Also added the bus stop / school / hospital check to the sensitive places list which correctly escalates to priority 4.

---

## One part I chose to write myself and why

**The point-in-polygon zone assignment (`src/services/triage/zone.ts`)**

I wrote the ray-casting algorithm myself rather than accepting the AI's suggestion to use an external library (`@turf/boolean-point-in-polygon`). My reasons:

1. **Bundle size**: Turf.js adds ~150 KB to the bundle. The ray-casting algorithm is 20 lines.
2. **Workers compatibility**: Some Turf internals use `Buffer` and Node.js APIs that need polyfills in Workers.
3. **Correctness confidence**: I can read and understand 20 lines of geometry code. I can write a unit test that pins the exact behaviour. A black-box library requires trusting documentation I haven't read.
4. **The problem is simple enough**: 6 rectangular zones with 5-point polygons. Ray casting is the right tool and is simple to verify.

I also verified the algorithm manually against the zone polygons in `data/zones.json` using known Colombo coordinates before writing the tests.
