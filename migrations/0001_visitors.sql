-- Start at zero. No IP, user agent, Bluetooth data, timestamps, or raw UUIDs.
CREATE TABLE IF NOT EXISTS visitor_ids (
  id_hash TEXT PRIMARY KEY NOT NULL CHECK (length(id_hash) = 64)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS visitor_totals (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0)
);

INSERT INTO visitor_totals (id, total) VALUES (1, 0) ON CONFLICT(id) DO NOTHING;

CREATE TRIGGER IF NOT EXISTS visitor_added
AFTER INSERT ON visitor_ids
BEGIN
  UPDATE visitor_totals SET total = total + 1 WHERE id = 1;
END;
