# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single repo holding two separately-deployed apps for Toperty (Colombian real estate):

- **Frontend** (repo root): Next.js 14 App Router + React 19 + TypeScript, Tailwind v4 + Radix UI. Styled with Toperty's corporate design system (navy `#001845` / cyan `#6EFAFB` tokens in `app/globals.css`; Satoshi/Switzer fonts). Deploys to **Vercel**.
- **Backend** (`backend/`): FastAPI + SQLModel over PostgreSQL. Deploys to **Google Cloud Run** (`Dockerfile.production`).

The frontend talks to the backend over HTTP only (`NEXT_PUBLIC_API_URL`, default `http://localhost:8000`); there is no shared code between them. All UI strings, comments, and commit messages are in Spanish — match that.

The app serves three distinct domains, all under one dashboard:
1. **Scraper monitoring** — operational status of real-estate scrapers (`city`, `property`, `scraper_logs` tables).
2. **Property valuation (avalúos)** — ML price predictions from two **LightGBM** models in `backend/ml_models/` (one for rent, one for sell; both predict `log1p(price/m²)`). Sell was CatBoost before — migrated to LightGBM for better metrics and a single serving format.
3. **Investor / payment-plan presentations** — generates shareable, token-gated dashboards (`/dashboard/payment-plan/[token]`) backed by Google Sheets, plus PDF approval letters and investor presentations.

## Commands

Frontend (run from repo root; uses **pnpm**):
```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build
pnpm lint     # eslint .
```

Backend (run from `backend/`):
```bash
pip install -r requirements.txt
uvicorn main_refactored:app --reload --port 8000   # API on :8000, docs at /docs
```

Full stack via Docker (from repo root):
```bash
docker-compose up   # backend :8000, frontend :3000, hot-reload both
```

There is no test suite.

## Important gotchas

- **Backend entrypoint is `main_refactored:app`**, not `main.py`/`start.py`. The README is stale on this — ignore its `python start.py` instructions. `Dockerfile.production` and docker-compose both use `main_refactored`.
- **`next.config.mjs` ignores TypeScript and ESLint errors during build** (`ignoreBuildErrors`, `ignoreDuringBuilds`). A passing `pnpm build` does NOT mean the types are sound — run `pnpm lint` and check types separately when correctness matters.
- Frontend fetch helpers in `lib/api.ts` **swallow errors and return mock/empty data** on failure (see `getMockData`). When the dashboard shows suspicious placeholder numbers, the backend call likely failed silently.
- All `lib/api.ts` fetches use `cache: 'no-store'`; the public payment-plan dashboards also rely on explicit cache-busting against Google Sheets.
- **Avalúo serving (`routers/valuations.py`) normalizes categoricals before predicting** — the valuation form sends `city_id`/`age_bucket`/`is_new` in a different representation than the models were trained on, so `_normalize_categoricals` translates them (else LightGBM treats them as unknown and silently drops the feature — `city_id` alone is ~17–26% of the model). Notably, **`city_id` is derived from lat/lon** via nearest centroid (`ml_models/city_centroids.json`) because the form has no city picker. Models are cached at module level (loaded once). To retrain, use `ml_models/train.py` (DB creds via `TRAIN_DB_URI` env), which writes the exact filenames the backend loads.

## Backend architecture

Layered, registered in `main_refactored.py`:

- `routers/` — FastAPI `APIRouter`s, one per feature (`dashboard`, `properties`, `valuations`, `payment_plans`, `investor_form`, `investor_presentation`, `approval_letter`, `image_proxy`, `zones`, etc.). Most are mounted under the `/api` prefix. Add a new feature by creating a router and registering it in `main_refactored.py`.
- `services/` — business logic shared across routers (`stats_service` for dashboard aggregation + `get_local_now` timezone helper, `google_sheets_reader`, `geo_service`, `property_filters`).
- `models/` — SQLModel table classes. **New models must be imported in `main_refactored.py`** before `init_db()` so `SQLModel.metadata.create_all` picks them up. `init_db()` runs `create_all` at startup — there are no migrations; schema changes happen by editing models (one-off scripts in `backend/scripts/` handle data backfills).
- `config/db_connection.py` — builds `DATABASE_URL` from env vars and exposes the shared `engine`; routers open `Session(engine)` directly.
- `config/gcs_config.py` — Google Cloud Storage client for uploading property/appraisal images (`appraisals-images` bucket).

`repositories/` exists but is currently empty.

### External integrations
The investor/payment-plan flow is glued together with several **Google Apps Script web apps** (URLs in env: `GOOGLE_APPS_SCRIPT_URL`, `GOOGLE_APPS_SCRIPT_READER_URL`, `APPSCRIPT_PRESENTATION_URL`, `APPSCRIPT_APPROVAL_LETTER_URL`; the script source lives in `backend/scripts/appscript_final.gs`). Sheets formulas are computed asynchronously by Google, so `payment_plans.py` polls the reader Apps Script with backoff/retries until the data looks "complete" before serving it. PDFs are built server-side with reportlab (and client-side with jspdf/html2canvas in `lib/investor-pdf-generator.ts`).

Expired public dashboards are deactivated by `backend/scripts/cleanup_dashboards.py`, intended to run as a cron hitting `/api/dashboard/cleanup`. An expired dashboard can be re-enabled from the Avalúo actions modal ("Ampliar plazo"): `GET /api/dashboard/check/{valuation_name}` returns an explicit `is_expired` flag (`days_remaining` is 0 both when expired and when <24h remain, so the flag is needed), and `POST /api/dashboard/{token}/extend` reactivates it — `days` is clamped to 1–10 server-side.

### Auth — server-side sessions + read-only accounts

The backend enforces identity on every **mutation** (`backend/auth.py` + the `auth_and_readonly_guard` middleware in `main_refactored.py`); GETs stay open as before:

- **Login**: the frontend exchanges the Google credential at `POST /api/auth/session` (`routers/auth.py`); the backend verifies it against Google (signature + audience via `GOOGLE_CLIENT_ID`), validates the allowed domains/emails, and issues its own session token (HMAC-SHA256 signed with `SESSION_SECRET`, 7 days, stdlib only — no new deps). The app **fails fast at startup if `SESSION_SECRET` is missing** rather than deploying with broken auth.
- **Guard**: POST/PUT/PATCH/DELETE require a valid `Authorization: Bearer` session → 401 otherwise. Exempt: `/api/auth/*` and the public share-link sync `/api/dashboard/{token}/sync`.
- **Read-only accounts** (`READ_ONLY_EMAILS` allowlist in `backend/auth.py`): they log in and see everything (views/buttons are NOT hidden — the server is the guarantee), but mutations return **403 with header `X-Readonly-Block: 1`**, which distinguishes this 403 from any other. **Compute-only POSTs** (`_COMPUTE_ONLY_REGEXES`, e.g. `/api/valuation` — runs the ML models, writes nothing) are allowed for read-only accounts.
- **Frontend**: `lib/api-interceptor.ts` monkey-patches `window.fetch` once (there is no central API client for writes) to attach the Bearer token to backend calls and emit `api-readonly-blocked` (403 + `X-Readonly-Block` → "Modo solo lectura" toast) and `api-session-expired` (401 outside `/api/auth/` → toast + forced re-login). `AuthGate` listens for both; `restoreSession` in `lib/auth.ts` refuses to restore a session whose backend token is missing or expired. The header shows a "Solo lectura" badge from the `readonly` flag returned at login.

## Frontend architecture

- `app/` — App Router. `app/page.tsx` is the internal monitoring dashboard, wrapped in `<AuthGate>` (Google OAuth exchanged for a backend session — see "Auth" above and `lib/auth.ts` / `lib/api-interceptor.ts`). `app/dashboard/payment-plan/[token]/` serves the **public, token-gated** investor/user dashboards (no auth gate).
- `components/` — feature components (`monitoring-dashboard`, `property-valuation`, `payment-plan-dashboard`, `investor-pdf-form`, etc.); `components/ui/` holds the shadcn/Radix primitives.
- `lib/api.ts` — the single typed client for the backend; add backend calls here.
- `contexts/`, `hooks/` — React context (geocoding) and shared hooks (toast, confirm, alert, geocoding).
- **Design tokens live in `app/globals.css`**: the shadcn variables (`--primary`, `--accent`, charts, feedback) are remapped to the corporate palette, plus brand utilities (`bg-brand-navy`, `text-brand-cyan`, `text-success`, `text-brand-orange`) and type presets (`t-h1`…`t-caption`). Prefer these over hardcoded Tailwind colors (`blue-600`, `gray-500`, …). Logo via `components/toperty-logo.tsx` (`variant="navy"|"white"`).

## Configuration

Backend reads Postgres creds from `ADMIN_USER`/`PASSWORD`/`HOST`/`DB_NAME`/`DB_PORT`, plus Google API/Sheets/Apps Script URLs, SMTP, and GCS/GCP project vars. Auth requires `SESSION_SECRET` (or `JWT_SECRET`; **mandatory — the backend refuses to start without it**) and `GOOGLE_CLIENT_ID` (or `NEXT_PUBLIC_GOOGLE_CLIENT_ID`). Note these reach the container only through docker-compose's `environment:` block locally (the Dockerfiles do not define them) and must be set on the Cloud Run service in production. Frontend reads `NEXT_PUBLIC_*` vars (API URL, Google OAuth client ID, Maps/Mapbox tokens, and per-program presentation template IDs). See `.env`, `.env.oauth.example`, and `.env.production.example`. Service-account JSON files (`gcs-credentials.json`, `service-account.json`) are git-ignored secrets — never commit them.
