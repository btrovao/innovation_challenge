/**
 * Client-side fallback store when `/api/events` is unavailable (static hosts like GitHub Pages /
 * plain Vercel static). Same event JSON shape as POST /api/events for BI compatibility.
 */
(function (global) {
  const KEY_EVENTS = "ccm_analytics_events_v1";
  const KEY_SESSION = "ccm_session_id_v1";
  const MAX_EVENTS = 5000;

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
      var k = "__ccm_test__";
      global.localStorage.setItem(k, "1");
      global.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function randomId() {
    return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
  }

  function getSessionId() {
    if (!hasStorage()) return "no-storage";
    var existing = global.localStorage.getItem(KEY_SESSION);
    if (existing) return existing;
    var id = randomId();
    global.localStorage.setItem(KEY_SESSION, id);
    return id;
  }

  /**
   * @param {number} [maxDays] If set, only events whose `ts` falls within the last `maxDays` days.
   */
  function loadEvents(maxDays) {
    if (!hasStorage()) return [];
    var raw = global.localStorage.getItem(KEY_EVENTS);
    var parsed = safeJsonParse(raw, []);
    var arr = Array.isArray(parsed) ? parsed : [];
    if (typeof maxDays === "number" && maxDays > 0) {
      var cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
      arr = arr.filter(function (ev) {
        if (!ev || typeof ev.ts !== "string") return false;
        var ms = new Date(ev.ts).getTime();
        return !Number.isNaN(ms) && ms >= cutoff;
      });
    }
    return arr;
  }

  function saveEvents(events) {
    if (!hasStorage()) return false;
    var s = safeJsonStringify(events);
    if (!s) return false;
    global.localStorage.setItem(KEY_EVENTS, s);
    return true;
  }

  /** Persists one assessment event (same fields as server POST body). */
  function appendClientEvent(payload) {
    if (!payload || typeof payload !== "object") return false;
    var events = [];
    if (!hasStorage()) return false;
    var raw = global.localStorage.getItem(KEY_EVENTS);
    events = safeJsonParse(raw, []);
    if (!Array.isArray(events)) events = [];
    var ev = Object.assign({}, payload);
    if (!ev.sessionId) ev.sessionId = getSessionId();
    events.push(ev);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    var ok = saveEvents(events);
    if (ok) {
      try {
        global.dispatchEvent(
          new CustomEvent("ccm:analytics_updated", { detail: { count: events.length } })
        );
      } catch (e) {}
    }
    return ok;
  }

  global.AnalyticsStore = {
    isAvailable: hasStorage,
    loadEvents: loadEvents,
    appendClientEvent: appendClientEvent,
  };
})(typeof window !== "undefined" ? window : globalThis);
