portugal_climate_grid.json
--------------------------
Regular latitude/longitude grid (WGS84) with five hazard bands (0-1), used by the web app for:
- Map overlays (cell-centre subsample)
- Bilinear sampling at any (lat, lon) inside bounds

Regenerate (or replace the pipeline):
  pip install -r requirements-climate.txt
  python scripts/eurocordex_to_app_grid.py --tasmax <tasmax_day_*.nc> --pr <pr_day_*.nc> --years 1971 2000 --out data/climate_grids/portugal_climate_grid.json

  Fallback (synthetic analytical grid for UI dev only):
  python scripts/generate_portugal_climate_grid.py

EURO-CORDEX inputs must be on a **regular lon/lat grid** in degrees. Native rotated-pole CORDEX grids should be regridded first (e.g. CDO remapbil, or Python xesmf), then clipped.

Production: build this file (or COG/GeoTIFF + server-side sampling) from spatial climate databases, e.g.:
- ERA5 / ERA5-Land (Copernicus CDS)
- EURO-CORDEX regional climate projections
- CMIP6 global/downscaled products
- National layers (IPMA, APA) where available

Keep the same schema (meta + bands) so the front-end ClimateGridSampler stays valid.
