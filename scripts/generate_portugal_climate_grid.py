"""
Build a regular WGS84 grid of normalized hazard indices (0-1) for Portugal + ilhas.

MVP: smooth analytical fields (climate-informed patterns). For production, replace
`fill_bands()` with raster reprojection from ERA5, EURO-CORDEX, CMIP6 downscaling, etc.

Output: data/climate_grids/portugal_climate_grid.json
"""
from __future__ import annotations

import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "climate_grids", "portugal_climate_grid.json")

# Mainland + islands (approx.); moderate resolution for ~300-800 KiB file size
SOUTH, NORTH = 32.0, 43.0
WEST, EAST = -31.0, -5.5
DY = DX = 0.25


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def fill_bands(lat: float, lon: float) -> dict[str, float]:
    """
    Synthetic continuous fields mimicking broad climate-risk patterns (not observations).
    Replace with actual stacked rasters in production.
    """
    # Heat stress proxy: higher Algarve/Alentejo, lower Minho
    heat = clamp01(0.25 + 0.65 * (1.0 - (lat - 33.0) / 10.5) + 0.08 * math.sin(math.radians(lat * 4.0)))

    # Pluvial / flood tendency: NW wetter
    flood = clamp01(0.2 + 0.45 * (1.0 - (lat - 36.0) / 7.0) * 0.4 + 0.35 * max(0.0, (-lon - 8.0) / 22.0))

    # Wildfire: interior away from humid coast
    inland = 1.0 - min(1.0, abs(lon + 8.0) / 12.0)
    wildfire = clamp01(0.15 + 0.55 * inland * (1.0 - abs(lat - 39.5) / 8.0) + 0.12 * math.sin(math.radians(lon * 3.0)))

    # Drought: inner south / Alentejo-like
    drought = clamp01(0.2 + 0.6 * max(0.0, (40.0 - lat) / 9.0) * (0.4 + 0.6 * inland))

    # Coastal storm / surge proxy: Atlantic coast
    coastal = clamp01(0.15 + 0.55 * max(0.0, (-lon - 8.5) / 20.0) + 0.15 * (1.0 - abs(lat - 40.0) / 12.0))

    return {
        "heat": round(heat, 5),
        "flood": round(flood, 5),
        "wildfire": round(wildfire, 5),
        "drought": round(drought, 5),
        "coastal_storm": round(coastal, 5),
    }


def main() -> None:
    nrows = int(round((NORTH - SOUTH) / DY)) + 1
    ncols = int(round((EAST - WEST) / DX)) + 1

    keys = ["heat", "flood", "wildfire", "drought", "coastal_storm"]
    bands: dict[str, list] = {k: [] for k in keys}

    for i in range(nrows):
        lat = SOUTH + i * DY
        rows = {k: [] for k in keys}
        for j in range(ncols):
            lon = WEST + j * DX
            h = fill_bands(lat, lon)
            for k in keys:
                rows[k].append(h[k])
        for k in keys:
            bands[k].append(rows[k])

    doc = {
        "meta": {
            "crs": "EPSG:4326",
            "title": "Spatial grid of climate-related hazards (MVP sample)",
            "south": SOUTH,
            "north": NORTH,
            "west": WEST,
            "east": EAST,
            "dy": DY,
            "dx": DX,
            "nrows": nrows,
            "ncols": ncols,
            "methodology": (
                "Continuous values on a regular WGS84 grid. This file uses illustrative analytical "
                "fields. In production, replace with bilinear (or higher-order) extraction from "
                "spatial climate-model databases (e.g. ERA5 reanalysis, EURO-CORDEX, downscaled "
                "CMIP6) in NetCDF/GeoTIFF/Zarr, reprojected to this grid or sampled at the point."
            ),
            "variables": {
                "heat": "Thermal stress proxy (0–1, normalised)",
                "flood": "Pluvial / river flood exposure proxy (0–1)",
                "wildfire": "Wildfire risk proxy (0–1)",
                "drought": "Drought / agriculture stress proxy (0–1)",
                "coastal_storm": "Coastal storm / surge exposure proxy (0–1)",
            },
        },
        "bands": bands,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))

    print("Wrote", OUT, "nrows=", nrows, "ncols=", ncols)


if __name__ == "__main__":
    main()
