/**
 * Lightweight client-side analytics log for risk computations.
 * Stores events in localStorage (MVP-friendly, no backend).
 *
 * Schema (v1):
 *  - ts: ISO timestamp
 *  - sessionId: random id persisted in localStorage
 *  - loc: { id, source, name, district, lat, lon }
 *  - hazards: { heat, flood, wildfire, drought, coastal_storm } (0..1)
 *  - profile: form inputs used in compute
 *  - result: { overall, sensitivity, adaptiveCapacity, perHazard: [{hazard, risk, hazardScore, exposure, vulnerability}] }
 *  - sampling: ClimateGridSampler meta (cell bounds, weights, etc.)
 */
(function (global) {
  const KEY_EVENTS = "ccm_analytics_events_v1";
  const KEY_SESSION = "ccm_session_id_v1";
  const MAX_EVENTS = 5000;

  function nowIso() {
    return new Date().toISOString();
  }

  function safeJsonParse(s, fallback) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return fallback;
    }
  }

  function safeJsonStringify(obj) {
    try {
      return JSON.stringify(obj);
    } catch (e) {
      return null;
    }
  }

  function hasStorage() {
    try {
      const k = "__ccm_test__";
      global.localStorage.setItem(k, "1");
      global.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function randomId() {
    // Short, non-guessable enough for session grouping in a demo.
    return (
      Math.random().toString(16).slice(2) +
      "-" +
      Math.random().toString(16).slice(2) +
      "-" +
      Date.now().toString(16)
    );
  }

  function getSessionId() {
    if (!hasStorage()) return "no-storage";
    const existing = global.localStorage.getItem(KEY_SESSION);
    if (existing) return existing;
    const id = randomId();
    global.localStorage.setItem(KEY_SESSION, id);
    return id;
  }

  function loadEvents() {
    if (!hasStorage()) return [];
    const raw = global.localStorage.getItem(KEY_EVENTS);
    if (!raw) return [];
    const parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveEvents(events) {
    if (!hasStorage()) return false;
    const s = safeJsonStringify(events);
    if (!s) return false;
    global.localStorage.setItem(KEY_EVENTS, s);
    return true;
  }

  function normalizeHazards(hazards) {
    const out = {};
    const keys = ["heat", "flood", "wildfire", "drought", "coastal_storm"];
    keys.forEach((k) => {
      const v = hazards && typeof hazards[k] === "number" ? hazards[k] : 0;
      out[k] = Math.max(0, Math.min(1, v));
    });
    return out;
  }

  function toEvent(locationModel, profileForm, result) {
    return {
      v: 1,
      ts: nowIso(),
      sessionId: getSessionId(),
      loc: {
        id: locationModel && locationModel.id,
        source: locationModel && locationModel.locationSource,
        name: locationModel && locationModel.name,
        district: locationModel && locationModel.district,
        lat: locationModel && typeof locationModel.lat === "number" ? locationModel.lat : null,
        lon: locationModel && typeof locationModel.lon === "number" ? locationModel.lon : null,
      },
      hazards: normalizeHazards(locationModel && locationModel.hazards),
      profile: profileForm || {},
      result: {
        overall: result && typeof result.overall === "number" ? result.overall : null,
        sensitivity: result && typeof result.sensitivity === "number" ? result.sensitivity : null,
        adaptiveCapacity:
          result && typeof result.adaptiveCapacity === "number" ? result.adaptiveCapacity : null,
        perHazard: (result && result.perHazard) || [],
      },
      sampling: (locationModel && locationModel.climateSampling) || null,
    };
  }

  function logComputation(locationModel, profileForm, result) {
    const ev = toEvent(locationModel, profileForm, result);
    const events = loadEvents();
    events.push(ev);
    if (events.length > MAX_EVENTS) {
      events.splice(0, events.length - MAX_EVENTS);
    }
    const ok = saveEvents(events);
    if (ok) {
      try {
        global.dispatchEvent(new CustomEvent("ccm:analytics_updated", { detail: { count: events.length } }));
      } catch (e) {}
    }
    return ok;
  }

  function clear() {
    if (!hasStorage()) return false;
    global.localStorage.removeItem(KEY_EVENTS);
    try {
      global.dispatchEvent(new CustomEvent("ccm:analytics_updated", { detail: { count: 0 } }));
    } catch (e) {}
    return true;
  }

  function exportJson() {
    return loadEvents();
  }

  function fingerprint(ev) {
    // Stable-ish key for dedupe when importing/exporting across sessions.
    const loc = (ev && ev.loc) || {};
    const haz = (ev && ev.hazards) || {};
    const res = (ev && ev.result) || {};
    return [
      ev && ev.ts,
      ev && ev.sessionId,
      loc.id,
      loc.source,
      loc.lat,
      loc.lon,
      res.overall,
      haz.heat,
      haz.flood,
      haz.wildfire,
      haz.drought,
      haz.coastal_storm,
    ].join("|");
  }

  function importMerge(importedEvents) {
    if (!hasStorage()) return { ok: false, added: 0, total: 0, error: "no-storage" };
    if (!Array.isArray(importedEvents))
      return { ok: false, added: 0, total: loadEvents().length, error: "invalid-format" };

    const current = loadEvents();
    const seen = new Set(current.map(fingerprint));
    let added = 0;

    for (let i = 0; i < importedEvents.length; i++) {
      const ev = importedEvents[i];
      if (!ev || typeof ev !== "object") continue;
      if (typeof ev.ts !== "string") continue;
      const key = fingerprint(ev);
      if (seen.has(key)) continue;
      seen.add(key);
      current.push(ev);
      added += 1;
    }

    if (current.length > MAX_EVENTS) {
      current.splice(0, current.length - MAX_EVENTS);
    }

    const ok = saveEvents(current);
    if (ok) {
      try {
        global.dispatchEvent(
          new CustomEvent("ccm:analytics_updated", { detail: { count: current.length } })
        );
      } catch (e) {}
    }
    return { ok, added, total: current.length };
  }

  global.AnalyticsStore = {
    isAvailable: hasStorage,
    loadEvents,
    logComputation,
    clear,
    exportJson,
    importMerge,
    getSessionId,
  };
})(typeof window !== "undefined" ? window : globalThis);

