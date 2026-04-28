# Climate Change‑Me

Personalised climate risk and anticipatory actions, driven by location + profile.

Portugal is used as an example region in this repository, but the methodology is designed to scale
globally to any gridded climate dataset (regional models, reanalysis, downscaled CMIP6, etc.).

## What the platform does

- **You choose a location** (map click/drag or municipality centroid).
- The platform **samples hazard layers** at that point (gridded database).
- You answer a short **profile questionnaire** (exposure + vulnerability factors).
- The platform computes:
  - **Overall risk score**
  - **Risk per hazard**
  - A **prioritised action plan** (early warnings → immediate action → preparedness → adaptation)
- Each computation is logged to a **shared analytics store** (server + database) so the BI dashboard
  shows **platform-wide** statistics.

## Methodology (end-to-end)

### 1) Climate hazard layers (spatial grid)

The frontend consumes a single JSON grid:

- `data/climate_grids/portugal_climate_grid.json`

It stores multiple hazard “bands” (0–1):

- `heat`
- `flood`
- `wildfire`
- `drought`
- `coastal_storm`

Each band is a regular **WGS84 (EPSG:4326)** grid (lat/lon) covering the Portugal example region.

### 2) Point sampling (location → hazard values)

When a user sets a location, hazard values are obtained by **bilinear interpolation** on the grid.

- Implementation: `js/climateGridSampler.js`
- Output: `{ hazards, meta }` where:
  - `hazards` is a `{ hazardKey: value }` object
  - `meta` contains sampling details (cell indices, weights, bounds)

This is intentionally aligned with how real climate-model rasters are typically queried.

### 3) Risk model (hazard × exposure × vulnerability)

For each hazard \(h\):

\[
Risk_h \approx Hazard_h \times Exposure_h \times Vulnerability_h
\]

Where:

- **Hazard** comes from the spatial grid sampling (0–1)
- **Exposure** is derived from the questionnaire (per-hazard)
- **Vulnerability** combines:
  - **Sensitivity**
  - **Adaptive capacity**

Implementation: `js/riskEngine.js`

Key details:

- `Sensitivity(form)` increases with e.g. age, chronic conditions, limited mobility, outdoor work.
- `AdaptiveCapacity(form)` increases with e.g. income, education, insurance, social support, access
  to alerts, AC/cool-room access.
- `Vulnerability = w_s * Sensitivity + w_a * (1 - AdaptiveCapacity)`
- `PROFILE_SPREAD` increases profile-driven differentiation around the midpoint (demo tuning).

### 4) Measures (turn risk into action)

Measures are selected based on the top hazards in the computed results:

- Library: `data/measures_library.json`
- Selection logic: `js/app.js` (picks a small set per “lane”)

Lanes:

- Early warnings
- Immediate action
- Preparedness
- Climate adaptation

### 5) BI logging (platform-wide statistics)

Each successful assessment POSTs an event JSON payload to **`/api/events`**:

- **Local**: implemented by `server.py`, persisted in **`analytics.db`** (SQLite).
- **Production (e.g. Vercel)**: implemented by **`api/events.js`**, persisted in **Redis/KV**
  (`@upstash/redis`; configure REST URL/token env vars).

The BI dashboard (`js/biDashboard.js`) reads **`GET /api/events?days=…`** when the API exists; if the
request fails (static hosting), it falls back to **`js/analyticsStore.js`** (`localStorage`, this
browser only) so charts still populate.

Logged payload contains (high level):

- Timestamp (`ts`)
- Location (`loc`)
- Sampled hazards (`hazards`)
- Questionnaire profile (`profile`)
- Risk outputs (`result`)

## Data pipeline (production-ready direction)

This repo includes a script that can convert real EURO‑CORDEX-like NetCDF data into the app’s grid
format:

- `scripts/eurocordex_to_app_grid.py`

The intent is:

1. Read gridded climate-model data (NetCDF)
2. Clip to the region of interest (Portugal mainland for the example)
3. Compute climate indices / seasonal statistics
4. Normalize to 0–1 hazard bands for the UI
5. Output `portugal_climate_grid.json`

The repository also contains a synthetic generator used for UI iteration and demos:

- `scripts/generate_portugal_climate_grid.py`

Continental Portugal envelope constants (example region):

- `scripts/continental_portugal.py`

## Run locally

Use the built-in platform server so the **global statistics (BI)** can log to a shared database.

From the repo root (PowerShell):

```powershell
.\serve.ps1
```

Or directly:

```bash
python server.py
```

Then open:

- `http://localhost:8080/`

### Note about global BI

If you run `python -m http.server`, the BI will **not** work because `/api/events` requires a server
that supports `POST` and stores events (this repo uses `server.py` + SQLite).

## Deploy on Vercel (production BI)

Vercel serves the static site, but it **does not run** `python server.py`. If you deploy as “static files
only”, `GET/POST /api/events` would return **404** and nothing is saved.

This repo includes a Vercel **Serverless Function** at `api/events.js` which implements the same
endpoints using **Redis** (via `@upstash/redis`, compatible with **Vercel KV / Upstash** REST env vars).

1. In Vercel, add a **Redis/KV** store (Upstash Redis, or Vercel KV) and ensure these env vars exist
   on the project (names may vary slightly; the function checks common ones):
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, **or**
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN`
2. Redeploy. `GET https://<your-domain>/api/events?days=30` should return `200` with a JSON array
   (possibly `[]` at first).
3. Run an assessment in the app; then open the BI dashboard — counts should increase.

If `/api/events` is **not** available (pure static hosting), the app falls back to **`localStorage`**
via `js/analyticsStore.js`: BI shows statistics **for this browser only**, matching older deployments.

Local development can still use `server.py` + `analytics.db` (no Redis required).

## Repository structure (key files)

- `index.html`: UI
- `styles.css`: styling
- `js/app.js`: orchestration + rendering + BI wiring
- `js/climateGridSampler.js`: bilinear point sampling on the hazard grid
- `js/riskEngine.js`: risk model
- `js/hazardMapLayers.js`: map overlays for hazard layers
- `js/analyticsStore.js`: browser fallback store when `/api/events` is unavailable
- `js/biDashboard.js`: BI dashboard renderer
- `server.py`: local static server + SQLite analytics API (`analytics.db`)
- `api/events.js`: production analytics API on Vercel (Redis/KV-backed)
- `package.json`: Node dependency for `@upstash/redis` (Vercel build)
- `data/*`: measure library, example profiles, grids, outline GeoJSON
- `scripts/*`: grid generation and climate data conversion utilities

