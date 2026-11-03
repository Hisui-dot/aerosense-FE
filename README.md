# AeroSense

An IoT-based environmental monitoring system that detects vaping by sensing airborne particulates (PM2.5) and volatile organic compounds (VOCs). It has two halves that share a data model (devices, sensors, alerts):

1. **Firmware / hardware edge node** — an ESP32 reads air-quality sensors (PMS5003 + SGP40), applies a threshold, and triggers a local buzzer/LED alarm. Spec: `IoT_Vape_Detection_Manual_Phase1_Revised.docx`.
2. **Web dashboard** — a React admin/security console for monitoring devices, viewing alerts, managing users, and analytics. Lives in `frontend/`, backed by an Express + SQLite API in `backend/`.

The firmware is the **data source** (it `POST`s readings to `/api/ingest/readings`); the dashboard is the **consumer**.

> **New here? Start with the beginner-friendly setup guide:** [`docs/INSTALL.md`](docs/INSTALL.md) — step-by-step Windows install for the dashboard and the ESP8266/ESP32 sensor node.

---

## Repository layout

```
Capstone_Vape/              # repository root (git)
├─ CLAUDE.md                # project instructions for Claude Code
├─ ESP32_Network_and_Detection_Plan.md   # firmware / network design notes
├─ backend/                  # Express + SQLite API (Node, CommonJS)
│  ├─ server.js              # app entry; mounts /api/* routers, serves built frontend
│  ├─ db/                    # store.js (data layer), schema/migrations, seed.js, vape.db
│  ├─ routes/                # one router per domain (auth, alerts, devices, analytics, ingest, …)
│  ├─ middleware/            # auth (JWT) + device-key auth
│  ├─ services/              # detection logic
│  ├─ validation/            # zod schemas for ingest
│  ├─ utils/                 # apiKey generation, etc.
│  └─ .env                   # JWT_SECRET, JWT_EXPIRES_IN, PORT (gitignored)
│
├─ frontend/                 # React 18 + TypeScript + Vite SPA
│  ├─ index.html
│  ├─ public/                # static assets served at / (e.g. AEROSENSELOGO.png)
│  ├─ package.json           # frontend deps + scripts (dev, build, test)
│  ├─ vite.config.ts         # @ → src alias; proxies /api + /uploads to :8001
│  ├─ vitest.config.ts       # unit tests for pure logic
│  └─ src/
│     ├─ main.tsx
│     ├─ styles/             # Tailwind v4 entry + theme.css (design tokens)
│     └─ app/
│        ├─ App.tsx · routes.tsx        # router + auth provider wiring
│        ├─ context/         # AuthContext
│        ├─ services/        # api.ts — typed fetch clients (authApi, alertsApi, analyticsApi, …)
│        ├─ hooks/           # useLiveStream (SSE)
│        ├─ lib/             # pure utils: status, thresholds, csv (unit-tested)
│        ├─ theme/           # tokens.ts (brand + status colors for JS/Recharts)
│        ├─ components/
│        │  ├─ ui/           # shadcn/Radix primitives
│        │  ├─ layout/       # shells: Admin/Security layouts, sidebars, top bars, ProtectedRoute, logo
│        │  └─ admin/        # shared admin UI: MetricCard, StatusBadge, PageHeader, AsyncBoundary, ChartCard
│        └─ pages/
│           ├─ auth/         # Login, Signup
│           ├─ security/     # guard console: Dashboard, Alerts, Sensors, Logs, Analytics, …
│           └─ admin/        # admin console: Dashboard, Alerts, Devices, Analytics, Users, Logs, Settings, Profile
│
├─ docs/superpowers/         # design specs, implementation plans, and build reports
├─ guidelines/               # design guidelines
└─ README.md
```

### Architecture at a glance
- **Frontend → backend** calls go through `frontend/src/app/services/api.ts` — a thin `fetch` wrapper that prefixes `/api`, attaches the JWT from `localStorage`, and exposes typed clients. Add new endpoints here, not via raw `fetch` in components.
- **Backend** mounts one router per domain under `/api/<name>` (`backend/routes/*.js`); routes call a generic data layer in `backend/db/store.js` over a local SQLite file. Auth is enforced by `requireAuth` / `requireAdmin` (Bearer JWT) and `requireDevice` (`x-device-key`) for firmware ingest.
- **Two role-gated route trees** behind `ProtectedRoute`: `/` → security console, `/admin` → admin console.

---

## Prerequisites
- **Node.js 22.5 or newer** — the backend uses Node's built-in `node:sqlite` (`DatabaseSync`), which is unavailable on older Node. Prefer Node 22 LTS+.
- npm (the frontend uses `.npmrc` with `legacy-peer-deps=true` — keep it).

## Setup & run (development)

The backend and frontend are separate apps. Run each in its own terminal.

**1. Backend API** (`http://localhost:8001`)
```bash
cd backend
npm install
# create backend/.env with at least JWT_SECRET and JWT_EXPIRES_IN (see below)
npm run dev          # auto-restarts on change (node --watch)
```
On first run the SQLite database is created and seeded automatically.

**2. Frontend dev server** (Vite, proxies `/api` → `:8001`)
```bash
cd frontend
npm install
npm run dev
```
Open the URL Vite prints. Convenience: from `frontend/`, `npm run dev:backend` starts the backend (`node ../backend/server.js`) — but running the two terminals above is the normal flow.

### Backend `.env`
Create `backend/.env` (gitignored):
```
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=1d
# PORT is optional; the server forces 8001 to match the Vite proxy
```

### Default seed credentials (local dev only)
- `admin` / `admin123` — admin role
- `security` / `security123` — security role

## Build (production)
```bash
cd frontend
npm run build        # outputs frontend/dist/
```
In production the backend serves the built SPA: `backend/server.js` statically serves `../frontend/dist` and falls back to its `index.html`. So build the frontend, then run `cd backend && npm start`.

## Testing
Frontend pure-logic unit tests (Vitest):
```bash
cd frontend
npm test             # run once
npm run test:watch   # watch mode
```
Covers `src/app/lib/*` (status mapping, threshold classification, CSV) and `src/app/theme/tokens`. There is no UI/E2E test runner configured; verify UI by running the app.

## Gotchas
- **Ports:** Vite proxies `/api` and `/uploads` to `http://127.0.0.1:8001`; the backend forces port **8001** even if `PORT=8000`. Keep them aligned.
- **Node version:** see Prerequisites — older Node crashes the backend at startup.
- **Supabase is unused.** `@supabase/supabase-js` is in `backend/package.json` but nothing imports it; persistence is local SQLite only.
- **No linter/formatter** is configured, and `tsconfig` is `strict: false`. Apply explicit types on new/exported code by hand.

---

## Documentation
- Design specs, phased implementation plans, and build reports: `docs/superpowers/{specs,plans,reports}/`.
- Firmware / network design: `ESP32_Network_and_Detection_Plan.md` (repo root).
- Project conventions for Claude Code: `CLAUDE.md` (repo root).
