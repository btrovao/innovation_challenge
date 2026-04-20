/**
 * Sample hazard bands from a regular lat/lon climate grid (spatial database in JSON).
 * Uses bilinear interpolation — same family of operation as GIS sample on raster stack.
 */
(function (global) {
  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  function sampleBand(band2d, lat, lon, meta) {
    var south = meta.south;
    var north = meta.north;
    var west = meta.west;
    var east = meta.east;
    var dy = meta.dy;
    var dx = meta.dx;
    var nrows = meta.nrows;
    var ncols = meta.ncols;

    var la = clamp(lat, south, north);
    var lo = clamp(lon, west, east);

    var fr = (la - south) / dy;
    var fc = (lo - west) / dx;
    var i0 = Math.floor(fr);
    var j0 = Math.floor(fc);
    if (i0 < 0) i0 = 0;
    if (j0 < 0) j0 = 0;
    if (i0 >= nrows - 1) i0 = nrows - 2;
    if (j0 >= ncols - 1) j0 = ncols - 2;

    var i1 = i0 + 1;
    var j1 = j0 + 1;
    var ty = fr - i0;
    var tx = fc - j0;

    var v00 = band2d[i0][j0];
    var v01 = band2d[i0][j1];
    var v10 = band2d[i1][j0];
    var v11 = band2d[i1][j1];

    var v0 = (1 - tx) * v00 + tx * v01;
    var v1 = (1 - tx) * v10 + tx * v11;
    var v = (1 - ty) * v0 + ty * v1;
    return clamp(v, 0, 1);
  }

  var HAZARD_KEYS = ["heat", "flood", "wildfire", "drought", "coastal_storm"];

  /**
   * @returns {{ hazards: Record<string,number>, meta: object } | { error: string, outside?: boolean }}
   */
  function sampleHazardsAt(grid, lat, lon) {
    if (!grid || !grid.bands || !grid.meta) {
      return { error: "Climate grid unavailable." };
    }
    var meta = grid.meta;
    if (
      lat < meta.south ||
      lat > meta.north ||
      lon < meta.west ||
      lon > meta.east
    ) {
      return {
        error:
          "The point is outside the loaded spatial grid extent (" +
          meta.south +
          "°–" +
          meta.north +
          "° lat, " +
          meta.west +
          "°–" +
          meta.east +
          "° lon).",
        outside: true,
      };
    }

    var hazards = {};
    for (var i = 0; i < HAZARD_KEYS.length; i++) {
      var k = HAZARD_KEYS[i];
      var b = grid.bands[k];
      hazards[k] = b ? sampleBand(b, lat, lon, meta) : 0;
    }

    var fr = (lat - meta.south) / meta.dy;
    var fc = (lon - meta.west) / meta.dx;
    var i0 = Math.floor(fr);
    var j0 = Math.floor(fc);
    if (i0 < 0) i0 = 0;
    if (j0 < 0) j0 = 0;
    if (i0 >= meta.nrows - 1) i0 = meta.nrows - 2;
    if (j0 >= meta.ncols - 1) j0 = meta.ncols - 2;

    var lat0 = meta.south + i0 * meta.dy;
    var lat1 = meta.south + (i0 + 1) * meta.dy;
    var lon0 = meta.west + j0 * meta.dx;
    var lon1 = meta.west + (j0 + 1) * meta.dx;

    return {
      hazards: hazards,
      meta: {
        method: "bilinear",
        spatial_database: "gridded_climate_stack",
        hazard_keys: HAZARD_KEYS.slice(),
        grid_dy_deg: meta.dy,
        grid_dx_deg: meta.dx,
        cell_i0: i0,
        cell_j0: j0,
        bilinear_t_row: fr - i0,
        bilinear_t_col: fc - j0,
        cell_bounds: {
          south: lat0,
          north: lat1,
          west: lon0,
          east: lon1,
        },
        grid_title: meta.title || "",
        methodology: meta.methodology || meta.methodology_pt || "",
      },
    };
  }

  global.ClimateGridSampler = {
    HAZARD_KEYS: HAZARD_KEYS,
    sampleBand: sampleBand,
    sampleHazardsAt: sampleHazardsAt,
  };
})(typeof window !== "undefined" ? window : globalThis);
