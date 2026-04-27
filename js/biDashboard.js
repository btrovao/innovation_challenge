/**
 * BI-style dashboard for client-side analytics events.
 * Reads from window.AnalyticsStore and renders into #bi elements in index.html.
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

  function bucketOverall(v) {
    if (v == null) return "unknown";
    if (v < 0.22) return "Low";
    if (v < 0.42) return "Medium";
    if (v < 0.62) return "High";
    return "Very high";
  }

  function computeAgg(events) {
    const n = events.length;
    const byDay = {};
    const bySource = {};
    const byBand = {};

    let sumOverall = 0;
    let sumSens = 0;
    let sumAdapt = 0;
    let countWithOverall = 0;

    let top = [];

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const d = parseTs(e.ts);
      if (d) {
        const k = dayKey(d);
        byDay[k] = (byDay[k] || 0) + 1;
      }
      const src = (e.loc && e.loc.source) || "unknown";
      bySource[src] = (bySource[src] || 0) + 1;

      const overall = e.result && typeof e.result.overall === "number" ? e.result.overall : null;
      const band = bucketOverall(overall);
      byBand[band] = (byBand[band] || 0) + 1;

      if (typeof overall === "number") {
        sumOverall += overall;
        countWithOverall += 1;
      }
      const sens = e.result && typeof e.result.sensitivity === "number" ? e.result.sensitivity : null;
      if (typeof sens === "number") sumSens += sens;
      const adapt =
        e.result && typeof e.result.adaptiveCapacity === "number" ? e.result.adaptiveCapacity : null;
      if (typeof adapt === "number") sumAdapt += adapt;

      // Keep a small list of top events by overall risk.
      if (typeof overall === "number") {
        top.push({ overall, e });
      }
    }

    top.sort((a, b) => b.overall - a.overall);
    top = top.slice(0, 12);

    const avgOverall = countWithOverall ? sumOverall / countWithOverall : null;
    const avgSens = n ? sumSens / n : null;
    const avgAdapt = n ? sumAdapt / n : null;

    return { n, avgOverall, avgSens, avgAdapt, byDay, bySource, byBand, top };
  }

  function renderBars(container, rows, max) {
    container.innerHTML = rows
      .map((r) => {
        const w = max ? Math.round((r.value / max) * 100) : 0;
        const note = r.note ? `<div class="bi-row__note">${r.note}</div>` : "";
        return `
          <div class="bi-row">
            <div class="bi-row__k">${r.label}</div>
            <div class="bi-row__bar"><div class="bi-row__barFill" style="width:${w}%"></div></div>
            <div class="bi-row__v">${r.value}</div>
            ${note}
          </div>
        `;
      })
      .join("");
  }

  function profileValueToCategory(v) {
    if (v === true) return "Yes";
    if (v === false) return "No";
    if (v == null) return "—";
    return String(v);
  }

  function computeProfileBreakdown(events, fieldKey) {
    const buckets = {};
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const p = e.profile || {};
      const cat = profileValueToCategory(p[fieldKey]);
      if (!buckets[cat]) buckets[cat] = { count: 0, sumOverall: 0, nOverall: 0 };
      buckets[cat].count += 1;
      const o = e.result && typeof e.result.overall === "number" ? e.result.overall : null;
      if (typeof o === "number") {
        buckets[cat].sumOverall += o;
        buckets[cat].nOverall += 1;
      }
    }
    return Object.keys(buckets).map((k) => {
      const b = buckets[k];
      const avg = b.nOverall ? b.sumOverall / b.nOverall : null;
      return { category: k, count: b.count, avgOverall: avg };
    });
  }

  function downloadJson(filename, obj) {
    const s = JSON.stringify(obj, null, 2);
    const blob = new Blob([s], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }

  function applyFilters(events) {
    const days = parseInt(($("biRangeDays") && $("biRangeDays").value) || "30", 10);
    const hazardKey = ($("biHazardKey") && $("biHazardKey").value) || "overall";
    const minOverall = parseFloat(($("biMinOverall") && $("biMinOverall").value) || "0");
    const maxOverall = parseFloat(($("biMaxOverall") && $("biMaxOverall").value) || "1");

    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    return events
      .filter((e) => {
        const d = parseTs(e.ts);
        if (!d) return false;
        return d.getTime() >= cutoff;
      })
      .filter((e) => {
        const o = e.result && typeof e.result.overall === "number" ? e.result.overall : null;
        if (typeof o !== "number") return false;
        return o >= minOverall && o <= maxOverall;
      })
      .map((e) => {
        // computed metric to sort by
        let metric = null;
        if (hazardKey === "overall") {
          metric = e.result && typeof e.result.overall === "number" ? e.result.overall : null;
        } else {
          const ph = (e.result && e.result.perHazard) || [];
          const hit = ph.find((x) => x.hazard === hazardKey);
          metric = hit && typeof hit.risk === "number" ? hit.risk : null;
        }
        return { e, metric };
      })
      .filter((x) => typeof x.metric === "number");
  }

  function render() {
    if (!global.AnalyticsStore) return;
    const all = global.AnalyticsStore.loadEvents();
    const filtered = applyFilters(all);
    const events = filtered.map((x) => x.e);
    const agg = computeAgg(events);

    // KPIs
    $("biKpiCount").textContent = String(agg.n);
    $("biKpiAvgOverall").textContent = fmtPct(agg.avgOverall);
    $("biKpiAvgSens").textContent = fmtPct(agg.avgSens);
    $("biKpiAvgAdapt").textContent = fmtPct(agg.avgAdapt);

    // Bands
    const bandRows = Object.keys(agg.byBand)
      .map((k) => ({ label: k, value: agg.byBand[k] }))
      .sort((a, b) => b.value - a.value);
    const bandMax = bandRows.length ? bandRows[0].value : 0;
    renderBars($("biBands"), bandRows, bandMax);

    // Sources
    const srcRows = Object.keys(agg.bySource)
      .map((k) => ({ label: k, value: agg.bySource[k] }))
      .sort((a, b) => b.value - a.value);
    const srcMax = srcRows.length ? srcRows[0].value : 0;
    renderBars($("biSources"), srcRows, srcMax);

    // Timeline (last N days)
    const dayKeys = Object.keys(agg.byDay).sort();
    const last = dayKeys.slice(-14);
    const tRows = last.map((k) => ({ label: k.slice(5), value: agg.byDay[k] }));
    const tMax = tRows.reduce((m, r) => Math.max(m, r.value), 0);
    renderBars($("biTimeline"), tRows, tMax);

    // Top events table
    const top = agg.top;
    $("biTop").innerHTML = top
      .map((t) => {
        const e = t.e;
        const loc = e.loc || {};
        const overall = e.result && typeof e.result.overall === "number" ? e.result.overall : null;
        const d = parseTs(e.ts);
        const ts = d ? d.toLocaleString() : e.ts;
        const lat = typeof loc.lat === "number" ? loc.lat.toFixed(4) : "—";
        const lon = typeof loc.lon === "number" ? loc.lon.toFixed(4) : "—";
        return `
          <div class="bi-table__row">
            <div class="bi-table__cell bi-mono">${ts}</div>
            <div class="bi-table__cell">${loc.source || "—"}</div>
            <div class="bi-table__cell">${loc.name || "—"}</div>
            <div class="bi-table__cell bi-mono">${lat}, ${lon}</div>
            <div class="bi-table__cell bi-right"><strong>${fmtPct(overall)}</strong></div>
            <div class="bi-table__cell bi-right bi-mono">${fmtNum(e.hazards && e.hazards.heat)}</div>
            <div class="bi-table__cell bi-right bi-mono">${fmtNum(e.hazards && e.hazards.flood)}</div>
            <div class="bi-table__cell bi-right bi-mono">${fmtNum(e.hazards && e.hazards.wildfire)}</div>
            <div class="bi-table__cell bi-right bi-mono">${fmtNum(e.hazards && e.hazards.drought)}</div>
            <div class="bi-table__cell bi-right bi-mono">${fmtNum(e.hazards && e.hazards.coastal_storm)}</div>
          </div>
        `;
      })
      .join("");

    // Profile breakdown
    const profileKeyEl = $("biProfileKey");
    const profileSortEl = $("biProfileSort");
    const profileKey = profileKeyEl ? profileKeyEl.value : "ageBand";
    const sortMode = profileSortEl ? profileSortEl.value : "count";
    const dist = computeProfileBreakdown(events, profileKey);
    dist.sort((a, b) => {
      if (sortMode === "avgOverall") {
        const av = typeof a.avgOverall === "number" ? a.avgOverall : -1;
        const bv = typeof b.avgOverall === "number" ? b.avgOverall : -1;
        return bv - av;
      }
      return b.count - a.count;
    });
    const rows = dist.map((d) => ({
      label: d.category,
      value: d.count,
      note: `Avg overall ${fmtPct(d.avgOverall)}`,
    }));
    const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
    renderBars($("biProfileDist"), rows, max);
  }

  function bind() {
    const btnShow = $("btnShowBI2");
    const sec = $("bi");
    if (btnShow && sec) {
      btnShow.addEventListener("click", function () {
        sec.hidden = !sec.hidden;
        if (!sec.hidden) {
          render();
          sec.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    ["biRangeDays", "biHazardKey", "biMinOverall", "biMaxOverall"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", render);
      el.addEventListener("input", render);
    });

    // Populate profile fields selector
    const pf = $("biProfileKey");
    if (pf) {
      pf.innerHTML = PROFILE_FIELDS.map((f) => `<option value="${f.key}">${f.label}</option>`).join(
        ""
      );
      if (!pf.value) pf.value = PROFILE_FIELDS[0].key;
      pf.addEventListener("change", render);
    }
    const ps = $("biProfileSort");
    if (ps) {
      ps.addEventListener("change", render);
    }

    const btnExport = $("btnExportAnalytics");
    if (btnExport) {
      btnExport.addEventListener("click", function () {
        if (!global.AnalyticsStore) return;
        const data = global.AnalyticsStore.exportJson();
        downloadJson("climate-change-me_analytics.json", data);
      });
    }

    const importEl = $("biImportFile");
    if (importEl) {
      importEl.addEventListener("change", function () {
        const file = importEl.files && importEl.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          try {
            const parsed = JSON.parse(String(reader.result || "[]"));
            if (!global.AnalyticsStore || !global.AnalyticsStore.importMerge) return;
            const r = global.AnalyticsStore.importMerge(parsed);
            if (!r || !r.ok) {
              alert("Import failed. Please select a valid exported analytics JSON file.");
              return;
            }
            alert(`Imported ${r.added} new events. Total events: ${r.total}.`);
            render();
          } catch (e) {
            alert("Import failed. Please select a valid exported analytics JSON file.");
          } finally {
            // allow re-importing the same file
            importEl.value = "";
          }
        };
        reader.onerror = function () {
          alert("Could not read the selected file.");
          importEl.value = "";
        };
        reader.readAsText(file);
      });
    }

    const btnClear = $("btnClearAnalytics");
    if (btnClear) {
      btnClear.addEventListener("click", function () {
        if (!global.AnalyticsStore) return;
        const ok = confirm("Clear local analytics events for this browser?");
        if (!ok) return;
        global.AnalyticsStore.clear();
        render();
      });
    }

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

