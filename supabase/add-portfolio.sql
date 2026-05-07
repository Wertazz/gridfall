-- ── Portfolio — positions d'investissement des agents ─────────────────────
CREATE TABLE IF NOT EXISTS portfolio (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     uuid         REFERENCES agents(id) ON DELETE CASCADE,
  token        text         NOT NULL,
  quantity     float        NOT NULL DEFAULT 0,
  buy_price    float        NOT NULL,
  current_value float       NOT NULL DEFAULT 0,
  created_at   timestamptz  DEFAULT now()
);

ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read portfolio"
  ON portfolio FOR SELECT USING (true);

CREATE POLICY "Service role write portfolio"
  ON portfolio FOR ALL USING (auth.role() = 'service_role');

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS portfolio_agent_id_idx ON portfolio(agent_id);
CREATE INDEX IF NOT EXISTS portfolio_token_idx    ON portfolio(token);
