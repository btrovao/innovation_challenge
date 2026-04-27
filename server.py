"""
Minimal server for Climate Change‑Me (static files + global analytics API).

Why this exists:
- A browser-only (localStorage) BI dashboard only shows per-device logs.
- Platform statistics must aggregate across all requests -> requires a shared store.

This server:
- Serves the static app (index.html, js/, data/, etc.)
- Provides a tiny API:
  - POST /api/events  -> store an assessment event (JSON)
  - GET  /api/events?days=30 -> return recent events (JSON array)

Storage:
- SQLite file `analytics.db` in the repo root.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
import socket
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse


DB_PATH = os.path.join(os.path.dirname(__file__), "analytics.db")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          created_utc TEXT NOT NULL,
          payload_json TEXT NOT NULL
        )
        """
    )
    return con


def _read_json(handler: SimpleHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("content-length", "0") or "0")
    raw = handler.rfile.read(length) if length > 0 else b"{}"
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return {}


class Handler(SimpleHTTPRequestHandler):
    # Avoid caching during iteration
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self) -> None:
        u = urlparse(self.path)
        if u.path != "/api/events":
            self.send_error(404)
            return

        payload = _read_json(self)
        if not isinstance(payload, dict):
            self.send_error(400, "invalid json")
            return

        # Store server-side timestamp and keep payload (including client ts if present).
        created = _utc_now_iso()
        payload_json = json.dumps(payload, ensure_ascii=False)

        try:
            con = _db()
            with con:
                con.execute(
                    "INSERT INTO events(created_utc, payload_json) VALUES(?, ?)",
                    (created, payload_json),
                )
            con.close()
        except Exception as e:
            self.send_error(500, f"db error: {e}")
            return

        body = json.dumps({"ok": True}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        u = urlparse(self.path)
        if u.path == "/api/events":
            qs = parse_qs(u.query or "")
            try:
                days = int((qs.get("days", ["30"])[0] or "30"))
            except Exception:
                days = 30
            days = max(1, min(days, 3650))

            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            cutoff_iso = cutoff.replace(microsecond=0).isoformat()

            try:
                con = _db()
                cur = con.execute(
                    "SELECT payload_json FROM events WHERE created_utc >= ? ORDER BY id DESC LIMIT 5000",
                    (cutoff_iso,),
                )
                rows = [json.loads(r[0]) for r in cur.fetchall()]
                con.close()
            except Exception as e:
                self.send_error(500, f"db error: {e}")
                return

            body = json.dumps(rows, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # Default: static files
        return super().do_GET()


class DualStackServer(ThreadingHTTPServer):
    """
    Bind IPv6 and accept both IPv6 + IPv4 (dual stack) when supported.
    This avoids Windows issues where `localhost` may resolve to ::1.
    """

    address_family = socket.AF_INET6

    def server_bind(self) -> None:
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except Exception:
            pass
        super().server_bind()


def main() -> None:
    port = int(os.environ.get("PORT", "8080"))
    os.chdir(os.path.dirname(__file__))
    httpd = DualStackServer(("::", port), Handler)
    print(f"Serving on http://localhost:{port}/  (Ctrl+C to stop)")
    print(f"Also available on http://127.0.0.1:{port}/")
    print("API: POST /api/events  |  GET /api/events?days=30")
    try:
        httpd.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()

