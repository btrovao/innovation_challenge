/**
 * Portugal MVP — risk model: Risk_h ≈ Hazard_h × Exposure_h × Vulnerability_h
 * Vulnerability = w_s × Sensitivity + w_a × (1 - AdaptiveCapacity)
 */
(function (global) {
  const W_S = 0.55;
  const W_A = 0.45;

  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  function sensitivity(form) {
    let s = 0.32;
    if (form.ageBand === "65+") s += 0.22;
    else if (form.ageBand === "50-64") s += 0.08;
    else if (form.ageBand === "18-34") s -= 0.05;
    if (form.healthChronic === "respiratory") s += 0.16;
    if (form.healthChronic === "cardiovascular") s += 0.12;
    if (form.healthChronic === "none") s -= 0.06;
    if (form.mobility === "limited") s += 0.12;
    if (form.outdoorWork) s += 0.12;
    if (form.livesAlone) s += 0.05;
    return clamp(s, 0, 1);
  }

  function adaptiveCapacity(form) {
    let a = 0.48;
    if (form.incomeBand === "high") a += 0.14;
    if (form.incomeBand === "low") a -= 0.14;
    if (form.incomeBand === "medium") a += 0.02;
    if (form.education === "higher") a += 0.1;
    if (form.education === "basic") a -= 0.08;
    if (form.insurance) a += 0.08;
    if (form.socialSupport === "high") a += 0.12;
    if (form.socialSupport === "low") a -= 0.12;
    if (form.digitalAccess === "good") a += 0.08;
    if (form.digitalAccess === "basic") a -= 0.05;
    if (form.hasAC) a += 0.12;
    if (form.hasCoolRoomAccess) a += 0.06;
    return clamp(a, 0, 1);
  }

  function exposureHeat(form) {
    let e = 0.38;
    if (!form.hasAC) e += 0.32;
    if (form.outdoorWork) e += 0.18;
    if (form.ageBand === "65+") e += 0.08;
    if (form.floorLevel === "high") e += 0.06;
    if (form.housingType === "house" && form.floorLevel === "ground") e += 0.04;
    return clamp(e, 0, 1);
  }

  function exposureFlood(form) {
    let e = 0.35;
    if (form.floorLevel === "ground") e += 0.42;
    else if (form.floorLevel === "low") e += 0.22;
    else if (form.floorLevel === "mid") e += 0.08;
    if (form.mobility === "limited") e += 0.08;
    return clamp(e, 0, 1);
  }

  function exposureWildfire(form) {
    let e = 0.35;
    if (form.occupation === "rural") e += 0.28;
    if (form.outdoorWork) e += 0.15;
    if (form.housingType === "house") e += 0.12;
    return clamp(e, 0, 1);
  }

  function exposureDrought(form) {
    let e = 0.4;
    if (form.incomeBand === "low") e += 0.12;
    if (form.occupation === "rural" || form.occupation === "outdoor") e += 0.1;
    return clamp(e, 0, 1);
  }

  function exposureCoastal(form) {
    let e = 0.4;
    if (form.floorLevel === "ground" || form.floorLevel === "low") e += 0.18;
    return clamp(e, 0, 1);
  }

  const EXPOSURE = {
    heat: exposureHeat,
    flood: exposureFlood,
    wildfire: exposureWildfire,
    drought: exposureDrought,
    coastal_storm: exposureCoastal,
  };

  function vulnerability(sens, adapt) {
    return clamp(W_S * sens + W_A * (1 - adapt), 0, 1);
  }

  function riskForHazard(hazardKey, hazardValue, form) {
    const expFn = EXPOSURE[hazardKey] || (() => 0.5);
    const exp = expFn(form);
    const sens = sensitivity(form);
    const adapt = adaptiveCapacity(form);
    const vuln = vulnerability(sens, adapt);
    const r = hazardValue * exp * vuln;
    return {
      hazard: hazardKey,
      hazardScore: hazardValue,
      exposure: exp,
      sensitivity: sens,
      adaptiveCapacity: adapt,
      vulnerability: vuln,
      risk: clamp(r, 0, 1),
    };
  }

  function computeAll(municipality, form) {
    const hazards = municipality.hazards || {};
    const keys = Object.keys(hazards);
    const perHazard = keys.map((k) => riskForHazard(k, hazards[k], form));
    perHazard.sort((a, b) => b.risk - a.risk);
    const weights = perHazard.map((p) => p.risk);
    const sumW = weights.reduce((a, b) => a + b, 0) || 1;
    const overall = perHazard.reduce((acc, p, i) => acc + (p.risk * weights[i]) / sumW, 0);
    return {
      municipality,
      perHazard,
      overall: clamp(overall, 0, 1),
      sensitivity: sensitivity(form),
      adaptiveCapacity: adaptiveCapacity(form),
    };
  }

  /** Earth radius in km */
  const R_EARTH_KM = 6371;

  function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R_EARTH_KM * c;
  }

  function band(score) {
    if (score < 0.22) return { key: "low", label: "Low" };
    if (score < 0.42) return { key: "medium", label: "Medium" };
    if (score < 0.62) return { key: "high", label: "High" };
    return { key: "very_high", label: "Very high" };
  }

  global.RiskEnginePT = {
    computeAll,
    band,
    sensitivity,
    adaptiveCapacity,
    haversineKm,
  };
})(typeof window !== "undefined" ? window : globalThis);
