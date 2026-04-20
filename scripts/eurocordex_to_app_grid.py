#!/usr/bin/env python3
"""
Build data/climate_grids/portugal_climate_grid.json from EURO-CORDEX NetCDF inputs.

- Clips to **continental Portugal** (mainland bounding box).
- Requires **regular longitude / latitude** in degrees (regrid rotated CORDEX first).

Hazard proxies (climatological means over --years), each min–max normalised to 0–1 on
the clipped domain before resampling to the output grid:

  heat          — JJA mean tasmax (°C)
  flood         — DJF mean pr (mm/day)
  wildfire      — normalised JJA tasmax × (1 − normalised JJA pr)
  drought       — 1 − normalised JJA pr
  coastal_storm — Atlantic weight (−(lon+8)/4, clipped) × (0.5 + 0.5 × normalised DJF pr)

Web app sampling at a point: bilinear on the output grid (ClimateGridSampler).

Example
-------
  pip install -r requirements-climate.txt

  python scripts/eurocordex_to_app_grid.py \\
    --tasmax /path/to/tasmax_day_*.nc \\
    --pr /path/to/pr_day_*.nc \\
    --years 1971 2000 \\
    --resolution 0.1 \\
    --out data/climate_grids/portugal_climate_grid.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(__file__))

from continental_portugal import (
    MAINLAND_EAST,
    MAINLAND_NORTH,
    MAINLAND_SOUTH,
    MAINLAND_WEST,
)

try:
    import xarray as xr
except ImportError as e:
    raise SystemExit(
        "Missing dependency: pip install -r requirements-climate.txt\n" + str(e)
    ) from e


def _find_coord(ds: xr.Dataset | xr.DataArray, candidates: tuple[str, ...]) -> str:
    for c in candidates:
        if c in ds.coords or c in ds.dims:
            return c
    raise ValueError(f"Could not find lon/lat among coords: {list(ds.coords)}")


def _standardise_coords(ds: xr.Dataset) -> xr.Dataset:
    rename: dict[str, str] = {}
    for old, new in (("longitude", "lon"), ("latitude", "lat")):
        if old in ds.dims or old in ds.coords:
            rename[old] = new
    return ds.rename(rename) if rename else ds


def _clip_mainland(ds: xr.Dataset) -> xr.Dataset:
    ds = _standardise_coords(ds)
    lon_n = _find_coord(ds, ("lon",))
    lat_n = _find_coord(ds, ("lat",))
    lat = ds[lat_n]
    if float(lat[0]) > float(lat[-1]):
        sel_lat = slice(MAINLAND_NORTH, MAINLAND_SOUTH)
    else:
        sel_lat = slice(MAINLAND_SOUTH, MAINLAND_NORTH)
    return ds.sel({lon_n: slice(MAINLAND_WEST, MAINLAND_EAST), lat_n: sel_lat})


def _open_inputs(tasmax_path: str | None, pr_path: str | None, dataset_path: str | None) -> tuple[xr.Dataset, str, str]:
    if dataset_path:
        ds = xr.open_dataset(dataset_path)
        ds = _standardise_coords(ds)
        return ds, "tasmax_path merged", "pr merged"
    if not tasmax_path or not pr_path:
        raise ValueError("Provide --dataset OR both --tasmax and --pr")
    t = _standardise_coords(xr.open_dataset(tasmax_path))
    p = _standardise_coords(xr.open_dataset(pr_path))
    # Merge; align time if needed
    ds = xr.merge([t, p], compat="override", join="inner")
    return ds, tasmax_path, pr_path


def _get_var(ds: xr.Dataset, names: tuple[str, ...]) -> xr.DataArray:
    for n in names:
        if n in ds:
            return ds[n]
    raise ValueError(f"None of variables {names} found in {list(ds.data_vars)}")


def _to_mm_day(pr: xr.DataArray) -> xr.DataArray:
    u = str(pr.attrs.get("units", "")).lower()
    if "kg m-2 s-1" in u or "kg m**-2 s**-1" in u:
        return pr * 86400.0
    return pr


def _to_celsius(tas: xr.DataArray) -> xr.DataArray:
    u = str(tas.attrs.get("units", "")).lower()
    if "kelvin" in u or tas.attrs.get("units") == "K":
        return tas - 273.15
    return tas


def _season_climatology_mean(da: xr.DataArray, months: list[int]) -> xr.DataArray:
    """Mean over all timesteps whose month is in *months* (climatology for [y0,y1])."""
    if "time" not in da.dims:
        raise ValueError("Expected a time dimension on the variable")
    mon = da.time.dt.month.values
    mask = np.isin(mon, np.asarray(months, dtype=int))
    if not np.any(mask):
        raise ValueError(f"No timesteps in months {months} for the selected period")
    sub = da.isel(time=np.flatnonzero(mask))
    return sub.mean("time")


def norm01_xr(da: xr.DataArray) -> xr.DataArray:
    lo, hi = float(da.min()), float(da.max())
    if hi <= lo:
        return xr.zeros_like(da)
    return ((da - lo) / (hi - lo)).clip(0.0, 1.0)


def regrid_to_lonlat(
    da: xr.DataArray,
    lon_n: str,
    lat_n: str,
    lats: np.ndarray,
    lons: np.ndarray,
) -> np.ndarray:
    """Linear interpolation onto regular 2D grid (outer product of lats × lons)."""
    out = da.interp(**{lat_n: lats, lon_n: lons}, method="linear")
    arr = np.asarray(out.values, dtype=float)
    return np.where(np.isfinite(arr), arr, 0.0)


def main() -> None:
    ap = argparse.ArgumentParser(description="EURO-CORDEX → app grid JSON (continental Portugal)")
    ap.add_argument("--tasmax", help="NetCDF with daily tasmax")
    ap.add_argument("--pr", help="NetCDF with daily pr")
    ap.add_argument("--dataset", help="Single NetCDF with tasmax and pr")
    ap.add_argument("--years", type=int, nargs=2, default=(1971, 2000), metavar=("Y0", "Y1"))
    ap.add_argument("--resolution", type=float, default=0.1, help="Output grid step in degrees")
    ap.add_argument(
        "--out",
        default=os.path.join(ROOT, "data", "climate_grids", "portugal_climate_grid.json"),
    )
    args = ap.parse_args()

    ds, _, _ = _open_inputs(args.tasmax, args.pr, args.dataset)
    ds = _clip_mainland(ds)
    lon_n = _find_coord(ds, ("lon",))
    lat_n = _find_coord(ds, ("lat",))

    tasmax = _to_celsius(_get_var(ds, ("tasmax", "tasMax", "TASMAX")))
    pr = _to_mm_day(_get_var(ds, ("pr", "PR")))

    y0, y1 = args.years
    tasmax = tasmax.sel(time=slice(f"{y0}-01-01", f"{y1}-12-31"))
    pr = pr.sel(time=slice(f"{y0}-01-01", f"{y1}-12-31"))

    jja_tmax = _season_climatology_mean(tasmax, [6, 7, 8])
    jja_pr = _season_climatology_mean(pr, [6, 7, 8])
    djf_pr = _season_climatology_mean(pr, [12, 1, 2])

    n_jja_tmax = norm01_xr(jja_tmax)
    n_jja_pr = norm01_xr(jja_pr)
    n_djf_pr = norm01_xr(djf_pr)

    wildfire = (n_jja_tmax * (1.0 - n_jja_pr)).clip(0.0, 1.0)
    drought = (1.0 - n_jja_pr).clip(0.0, 1.0)

    lon2d, _ = xr.broadcast(jja_pr[lon_n], jja_pr)
    coastal_w = (-(lon2d + 8.0) / 4.0).clip(0.0, 1.0)
    coastal = (coastal_w * (0.5 + 0.5 * n_djf_pr)).clip(0.0, 1.0)

    bands_xr = {
        "heat": n_jja_tmax,
        "flood": n_djf_pr,
        "wildfire": wildfire,
        "drought": drought,
        "coastal_storm": coastal,
    }

    dy = dx = float(args.resolution)
    lats = np.arange(MAINLAND_SOUTH, MAINLAND_NORTH + dy * 0.25, dy)
    lons = np.arange(MAINLAND_WEST, MAINLAND_EAST + dx * 0.25, dx)

    bands: dict[str, list[list[float]]] = {}
    for key, da in bands_xr.items():
        gr = regrid_to_lonlat(da, lon_n, lat_n, lats, lons)
        bands[key] = np.round(gr, 5).tolist()

    nrows, ncols = len(bands["heat"]), len(bands["heat"][0])
    meta: dict[str, Any] = {
        "crs": "EPSG:4326",
        "title": "Continental Portugal hazard grid (EURO-CORDEX derived indices)",
        "south": float(lats[0]),
        "north": float(lats[-1]),
        "west": float(lons[0]),
        "east": float(lons[-1]),
        "dy": dy,
        "dx": dx,
        "nrows": nrows,
        "ncols": ncols,
        "source": "EURO-CORDEX",
        "domain_clip": "continental_portugal_bbox",
        "years": [y0, y1],
        "methodology": (
            "Derived from EURO-CORDEX daily tasmax and pr, clipped to mainland Portugal, "
            "seasonal aggregation and combined proxies, per-variable min–max normalisation on "
            "the clipped field, then bilinear resampling to a regular WGS84 grid. "
            "Point values in the app use bilinear interpolation on this grid."
        ),
        "variables": {
            "heat": "Normalised JJA mean daily maximum temperature (warm-season stress proxy)",
            "flood": "Normalised DJF mean daily precipitation (winter wetness proxy)",
            "wildfire": "JJA warmth × dryness (normalised tasmax and pr)",
            "drought": "Summer moisture deficit proxy (1 − normalised JJA pr)",
            "coastal_storm": "Atlantic exposure weight × normalised DJF pr (refine with sfcWind if available)",
        },
    }

    doc = {"meta": meta, "bands": bands}
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))

    print("Wrote", args.out, "grid", nrows, "x", ncols, "extent", meta["south"], meta["north"], meta["west"], meta["east"])


if __name__ == "__main__":
    main()
