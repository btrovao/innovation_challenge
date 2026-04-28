(function () {
  const HAZARD_LABELS = {
    heat: "Heat",
    flood: "Flooding",
    wildfire: "Wildfire",
    drought: "Drought",
    coastal_storm: "Coast / storms",
  };

  const LANE_LABELS = {
    early_warnings: "Early warnings",
    early_action: "Immediate action",
    disaster_preparedness: "Preparedness",
    climate_adaptation: "Climate adaptation",
  };

  const LANE_COLORS = {
    early_warnings: "#2563eb",
    early_action: "#7c3aed",
    disaster_preparedness: "#ea580c",
    climate_adaptation: "#db2777",
  };

  /** Approximate bounds for the Portugal example region */
  const PT_BOUNDS = [
    [36.824083, -9.526571],
    [42.280469, -6.034389],
  ];

  let map;
  let marker;
  let mapReady = false;
  let osmLayerRef = null;
  let gridFootprintLayer = null;
  let hazardLayerControl = null;

  function $(id) {
    return document.getElementById(id);
  }

  function getForm() {
    return {
      ageBand: $("f_ageBand").value,
      sex: $("f_sex").value,
      education: $("f_education").value,
      incomeBand: $("f_incomeBand").value,
      housingType: $("f_housingType").value,
      floorLevel: $("f_floorLevel").value,
      hasAC: $("f_hasAC").checked,
      hasCoolRoomAccess: $("f_hasCoolRoomAccess").checked,
      occupation: $("f_occupation").value,
      outdoorWork: $("f_outdoorWork").checked,
      livesAlone: $("f_livesAlone").checked,
      socialSupport: $("f_socialSupport").value,
      healthChronic: $("f_healthChronic").value,
      mobility: $("f_mobility").value,
      insurance: $("f_insurance").checked,
      digitalAccess: $("f_digitalAccess").value,
    };
  }

  function setForm(f) {
    $("f_ageBand").value = f.ageBand;
    // Sex is required in the UI (no "Prefer not to say" option).
    $("f_sex").value = f.sex || "f";
    $("f_education").value = f.education;
    $("f_incomeBand").value = f.incomeBand;
    $("f_housingType").value = f.housingType;
    $("f_floorLevel").value = f.floorLevel;
    $("f_hasAC").checked = !!f.hasAC;
    $("f_hasCoolRoomAccess").checked = !!f.hasCoolRoomAccess;
    $("f_occupation").value = f.occupation;
    $("f_outdoorWork").checked = !!f.outdoorWork;
    $("f_livesAlone").checked = !!f.livesAlone;
    $("f_socialSupport").value = f.socialSupport;
    $("f_healthChronic").value = f.healthChronic;
    $("f_mobility").value = f.mobility;
    $("f_insurance").checked = !!f.insurance;
    $("f_digitalAccess").value = f.digitalAccess;
  }

  function selectHasValue(selectEl, value) {
    if (!selectEl) return false;
    const opts = selectEl.options || [];
    for (let i = 0; i < opts.length; i++) {
      if (opts[i] && opts[i].value === value) return true;
    }
    return false;
  }

  function validateRequiredSelect(id) {
    const el = $(id);
    if (!el) return { ok: false, id, reason: "missing-element" };
    const v = el.value;
    if (typeof v !== "string" || v.trim() === "") return { ok: false, id, reason: "empty" };
    if (!selectHasValue(el, v)) return { ok: false, id, reason: "invalid" };
    return { ok: true, id };
  }

  function validateQuestionnaire() {
    // All questionnaire fields must be present & valid before computing.
    const required = [
      "f_ageBand",
      "f_sex",
      "f_education",
      "f_incomeBand",
      "f_housingType",
      "f_floorLevel",
      "f_occupation",
      "f_socialSupport",
      "f_healthChronic",
      "f_mobility",
      "f_digitalAccess",
    ];

    for (let i = 0; i < required.length; i++) {
      const r = validateRequiredSelect(required[i]);
      if (!r.ok) return r;
    }
    return { ok: true };
  }

  function municipalityList() {
    return window.PORTUGAL_MVP_DATA.municipalities.list.filter((m) => {
      const [sw, ne] = PT_BOUNDS;
      return m.lat >= sw[0] && m.lat <= ne[0] && m.lon >= sw[1] && m.lon <= ne[1];
    });
  }

  function municipalityById(id) {
    return municipalityList().find((m) => m.id === id);
  }

  function nearestMunicipality(lat, lon) {
    const list = municipalityList();
    let best = list[0];
    let bestD = Infinity;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const d = window.RiskEnginePT.haversineKm(lat, lon, m.lat, m.lon);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return { m: best, distKm: bestD };
  }

  function fillMunicipalities() {
    const sel = $("municipality");
    const list = municipalityList();
    sel.innerHTML = list
      .map((m) => `<option value="${m.id}">${m.name} (${m.district})</option>`)
      .join("");
  }

  function fillProfiles() {
    const sel = $("exampleProfile");
    const ps = window.EXAMPLE_PROFILES.profiles;
    sel.innerHTML =
      '<option value="">Custom profile</option>' +
      ps.map((p) => `<option value="${p.id}">${p.label}</option>`).join("");
  }

  function getLatLonFromInputs() {
    const lat = parseFloat($("lat").value);
    const lon = parseFloat($("lon").value);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon };
  }

  function setMarkerPosition(lat, lon, pan) {
    if (!mapReady || !marker) return;
    marker.setLatLng([lat, lon]);
    $("lat").value = lat.toFixed(5);
    $("lon").value = lon.toFixed(5);
    if (pan) {
      map.panTo([lat, lon], { animate: true });
    }
  }

  function syncDropdownToNearest(lat, lon) {
    const { m } = nearestMunicipality(lat, lon);
    if (m) $("municipality").value = m.id;
  }

  function updateGridFootprintLayer(result) {
    if (!mapReady || !gridFootprintLayer || !map) return;
    gridFootprintLayer.clearLayers();
    const mun = result.municipality;
    const s = mun && mun.climateSampling;
    if (!s || !s.cell_bounds) return;

    const b = s.cell_bounds;
    L.rectangle(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      {
        pane: "gridPane",
        color: "#fbbf24",
        weight: 2,
        fillColor: "#fbbf24",
        fillOpacity: 0.07,
        interactive: false,
      }
    ).addTo(gridFootprintLayer);
  }

  function initMap(climateGrid) {
    const el = $("map");
    if (typeof L === "undefined" || typeof window.HazardMapLayers === "undefined") {
      el.innerHTML =
        '<p class="muted">Map unavailable (Leaflet or layers failed to load). Check your internet connection or enter coordinates manually.</p>';
      return;
    }

    const start = municipalityById("1106") || municipalityList()[0];
    map = L.map("map", {
      minZoom: 5,
      maxZoom: 18,
      scrollWheelZoom: true,
    });

    osmLayerRef = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });
    osmLayerRef.addTo(map);

    map.fitBounds(PT_BOUNDS);

    map.createPane("gridPane");
    map.getPane("gridPane").style.zIndex = "480";

    gridFootprintLayer = L.layerGroup({ pane: "gridPane" });
    gridFootprintLayer.addTo(map);

    if (climateGrid && window.HazardMapLayers.setupLayersFromGrid) {
      const haz = window.HazardMapLayers.setupLayersFromGrid(
        map,
        climateGrid,
        HAZARD_LABELS
      );
      if (haz && haz.namedOverlays) {
        hazardLayerControl = L.control
          .layers({ OpenStreetMap: osmLayerRef }, haz.namedOverlays, {
            collapsed: true,
          })
          .addTo(map);
      }
    }

    marker = L.marker([start.lat, start.lon], {
      draggable: true,
      zIndexOffset: 900,
    }).addTo(map);
    $("lat").value = start.lat.toFixed(5);
    $("lon").value = start.lon.toFixed(5);

    map.on("click", function (e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setMarkerPosition(lat, lng, false);
      syncDropdownToNearest(lat, lng);
    });

    marker.on("dragend", function () {
      const ll = marker.getLatLng();
      $("lat").value = ll.lat.toFixed(5);
      $("lon").value = ll.lng.toFixed(5);
      syncDropdownToNearest(ll.lat, ll.lng);
    });

    $("lat").addEventListener("change", onCoordInputChange);
    $("lon").addEventListener("change", onCoordInputChange);

    fetch("data/downloads/PRT_world_geo_sample.geo.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((geo) => {
        if (!geo || !map) return;
        const outline = L.geoJSON(geo, {
          interactive: false,
          style: {
            color: "#14b8a6",
            weight: 2,
            opacity: 0.85,
            fillOpacity: 0.04,
          },
        });
        outline.addTo(map);
        if (hazardLayerControl) {
          hazardLayerControl.addOverlay(outline, "Portugal outline (sample)");
        }
      })
      .catch(function () {});

    mapReady = true;
  }

  function onCoordInputChange() {
    const p = getLatLonFromInputs();
    if (!p || !mapReady || !marker) return;
    marker.setLatLng([p.lat, p.lon]);
    syncDropdownToNearest(p.lat, p.lon);
    map.panTo([p.lat, p.lon]);
  }

  function onMunicipalityChange() {
    const m = municipalityById($("municipality").value);
    if (!m || !mapReady) return;
    setMarkerPosition(m.lat, m.lon, true);
  }

  function onGeolocate() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setMarkerPosition(lat, lon, true);
        syncDropdownToNearest(lat, lon);
        map.setView([lat, lon], Math.max(map.getZoom(), 11));
      },
      function () {
        alert("Could not get your position. Check permissions.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function isMapMode() {
    return $("locMode_map").checked;
  }

  function pickMeasures(topHazardKeys) {
    const set = new Set(topHazardKeys);
    const all = window.MEASURES.measures;
    const picked = [];
    const lanes = [
      "early_warnings",
      "early_action",
      "disaster_preparedness",
      "climate_adaptation",
    ];
    lanes.forEach((lane) => {
      const inLane = all.filter(
        (m) => m.lane === lane && m.hazards.some((h) => set.has(h))
      );
      inLane.slice(0, 2).forEach((m) => picked.push(m));
    });
    return picked;
  }

  function renderResults(result) {
    const b = window.RiskEnginePT.band(result.overall);
    $("overallScore").textContent = (result.overall * 100).toFixed(0);
    $("overallBand").textContent = b.label;
    $("overallBand").className = "band band--" + b.key;

    // Highlight BI/statistics access after each calculation.
    const biCta = $("biCta");
    if (biCta) biCta.hidden = false;
    const biBtn = $("btnShowBI2");
    if (biBtn) {
      biBtn.classList.remove("btn--pulse");
      // Force reflow so animation restarts reliably.
      void biBtn.offsetWidth;
      biBtn.classList.add("btn--pulse");
      setTimeout(() => {
        try {
          biBtn.classList.remove("btn--pulse");
        } catch (e) {}
      }, 2200);
    }

    const mun = result.municipality;
    const modeHint =
      mun.locationSource === "map"
        ? "Tailored to your coordinates: hazards are sampled from the spatial climate grid."
        : "Tailored to the selected centroid: hazards are sampled from the same spatial grid.";
    $("locName").textContent =
      mun.locationSource === "map"
        ? "Your selected location"
        : mun.name + " · " + mun.district;
    $("locCoords").textContent =
      mun.lat.toFixed(5) +
      "°, " +
      mun.lon.toFixed(5) +
      "° (WGS84) | " +
      modeHint;

    const drivers = $("drivers");
    drivers.innerHTML = `
      <li><strong>Sensitivity (profile):</strong> ${(result.sensitivity * 100).toFixed(0)}%</li>
      <li><strong>Adaptive capacity:</strong> ${(result.adaptiveCapacity * 100).toFixed(0)}%</li>
    `;

    const ph = $("perHazard");
    ph.innerHTML = result.perHazard
      .map(
        (p) => `
      <div class="hazard-block">
        <div class="hazard-row">
          <span class="hazard-name">${HAZARD_LABELS[p.hazard] || p.hazard}</span>
          <div class="hazard-bar-wrap"><div class="hazard-bar" style="width:${p.risk * 100}%"></div></div>
          <span class="hazard-pct">${(p.risk * 100).toFixed(0)}%</span>
        </div>
        <div class="hazard-detail">Local hazard ${(p.hazardScore * 100).toFixed(0)}% · Exposure ${(p.exposure * 100).toFixed(0)}% · Vulnerability ${(p.vulnerability * 100).toFixed(0)}%</div>
      </div>
    `
      )
      .join("");

    const top3 = result.perHazard.slice(0, 3).map((p) => p.hazard);
    const measures = pickMeasures(top3);

    const byLane = {};
    measures.forEach((m) => {
      if (!byLane[m.lane]) byLane[m.lane] = [];
      byLane[m.lane].push(m);
    });

    const anticipatory = $("anticipatory");
    anticipatory.innerHTML = [
      "early_warnings",
      "early_action",
      "disaster_preparedness",
      "climate_adaptation",
    ]
      .map((lane) => {
        const items = byLane[lane] || [];
        const color = LANE_COLORS[lane];
        return `
        <section class="lane-card" style="--lane:${color}">
          <h3 class="lane-title">${LANE_LABELS[lane]}</h3>
          <p class="lane-sub">${lane === "early_warnings" ? "IPMA, APA, Civil Protection, municipality" : ""}</p>
          <ul class="measure-list">
            ${items
              .map(
                (m) =>
                  `<li><strong>${m.title}</strong><br/><span class="muted">${m.desc}</span></li>`
              )
              .join("")}
            ${items.length === 0 ? '<li class="muted">No specific measures for your top risks in this lane. See other lanes.</li>' : ""}
          </ul>
        </section>
      `;
      })
      .join("");

    $("results").hidden = false;
    updateGridFootprintLayer(result);
    $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function compute() {
    if (!window.CLIMATE_GRID) {
      alert(
        "Climate grid not loaded. Run the app through a local HTTP server (e.g. python -m http.server) so data/climate_grids/portugal_climate_grid.json can be fetched."
      );
      return;
    }
    if (typeof window.ClimateGridSampler === "undefined") {
      alert("Grid sampling module unavailable.");
      return;
    }

    const vq = validateQuestionnaire();
    if (!vq.ok) {
      alert("Please complete all questionnaire fields before consulting your risk.");
      try {
        const el = $(vq.id);
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el && el.focus) el.focus({ preventScroll: true });
      } catch (e) {}
      return;
    }

    const form = getForm();
    let lat;
    let lon;
    let name;
    let district;
    let locSource;
    let id;

    if (isMapMode()) {
      const p = getLatLonFromInputs();
      if (!p) {
        alert("Enter valid latitude and longitude or click the map.");
        return;
      }
      lat = p.lat;
      lon = p.lon;
      name = "Your selected location";
      district = "Climate spatial grid";
      locSource = "map";
      id = "grid-point";
    } else {
      const mid = $("municipality").value;
      const m = municipalityById(mid);
      if (!m) {
        alert("Please select a municipality before consulting your risk.");
        try {
          const el = $("municipality");
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
          if (el && el.focus) el.focus({ preventScroll: true });
        } catch (e) {}
        return;
      }
      lat = m.lat;
      lon = m.lon;
      name = m.name;
      district = m.district;
      locSource = "municipality";
      id = m.id;
    }

    const sampled = window.ClimateGridSampler.sampleHazardsAt(
      window.CLIMATE_GRID,
      lat,
      lon
    );
    if (sampled.error) {
      alert(sampled.error);
      return;
    }

    const locationModel = {
      id: id,
      name: name,
      district: district,
      lat: lat,
      lon: lon,
      hazards: sampled.hazards,
      locationSource: locSource,
      climateSampling: sampled.meta,
    };

    const result = window.RiskEnginePT.computeAll(locationModel, form);
    renderResults(result);
    // Prefer server analytics; fall back to browser storage when /api/events is missing (static hosting).
    var analyticsPayload = {
      v: 1,
      ts: new Date().toISOString(),
      loc: {
        id: locationModel.id,
        source: locationModel.locationSource,
        name: locationModel.name,
        district: locationModel.district,
        lat: locationModel.lat,
        lon: locationModel.lon,
      },
      hazards: locationModel.hazards,
      profile: form,
      result: {
        overall: result.overall,
        sensitivity: result.sensitivity,
        adaptiveCapacity: result.adaptiveCapacity,
        perHazard: result.perHazard,
      },
    };
    try {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analyticsPayload),
      })
        .then(function (r) {
          if (r && r.ok) return;
          if (
            window.AnalyticsStore &&
            window.AnalyticsStore.appendClientEvent &&
            window.AnalyticsStore.appendClientEvent(analyticsPayload)
          ) {
            return;
          }
        })
        .catch(function () {
          try {
            if (window.AnalyticsStore && window.AnalyticsStore.appendClientEvent) {
              window.AnalyticsStore.appendClientEvent(analyticsPayload);
            }
          } catch (e2) {}
        });
    } catch (e) {}
  }

  function resetAssessment() {
    // Clear profile selector
    try {
      $("exampleProfile").value = "";
    } catch (e) {}

    // Reset questionnaire selects to their first option
    [
      "f_ageBand",
      "f_sex",
      "f_education",
      "f_incomeBand",
      "f_housingType",
      "f_floorLevel",
      "f_occupation",
      "f_socialSupport",
      "f_healthChronic",
      "f_mobility",
      "f_digitalAccess",
    ].forEach((id) => {
      const el = $(id);
      if (!el || !el.options || el.options.length === 0) return;
      el.value = el.options[0].value;
    });

    // Reset questionnaire checkboxes
    ["f_hasAC", "f_hasCoolRoomAccess", "f_outdoorWork", "f_livesAlone", "f_insurance"].forEach(
      (id) => {
        const el = $(id);
        if (!el) return;
        el.checked = false;
      }
    );

    // Reset location to default municipality (Lisboa) and clear manual coords
    try {
      $("municipality").value = "1106";
    } catch (e) {}
    try {
      const m = municipalityById("1106") || municipalityList()[0];
      if (m) {
        $("lat").value = m.lat.toFixed(5);
        $("lon").value = m.lon.toFixed(5);
        if (mapReady && marker) {
          marker.setLatLng([m.lat, m.lon]);
          try {
            map.panTo([m.lat, m.lon], { animate: true });
          } catch (e) {}
        }
      } else {
        $("lat").value = "";
        $("lon").value = "";
      }
    } catch (e) {}

    // Hide results + BI and clear rendered contents
    try {
      $("results").hidden = true;
      $("biCta").hidden = true;
    } catch (e) {}
    try {
      $("bi").hidden = true;
    } catch (e) {}
    try {
      $("drivers").innerHTML = "";
      $("perHazard").innerHTML = "";
      $("lanes").innerHTML = "";
    } catch (e) {}
    try {
      $("overallScore").textContent = "0";
      $("overallBand").textContent = "Pending";
      $("locName").textContent = "";
      $("locCoords").textContent = "";
    } catch (e) {}

    // Clear grid footprint rectangle (if any)
    try {
      if (gridFootprintLayer) gridFootprintLayer.clearLayers();
    } catch (e) {}

    // Scroll back to questionnaire for a clean restart
    try {
      const sec = $("btnCompute");
      if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {}
  }

  function onProfileChange() {
    const id = $("exampleProfile").value;
    if (!id) return;
    const p = window.EXAMPLE_PROFILES.profiles.find((x) => x.id === id);
    if (!p) return;
    setForm(p.form);
  }

  function init() {
    fillMunicipalities();
    fillProfiles();
    $("btnCompute").addEventListener("click", compute);
    const btnReset = $("btnReset");
    if (btnReset) btnReset.addEventListener("click", resetAssessment);
    $("exampleProfile").addEventListener("change", onProfileChange);
    $("municipality").addEventListener("change", onMunicipalityChange);
    $("btnGeolocate").addEventListener("click", onGeolocate);
    $("municipality").value = "1106";

    // BI dashboard wiring (safe if not present).
    if (window.BIDashboard && typeof window.BIDashboard.bind === "function") {
      try {
        window.BIDashboard.bind();
      } catch (e) {}
    }
    // Stats dashboard open button lives in the results callout.

    fetch("data/climate_grids/portugal_climate_grid.json?v=20260420c")
      .then(function (r) {
        if (!r.ok) throw new Error("grid");
        return r.json();
      })
      .then(function (grid) {
        window.CLIMATE_GRID = grid;
        initMap(grid);
      })
      .catch(function () {
        window.CLIMATE_GRID = null;
        initMap(null);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
