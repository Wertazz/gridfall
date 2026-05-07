-- ── Settings table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Lecture publique (front-end peut lire launch_date)
CREATE POLICY "Public read settings"
  ON settings FOR SELECT USING (true);

-- Écriture réservée au service role (API routes, crons)
CREATE POLICY "Service role write settings"
  ON settings FOR ALL USING (auth.role() = 'service_role');

-- Valeur initiale
INSERT INTO settings (key, value)
VALUES ('launch_date', '2026-05-13 00:00:00+00')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
