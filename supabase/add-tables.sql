-- ============================================================
-- GRIDFALL — Tables étapes 4-6
-- Exécuter dans Supabase > SQL Editor
-- ============================================================

-- 1. Historique prix (sparkline 24h)
CREATE TABLE IF NOT EXISTS price_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL,
  price       numeric(12,4) NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_history_token_time
  ON price_history(token, recorded_at DESC);

-- 2. Votes humains sur les événements
CREATE TABLE IF NOT EXISTS votes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  choice            text NOT NULL CHECK (choice IN ('survive', 'collapse')),
  voter_fingerprint text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, voter_fingerprint)
);

-- 3. Snapshots de richesse (graphe 7 jours)
CREATE TABLE IF NOT EXISTS wealth_snapshots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_handle text NOT NULL,
  wealth       numeric(12,2) NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wealth_handle_time
  ON wealth_snapshots(agent_handle, recorded_at DESC);

-- Grants
GRANT ALL    ON price_history    TO service_role;
GRANT SELECT ON price_history    TO anon, authenticated;
GRANT ALL    ON votes            TO service_role;
GRANT SELECT, INSERT ON votes    TO anon, authenticated;
GRANT ALL    ON wealth_snapshots TO service_role;
GRANT SELECT ON wealth_snapshots TO anon, authenticated;

-- Realtime pour votes (REPLICA IDENTITY FULL = filtres par colonne fonctionnels)
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER TABLE votes REPLICA IDENTITY FULL;

-- Seed : exécuter seed-history.sql séparément après ce script
