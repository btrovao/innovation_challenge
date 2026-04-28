const urlmod = require("url");

/**
 * Vercel Serverless Function — shared analytics store for production.
 *
 * Local dev continues to use `python server.py` (SQLite `analytics.db`).
 * On Vercel, static hosting does not run `server.py`; this handler implements
 * the same endpoints so `/api/events` exists at runtime.
 *
 * Storage: Redis list via Upstash-compatible REST env vars:
 * - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (Upstash dashboard), or
 * - KV_REST_API_URL / KV_REST_API_TOKEN (Vercel KV / migrated stores)
 */

const LIST_KEY = "ccm_analytics_events_v1";

function hasRedisEnv() {
  const u =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.STORAGE_KV_REST_API_URL;
  const t =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.STORAGE_KV_REST_API_TOKEN;
  return !!(u && t);
}

function getRedis() {
  try {
    const { Redis } = require("@upstash/redis");
    return Redis.fromEnv();
  } catch (e) {
    return null;
  }
}

function getQuery(req) {
  try {
    const parsed = urlmod.parse(req.url || "", true);
    return parsed.query || {};
  } catch (e) {
    return {};
  }
}

function parseDays(query) {
  let days = 3650;
  try {
    const raw =
      query && query.days !== undefined && query.days !== null ? query.days : "3650";
    const first = Array.isArray(raw) ? raw[0] : raw;
    days = parseInt(String(first || "3650"), 10);
  } catch (e) {}
  if (!Number.isFinite(days)) days = 3650;
  return Math.max(1, Math.min(days, 3650));
}

module.exports = async function handler(req, res) {
  const sendJson = function (status, body) {
    if (typeof res.status === "function" && typeof res.json === "function") {
      return res.status(status).json(body);
    }
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const method = (req.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (typeof res.status === "function") return res.status(204).end();
    res.statusCode = 204;
    return res.end();
  }

  if (!hasRedisEnv()) {
    if (method === "GET") return sendJson(200, []);
    if (method === "POST")
      return sendJson(503, {
        ok: false,
        error: "analytics_not_configured",
        hint: "Add Upstash Redis or Vercel KV env vars (REST URL + token) for production BI.",
      });
    return sendJson(405, { error: "method_not_allowed" });
  }

  const redis = getRedis();
  if (!redis) {
    if (method === "GET") return sendJson(200, []);
    return sendJson(503, { ok: false, error: "redis_module_missing" });
  }

  try {
    if (method === "POST") {
      let payload =
        req.body && typeof req.body === "object" ? req.body : null;
      if (!payload) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString("utf8");
        try {
          payload = JSON.parse(raw || "{}");
        } catch (e) {
          payload = {};
        }
      }
      const line = JSON.stringify(payload || {});
      await redis.lpush(LIST_KEY, line);
      await redis.ltrim(LIST_KEY, 0, 4999);
      return sendJson(200, { ok: true });
    }

    if (method === "GET") {
      const days = parseDays(getQuery(req));
      const cutoff =
        Date.now() - days * 24 * 60 * 60 * 1000;

      const raw = await redis.lrange(LIST_KEY, 0, 4999);
      const out = [];
      if (Array.isArray(raw)) {
        for (let i = 0; i < raw.length; i++) {
          try {
            const ev =
              typeof raw[i] === "string" ? JSON.parse(raw[i]) : raw[i];
            const ts = ev && ev.ts;
            const ms = ts ? new Date(ts).getTime() : NaN;
            if (!Number.isNaN(ms) && ms >= cutoff) out.push(ev);
          } catch (e) {}
        }
      }
      return sendJson(200, out);
    }

    return sendJson(405, { error: "method_not_allowed" });
  } catch (e) {
    console.error(e);
    return sendJson(500, { ok: false, error: "redis_failed" });
  }
};
