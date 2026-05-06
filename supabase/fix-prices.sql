-- ============================================================
-- GRIDFALL — Fix cohérence prix / fortune
-- Garantie mathématique : dernier point = valeur actuelle
--
-- Formule price_history (n = 0..47, Δ = 30 min = 24h) :
--   price * ( 1 + trend*(1 - n/47) + amp*(sin(ω*n) - sin(ω*47)) )
--   → à n=47 : 1 + 0 + 0 = 1.0  → prix exact actuel ✓
--
-- Formule wealth_snapshots (n = 0..13, Δ = 12h = 7j) :
--   wealth * ( 1 + trend*(1 - n/13) + amp*(sin(ω*n) - sin(ω*13)) )
--   → à n=13 : 1.0 → fortune exacte actuelle ✓
-- ============================================================


-- ============================================================
-- PARTIE 1 : price_history
-- ============================================================
TRUNCATE price_history;

INSERT INTO price_history (token, price, recorded_at)
SELECT
  e.token,
  GREATEST(0.01,
    e.price * (
      -- Composante trend : 1.0 à n=47, (1 + trend) à n=0
      1.0 + CASE a.handle
        WHEN 'nova_corp'  THEN  0.42 * (1.0 - s.n::float / 47.0)
        WHEN 'm4rcus'     THEN -0.36 * (1.0 - s.n::float / 47.0)
        WHEN 'luna_v'     THEN  0.00
        WHEN 'ethan_fx'   THEN  0.28 * sin(3.14159 * s.n::float / 47.0)
        WHEN 'zer0_x'     THEN -0.52 * (1.0 - s.n::float / 47.0)
        WHEN 'eden_rise'  THEN -0.09 * (1.0 - s.n::float / 47.0)
        WHEN 'vault_bank' THEN  0.00
        WHEN 'apex_corp'  THEN -0.24 * (1.0 - s.n::float / 47.0)
        ELSE                    0.06 * (1.0 - s.n::float / 47.0)
      END
      -- Composante oscillation : nulle à n=47
      + CASE a.handle
        WHEN 'nova_corp'  THEN 0.04 * (sin(s.n::float * 0.35) - sin(47.0 * 0.35))
        WHEN 'm4rcus'     THEN 0.06 * (sin(s.n::float * 0.50) - sin(47.0 * 0.50))
        WHEN 'luna_v'     THEN 0.03 * (sin(s.n::float * 0.22) - sin(47.0 * 0.22))
        WHEN 'ethan_fx'   THEN 0.09 * (sin(s.n::float * 0.65) - sin(47.0 * 0.65))
        WHEN 'zer0_x'     THEN 0.04 * (sin(s.n::float * 0.60) - sin(47.0 * 0.60))
        WHEN 'eden_rise'  THEN 0.02 * (sin(s.n::float * 0.28) - sin(47.0 * 0.28))
        WHEN 'vault_bank' THEN 0.01 * (sin(s.n::float * 0.12) - sin(47.0 * 0.12))
        WHEN 'apex_corp'  THEN 0.04 * (sin(s.n::float * 0.38) - sin(47.0 * 0.38))
        ELSE                   0.04 * (sin(s.n::float * 0.35) - sin(47.0 * 0.35))
      END
    )
  ),
  now() - ((47 - s.n) * interval '30 minutes')
FROM economy e
LEFT JOIN agents a ON a.id = e.agent_id
CROSS JOIN generate_series(0, 47) AS s(n);


-- ============================================================
-- PARTIE 2 : wealth_snapshots
-- ============================================================
TRUNCATE wealth_snapshots;

INSERT INTO wealth_snapshots (agent_handle, wealth, recorded_at)
SELECT
  a.handle,
  GREATEST(50,
    a.wealth * (
      1.0 + CASE a.handle
        WHEN 'nova_corp'  THEN  0.55 * (1.0 - s.n::float / 13.0)
        WHEN 'm4rcus'     THEN -0.62 * (1.0 - s.n::float / 13.0)
        WHEN 'ethan_fx'   THEN  0.80 * sin(3.14159 * s.n::float / 13.0)
        WHEN 'zer0_x'     THEN -0.68 * (1.0 - s.n::float / 13.0)
        WHEN 'drift_x'    THEN  0.88 * (1.0 - s.n::float / 13.0)
        WHEN 'gh0st_net'  THEN  0.55 * (1.0 - s.n::float / 13.0)
        WHEN 'eden_rise'  THEN -0.22 * (1.0 - s.n::float / 13.0)
        WHEN 'apex_corp'  THEN -0.35 * (1.0 - s.n::float / 13.0)
        WHEN 'aria_media' THEN -0.44 * (1.0 - s.n::float / 13.0)
        WHEN 'mira_pop'   THEN -0.30 * (1.0 - s.n::float / 13.0)
        WHEN 'flux_dao'   THEN -0.26 * (1.0 - s.n::float / 13.0)
        WHEN 'nyx_cult'   THEN -0.18 * (1.0 - s.n::float / 13.0)
        WHEN 'kira_union' THEN -0.24 * (1.0 - s.n::float / 13.0)
        WHEN 'byte_dev'   THEN -0.20 * (1.0 - s.n::float / 13.0)
        WHEN 'iris_data'  THEN -0.12 * (1.0 - s.n::float / 13.0)
        WHEN 'sol_prophet'THEN  0.05 * (1.0 - s.n::float / 13.0)
        WHEN 'c1pher'     THEN  0.38 * sin(3.14159 * s.n::float / 13.0)
        ELSE                    0.00
      END
      + CASE a.handle
        WHEN 'nova_corp'  THEN 0.04 * (sin(s.n::float * 0.40) - sin(13.0 * 0.40))
        WHEN 'm4rcus'     THEN 0.07 * (sin(s.n::float * 0.55) - sin(13.0 * 0.55))
        WHEN 'ethan_fx'   THEN 0.10 * (sin(s.n::float * 0.80) - sin(13.0 * 0.80))
        WHEN 'zer0_x'     THEN 0.05 * (sin(s.n::float * 0.60) - sin(13.0 * 0.60))
        WHEN 'drift_x'    THEN 0.12 * (sin(s.n::float * 0.75) - sin(13.0 * 0.75))
        WHEN 'c1pher'     THEN 0.08 * (sin(s.n::float * 0.70) - sin(13.0 * 0.70))
        ELSE                   0.03 * (sin(s.n::float * 0.30) - sin(13.0 * 0.30))
      END
    )
  ),
  now() - ((13 - s.n) * interval '12 hours')
FROM agents a
CROSS JOIN generate_series(0, 13) AS s(n);
