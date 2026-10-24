-- Streetwise D1 Schema Migration 0001
-- Run: wrangler d1 execute streetwise --file=src/db/migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS reports (
  id           TEXT PRIMARY KEY,
  text         TEXT NOT NULL,
  lat          REAL NOT NULL,
  lng          REAL NOT NULL,
  photo        TEXT,                         -- base64 data URI or null
  type         TEXT,
  size         TEXT,
  priority     INTEGER,
  zone         TEXT,
  confidence   REAL,
  reason       TEXT,
  route        TEXT,
  triaged_by   TEXT,
  status       TEXT NOT NULL DEFAULT 'received',
  merged_into  TEXT REFERENCES reports(id),
  follow_token TEXT NOT NULL,                -- private 32-char random token
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS report_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id  TEXT NOT NULL REFERENCES reports(id),
  actor      TEXT NOT NULL,                  -- user email or 'system'
  field      TEXT NOT NULL,                  -- e.g. 'status', 'priority'
  old_value  TEXT,
  new_value  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS zones (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  crew         TEXT,
  polygon      TEXT NOT NULL,               -- JSON [[lng,lat],...]
  status       TEXT NOT NULL DEFAULT 'active',
  pause_reason TEXT,
  paused_until TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('staff','admin')),
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                       -- stored as JSON string
);

-- Rate limiting: per-IP per-route sliding window
CREATE TABLE IF NOT EXISTS rate_limits (
  key        TEXT PRIMARY KEY,              -- "{ip}:{route}"
  count      INTEGER NOT NULL DEFAULT 0,
  window_end TEXT NOT NULL                  -- ISO8601 UTC
);

CREATE INDEX IF NOT EXISTS idx_reports_status    ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_zone      ON reports(zone);
CREATE INDEX IF NOT EXISTS idx_reports_created   ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_events_report_id  ON report_events(report_id);
CREATE INDEX IF NOT EXISTS idx_events_actor      ON report_events(actor);
CREATE INDEX IF NOT EXISTS idx_events_created    ON report_events(created_at);
