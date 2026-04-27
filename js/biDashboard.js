/**
 * BI-style dashboard for platform-wide analytics events.
 * Fetches from the server API (/api/events) and renders into #bi elements in index.html.
 */
(function (global) {
  function $(id) {
    return document.getElementById(id);
  }

  const PROFILE_FIELDS = [
    { key: "ageBand", label: "Age" },
    { key: "sex", label: "Sex" },
    { key: "education", label: "Education" },
    { key: "incomeBand", label: "Household income" },
    { key: "housingType", label: "Housing type" },
    { key: "floorLevel", label: "Floor level" },
    { key: "hasAC", label: "Air conditioning" },
    { key: "hasCoolRoomAccess", label: "Cool room access" },
    { key: "occupation", label: "Occupation" },
    { key: "outdoorWork", label: "Outdoor work exposure" },
    { key: "livesAlone", label: "Lives alone" },
    { key: "socialSupport", label: "Social support" },
    { key: "healthChronic", label: "Chronic health condition" },
    { key: "mobility", label: "Mobility" },
    { key: "insurance", label: "Multi-risk home insurance" },
    { key: "digitalAccess", label: "Digital access (alerts)" },
  ];

  const RISK_BUCKETS = [
    { key: "0-0.2", label: "0–0.2", a: 0.0, b: 0.2 },
    { key: "0.2-0.4", label: "0.2–0.4", a: 0.2, b: 0.4 },
    { key: "0.4-0.6", label: "0.4–0.6", a: 0.4, b: 0.6 },
    { key: "0.6-0.8", label: "0.6–0.8", a: 0.6, b: 0.8 },
    { key: "0.8-1.0", label: "0.8–1.0", a: 0.8, b: 1.0000001 },
  ];

  function fmtPct(x) {
    if (typeof x !== "number" || Number.isNaN(x)) return "—";
    return (x * 100).toFixed(0) + "%";
  }

  function fmtNum(x) {
    if (typeof x !== "number" || Number.isNaN(x)) return "—";
    return x.toFixed(2);
  }

  function parseTs(ts) {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function dayKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function computeAgg(events) {
    const n = events.length;

    let sumOverall = 0;
    let sumSens = 0;
    let sumAdapt = 0;
    let countWithOverall = 0;

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const overall = e.result && typeof e.result.overall === "number" ? e.result.overall : null;
      if (typeof overall === "number") {
        sumOverall += overall;
        countWithOverall += 1;
      }
      const sens = e.result && typeof e.result.sensitivity === "number" ? e.result.sensitivity : null;
      if (typeof sens === "number") sumSens += sens;
      const adapt =
        e.result && typeof e.result.adaptiveCapacity === "number" ? e.result.adaptiveCapacity : null;
      if (typeof adapt === "number") sumAdapt += adapt;
    }

    const avgOverall = countWithOverall ? sumOverall / countWithOverall : null;
    const avgSens = n ? sumSens / n : null;
    const avgAdapt = n ? sumAdapt / n : null;

    return { n, avgOverall, avgSens, avgAdapt };
  }

  function profileValueToCategory(v) {
    if (v === true) return "Yes";
    if (v === false) return "No";
    if (v == null) return "—";
    return String(v);
  }

  function clamp01(x) {
    if (typeof x !== "number" || Number.isNaN(x)) return null;
    return Math.max(0, Math.min(1, x));
  }

  function bucketIndex01(x01) {
    if (typeof x01 !== "number") return null;
    for (let i = 0; i < RISK_BUCKETS.length; i++) {
      const b = RISK_BUCKETS[i];
      if (x01 >= b.a && x01 < b.b) return i;
    }
    return RISK_BUCKETS.length - 1;
  }

  function emptyBucketCounts() {
    return new Array(RISK_BUCKETS.length).fill(0);
  }

  function riskDictFromEvent(e) {
    const out = {
      overall: clamp01(e && e.result && e.result.overall),
      heat: null,
      flood: null,
      wildfire: null,
      drought: null,
      coastal_storm: null,
    };
    const ph = (e && e.result && e.result.perHazard) || [];
    for (let i = 0; i < ph.length; i++) {
      const r = ph[i];
      if (!r || typeof r.hazard !== "string") continue;
      if (typeof r.risk !== "number") continue;
      if (Object.prototype.hasOwnProperty.call(out, r.hazard)) {
        out[r.hazard] = clamp01(r.risk);
      }
    }
    return out;
  }

  function renderStackedRow(label, counts) {
    const total = counts.reduce((a, b) => a + b, 0) || 0;
    const segs = counts
      .map((c, idx) => {
        const w = total ? (c / total) * 100 : 0;
        const pct = total ? Math.round((c / total) * 100) : 0;
        const bucket = RISK_BUCKETS[idx] ? RISK_BUCKETS[idx].label : "";
        const title = `${bucket}: ${c} (${pct}%)`;
        return `<div class="bi-seg bi-seg--${idx}" style="width:${w}%" title="${title}"></div>`;
      })
      .join("");
    const legend = RISK_BUCKETS.map((b) => `<span class="bi-legend__item">${b.label}</span>`).join(
      ""
    );
    const nums = counts
      .map((c) => `<span class="bi-stackRow__num">${c}</span>`)
      .join("");
    return `
      <div class="bi-stackRow">
        <div class="bi-stackRow__k">${label}</div>
        <div class="bi-stackRow__mid">
          <div class="bi-stackRow__bar" role="img" aria-label="${label} risk intervals">${segs}</div>
          <div class="bi-stackRow__nums" aria-hidden="true">${nums}</div>
        </div>
        <div class="bi-stackRow__v">${total}</div>
        <div class="bi-legend">${legend}</div>
      </div>
    `;
  }

  function computeIntervals(events) {
    const keys = ["overall", "heat", "flood", "wildfire", "drought", "coastal_storm"];
    const out = {};
    keys.forEach((k) => (out[k] = emptyBucketCounts()));
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const rd = riskDictFromEvent(e);
      keys.forEach((k) => {
        const v = rd[k];
        const bi = bucketIndex01(v);
        if (bi == null) return;
        out[k][bi] += 1;
      });
    }
    return out;
  }

  function computeProfileIntervalPlot(events, fieldKey) {
    const byCat = {};
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const p = e.profile || {};
      const cat = profileValueToCategory(p[fieldKey]);
      if (!byCat[cat]) byCat[cat] = emptyBucketCounts();
      const o = clamp01(e && e.result && e.result.overall);
      const bi = bucketIndex01(o);
      if (bi == null) continue;
      byCat[cat][bi] += 1;
    }
    const rows = Object.keys(byCat).map((k) => ({ cat: k, counts: byCat[k] }));
    // Sort categories by total count desc
    rows.sort((a, b) => {
      const ta = a.counts.reduce((x, y) => x + y, 0);
      const tb = b.counts.reduce((x, y) => x + y, 0);
      return tb - ta;
    });
    return rows;
  }

  function render() {
    const sec = $("bi");
    if (sec) sec.setAttribute("data-loading", "1");

    // No filters: fetch a wide window (up to ~10 years) for platform-wide stats.
    return fetch(`/api/events?days=3650`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((all) => {
        const events = Array.isArray(all) ? all : [];
        const agg = computeAgg(events);

        // KPIs
        $("biKpiCount").textContent = String(agg.n);
        $("biKpiAvgOverall").textContent = fmtPct(agg.avgOverall);
        $("biKpiAvgSens").textContent = fmtPct(agg.avgSens);
        $("biKpiAvgAdapt").textContent = fmtPct(agg.avgAdapt);

        // Risk intervals (overall + each hazard)
        const intervals = computeIntervals(events);
        const riskEl = $("biRiskIntervals");
        if (riskEl) {
          riskEl.innerHTML = [
            renderStackedRow("Overall", intervals.overall),
            renderStackedRow("Heat", intervals.heat),
            renderStackedRow("Flood", intervals.flood),
            renderStackedRow("Wildfire", intervals.wildfire),
            renderStackedRow("Drought", intervals.drought),
            renderStackedRow("Coastal storm", intervals.coastal_storm),
          ].join("");
        }

        // Per-questionnaire-item overall distribution
        const plotsEl = $("biProfileIntervalPlots");
        if (plotsEl) {
          plotsEl.innerHTML = PROFILE_FIELDS.map((f) => {
            const rows = computeProfileIntervalPlot(events, f.key);
            const inner =
              rows.length === 0
                ? '<p class="muted" style="margin:0.25rem 0 0">No data yet.</p>'
                : rows
                    .slice(0, 12)
                    .map((r) => renderStackedRow(r.cat, r.counts))
                    .join("");
            const note =
              rows.length > 12
                ? `<p class="muted" style="margin:0.5rem 0 0">Showing top 12 categories by count.</p>`
                : "";
            return `
              <details class="bi-factor" ${f.key === "ageBand" ? "open" : ""}>
                <summary class="bi-factor__summary">${f.label}</summary>
                <div class="bi-factor__body">${inner}${note}</div>
              </details>
            `;
          }).join("");
        }
      })
      .catch(() => {
        // API unavailable or blocked: keep UI stable.
        $("biKpiCount").textContent = "—";
        $("biKpiAvgOverall").textContent = "—";
        $("biKpiAvgSens").textContent = "—";
        $("biKpiAvgAdapt").textContent = "—";
      })
      .finally(() => {
        if (sec) sec.removeAttribute("data-loading");
      });
  }

  function bind() {
    const sec = $("bi");
    // Use event delegation because the open button only appears after results are shown.
    document.addEventListener("click", function (ev) {
      const t = ev && ev.target;
      const btn = t && t.closest ? t.closest("#btnShowBI2") : null;
      if (!btn || !sec) return;
      sec.hidden = !sec.hidden;
      if (!sec.hidden) {
        render();
        // Scroll after layout so the browser "zooms" to the BI frame reliably.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              sec.scrollIntoView({ behavior: "smooth", block: "start" });
            } catch (e) {}
            try {
              sec.classList.remove("bi--focus");
              void sec.offsetWidth;
              sec.classList.add("bi--focus");
              setTimeout(() => sec.classList.remove("bi--focus"), 1400);
            } catch (e) {}
            // Move focus into the dashboard for keyboard + screen readers.
            try {
              const first = document.getElementById("biRangeDays");
              if (first && first.focus) first.focus({ preventScroll: true });
            } catch (e) {}
          });
        });
      }
    });

    // No filters + no local export/import/clear: BI is platform-wide from the server API.

    try {
      global.addEventListener("ccm:analytics_updated", function () {
        // Refresh if dashboard is open
        const sec = $("bi");
        if (sec && !sec.hidden) render();
      });
    } catch (e) {}
  }

  global.BIDashboard = { bind, render };
})(typeof window !== "undefined" ? window : globalThis);

