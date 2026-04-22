"""
Build a regular WGS84 grid of normalized hazard indices (0-1) for continental Portugal.

Synthetic analytical fields (climate-informed patterns) for UI development. For operational use, replace
`fill_bands()` with raster reprojection from ERA5, EURO-CORDEX, CMIP6 downscaling, etc.

Output: data/climate_grids/portugal_climate_grid.json
"""
from __future__ import annotations

import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "climate_grids", "portugal_climate_grid.json")

from continental_portugal import (
    MAINLAND_EAST,
    MAINLAND_NORTH,
    MAINLAND_SOUTH,
    MAINLAND_WEST,
)

# Continental Portugal at 10x finer resolution than 0.25°.
SOUTH, NORTH = MAINLAND_SOUTH, MAINLAND_NORTH
WEST, EAST = MAINLAND_WEST, MAINLAND_EAST
DY = DX = 0.025


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def gauss2d(lat: float, lon: float, lat0: float, lon0: float, s_lat: float, s_lon: float) -> float:
    a = ((lat - lat0) / s_lat) ** 2 + ((lon - lon0) / s_lon) ** 2
    return math.exp(-0.5 * a)


def fill_bands(lat: float, lon: float) -> dict[str, float]:
    """
    Synthetic continuous fields mimicking broad climate-risk patterns (not observations).
    Replace with actual stacked rasters in production.
    """
    # Normalized coordinates on the broad PT + islands envelope.
    xn = (lon - WEST) / (EAST - WEST)  # west=0, east=1
    yn = (lat - SOUTH) / (NORTH - SOUTH)  # south=0, north=1

    # Atlantic / continentality proxies.
    atlantic = clamp01(((-lon) - 8.0) / 3.2)  # higher at exposed west coast
    interior = clamp01(1.0 - abs(lon + 8.2) / 2.1)  # broad inland ridge
    east = clamp01(xn)
    south = clamp01((40.0 - lat) / 4.0)
    north = clamp01((lat - 39.0) / 3.5)

    # Add deterministic spatial texture and local hotspots so the map is less flat.
    wave_a = 0.5 + 0.5 * math.sin(math.radians(lat * 11.0 + lon * 17.0))
    wave_b = 0.5 + 0.5 * math.cos(math.radians(lat * 13.0 - lon * 9.0))
    lisbon_hotspot = gauss2d(lat, lon, 38.72, -9.14, 0.8, 0.9)
    porto_hotspot = gauss2d(lat, lon, 41.15, -8.63, 0.7, 0.8)
    alentejo_hotspot = gauss2d(lat, lon, 38.1, -7.8, 1.0, 1.0)
    interior_east_hotspot = gauss2d(lat, lon, 39.7, -7.25, 0.9, 0.7)
    # Shared inland hotspot to enable a true max-risk stress-test location.
    common_extreme_hotspot = gauss2d(lat, lon, 39.42, -7.31, 0.35, 0.35)
    madeira_hotspot = gauss2d(lat, lon, 32.72, -16.95, 0.6, 0.9)
    azores_hotspot = gauss2d(lat, lon, 37.74, -25.67, 0.8, 1.2)

    # Heat stress: stronger in south/interior, with urban and island modulation.
    heat = clamp01(
        0.20
        + 0.34 * south
        + 0.16 * interior
        + 0.18 * east
        + 0.08 * wave_a
        + 0.07 * lisbon_hotspot
        + 0.05 * alentejo_hotspot
        + 0.11 * interior_east_hotspot
        + 0.35 * common_extreme_hotspot
        + 0.04 * madeira_hotspot
        - 0.06 * north
    )

    # Flood tendency: Atlantic + north-west influence, rain-band texture, island signal.
    flood = clamp01(
        0.14
        + 0.20 * atlantic
        + 0.18 * north
        + 0.10 * east
        + 0.12 * wave_b
        + 0.08 * porto_hotspot
        + 0.06 * interior_east_hotspot
        + 0.42 * common_extreme_hotspot
        + 0.07 * azores_hotspot
        + 0.06 * madeira_hotspot
        - 0.08 * south
    )

    # Wildfire: interior + warm/dry zones, reduced in wet Atlantic-facing areas.
    wildfire = clamp01(
        0.12
        + 0.26 * interior
        + 0.17 * south
        + 0.14 * east
        + 0.10 * wave_a
        + 0.10 * alentejo_hotspot
        + 0.12 * interior_east_hotspot
        + 0.36 * common_extreme_hotspot
        - 0.16 * atlantic
        - 0.06 * azores_hotspot
    )

    # Drought: southern and interior gradient with regional peaks.
    drought = clamp01(
        0.16
        + 0.24 * south
        + 0.14 * interior
        + 0.20 * east
        + 0.10 * (0.5 + 0.5 * math.sin(math.radians(lon * 7.0)))
        + 0.08 * alentejo_hotspot
        + 0.14 * interior_east_hotspot
        + 0.36 * common_extreme_hotspot
        - 0.10 * atlantic
        - 0.05 * north
    )

    # Coastal storm: Atlantic exposure + north-west, with islands exposed.
    coastal = clamp01(
        0.10
        + 0.34 * atlantic
        + 0.14 * north
        + 0.06 * east
        + 0.08 * wave_b
        + 0.55 * common_extreme_hotspot
        + 0.11 * azores_hotspot
        + 0.09 * madeira_hotspot
        - 0.06 * interior
    )

    return {
        # Hazard-specific uplift so each band reaches top-end values in some cells.
        "heat": round(clamp01(0.12 + 1.35 * heat), 5),
        "flood": round(clamp01(0.25 + 1.9 * flood), 5),
        "wildfire": round(clamp01(0.14 + 1.45 * wildfire), 5),
        "drought": round(clamp01(0.15 + 1.45 * drought), 5),
        "coastal_storm": round(clamp01(0.30 + 2.0 * coastal), 5),
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
            "title": "Spatial grid of climate-related hazards (synthetic sample)",
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
