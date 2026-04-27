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
- Each computation can be optionally **logged locally** for demo analytics and displayed in a
  built-in **BI dashboard**.

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

### 5) BI logging (statistics for demos)

Each click on **Calculate risk and measures** can be logged locally (browser-only) for statistics:

- Storage: `localStorage`
- Module: `js/analyticsStore.js`
- Dashboard: `js/biDashboard.js`

**Important:** logs are stored *per browser* and *per origin* (domain + protocol + port). Deploying a
new version does **not** delete logs, but switching domain (e.g. `localhost` → GitHub Pages) means
each environment has its own separate storage. Users can also clear site data.

Use **Export JSON** / **Import / merge JSON** in the BI dashboard to back up and restore logs.

Logged event contains (high level):

- Timestamp
- Session id (local)
- Location (lat/lon, source)
- Full questionnaire profile object
- Sampled hazards
- Risk outputs (overall + per hazard)
- Sampling metadata

The BI dashboard shows:

- KPIs (event count, average overall, average sensitivity/adaptive capacity)
- Distributions (risk bands, location source)
- Timeline (daily counts)
- Top-risk event list
- Profile breakdown: distributions + avg overall per profile category
- Export / clear local logs

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

Because the app uses `fetch()` for JSON, run it via a local HTTP server (not `file://`).

From the repo root:

```bash
python -m http.server 8080
```

Then open:

- `http://localhost:8080/`

## Repository structure (key files)

- `index.html`: UI
- `styles.css`: styling
- `js/app.js`: orchestration + rendering + BI wiring
- `js/climateGridSampler.js`: bilinear point sampling on the hazard grid
- `js/riskEngine.js`: risk model
- `js/hazardMapLayers.js`: map overlays for hazard layers
- `js/analyticsStore.js`: local analytics event store
- `js/biDashboard.js`: BI dashboard renderer
- `data/*`: measure library, example profiles, grids, outline GeoJSON
- `scripts/*`: grid generation and climate data conversion utilities

