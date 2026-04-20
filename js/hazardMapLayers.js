/**
 * Map overlays: hazard layers from the same gridded spatial database used in ClimateGridSampler.
 * Dots = cell centres (subsampled for performance).
 */
(function (global) {
  var KEYS = ["heat", "flood", "wildfire", "drought", "coastal_storm"];

  function colorFor01(t) {
    t = Math.max(0, Math.min(1, t));
    var h = (1 - t) * 118;
    return "hsl(" + h + ", 70%, 42%)";
  }

  /** ~target markers per layer */
  function computeStep(meta) {
    var n = meta.nrows * meta.ncols;
    var s = Math.max(1, Math.floor(Math.sqrt(n / 850)));
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
        var cm = L.circleMarker([lat, lon], {
          pane: "hazardPane",
          radius: 4 + v * 10,
          stroke: true,
          color: "rgba(15,23,42,0.75)",
          weight: 1,
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
