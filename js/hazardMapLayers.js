/**
 * Map overlays: hazard layers from the same gridded spatial database used in ClimateGridSampler.
 * Dots = cell centres (subsampled for performance).
 */
(function (global) {
  var KEYS = ["heat", "flood", "wildfire", "drought", "coastal_storm"];
  // Mainland Portugal polygon (WGS84), used to mask rectangular grid visuals.
  var MAINLAND_PORTUGAL_RING = [
    [-9.034818, 41.880571],
    [-8.671946, 42.134689],
    [-8.263857, 42.280469],
    [-8.013175, 41.790886],
    [-7.422513, 41.792075],
    [-7.251309, 41.918346],
    [-6.668606, 41.883387],
    [-6.389088, 41.381815],
    [-6.851127, 41.111083],
    [-6.86402, 40.330872],
    [-7.026413, 40.184524],
    [-7.066592, 39.711892],
    [-7.498632, 39.629571],
    [-7.098037, 39.030073],
    [-7.374092, 38.373059],
    [-7.029281, 38.075764],
    [-7.166508, 37.803894],
    [-7.537105, 37.428904],
    [-7.453726, 37.097788],
    [-7.855613, 36.838269],
    [-8.382816, 36.97888],
    [-8.898857, 36.868809],
    [-8.746101, 37.651346],
    [-8.839998, 38.266243],
    [-9.287464, 38.358486],
    [-9.526571, 38.737429],
    [-9.446989, 39.392066],
    [-9.048305, 39.755093],
    [-8.977353, 40.159306],
    [-8.768684, 40.760639],
    [-8.790853, 41.184334],
    [-8.990789, 41.543459],
    [-9.034818, 41.880571],
  ];

  function colorFor01(t) {
    t = Math.max(0, Math.min(1, t));
    var h = (1 - t) * 118;
    return "hsl(" + h + ", 70%, 42%)";
  }

  function pointInRing(lon, lat, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0];
      var yi = ring[i][1];
      var xj = ring[j][0];
      var yj = ring[j][1];
      var intersects =
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function isInMainlandPortugal(lat, lon) {
    return pointInRing(lon, lat, MAINLAND_PORTUGAL_RING);
  }

  /** ~target markers per layer */
  function computeStep(meta) {
    var n = meta.nrows * meta.ncols;
    // Denser visualisation: keep marker size small, but draw many more points.
    var s = Math.max(1, Math.floor(Math.sqrt(n / 7000)));
    return s;
  }

  function buildGroupFromGrid(grid, hazardKey) {
    var g = L.layerGroup();
    var meta = grid.meta;
    var band = grid.bands[hazardKey];
    if (!band) return g;
    var step = computeStep(meta);
    var nrows = meta.nrows;
    var ncols = meta.ncols;
    var dy = meta.dy;
    var dx = meta.dx;
    var south = meta.south;
    var west = meta.west;

    for (var i = 0; i < nrows; i += step) {
      for (var j = 0; j < ncols; j += step) {
        var v = band[i][j];
        var lat = south + i * dy + dy * 0.5;
        var lon = west + j * dx + dx * 0.5;
        if (!isInMainlandPortugal(lat, lon)) continue;
        var cm = L.circleMarker([lat, lon], {
          pane: "hazardPane",
          radius: 1.2 + v * 3.0,
          stroke: true,
          color: "rgba(15,23,42,0.75)",
          weight: 1.2,
          fillColor: colorFor01(v),
          fillOpacity: 0.78,
          interactive: false,
        });
        g.addLayer(cm);
      }
    }
    return g;
  }

  function addLegend(map) {
    var Legend = L.control({ position: "bottomleft" });
    Legend.onAdd = function () {
      var d = L.DomUtil.create("div", "map-layer-legend leaflet-bar");
      d.innerHTML =
        '<div class="map-layer-legend__inner">' +
        "<strong>Local hazard index (0–1)</strong>" +
        '<div class="legend-gradient" aria-hidden="true"></div>' +
        '<div class="legend-labels"><span>Low</span><span>High</span></div>' +
        '<p class="legend-note">Layers from the <strong>spatial grid</strong> (JSON database). Point risk uses <strong>bilinear</strong> sampling on the same grid — as with climate-model rasters.</p>' +
        "</div>";
      return d;
    };
    Legend.addTo(map);
  }

  /**
   * @param {L.Map} map
   * @param {object} grid full CLIMATE_GRID document
   * @param {Record<string,string>} hazardLabels
   */
  function setupLayersFromGrid(map, grid, hazardLabels) {
    if (!grid || !grid.bands || !grid.meta) {
      return null;
    }

    map.createPane("hazardPane");
    map.getPane("hazardPane").style.zIndex = "450";

    var groupsByKey = {};
    var namedOverlays = {};

    for (var h = 0; h < KEYS.length; h++) {
      var key = KEYS[h];
      groupsByKey[key] = buildGroupFromGrid(grid, key);
      namedOverlays["Hazard — " + hazardLabels[key]] = groupsByKey[key];
    }

    addLegend(map);

    return {
      KEYS: KEYS,
      groupsByKey: groupsByKey,
      namedOverlays: namedOverlays,
      colorFor01: colorFor01,
    };
  }

  global.HazardMapLayers = {
    setupLayersFromGrid: setupLayersFromGrid,
    KEYS: KEYS,
    colorFor01: colorFor01,
  };
})(typeof window !== "undefined" ? window : globalThis);
