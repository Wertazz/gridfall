-- ============================================================
-- GRIDFALL — Reset historique narratif en 4 actes
--
-- ACTE 1 (n=0–15)  : Stabilité avant le scandale
-- ACTE 2 (n=16–28) : Tension monte, petites variations
-- ACTE 3 (n=29–38) : Événement déclencheur, mouvements brutaux
-- ACTE 4 (n=39–47) : Conséquences, convergence vers prix actuel
--
-- Formule piecewise (garantit ratio(47) = 1.0 exact) :
--   n ≤ 15 → sf0  + (sf15 - sf0)  * (n/15)
--   n ≤ 28 → sf15 + (sf28 - sf15) * ((n-15)/13)
--   n ≤ 38 → sf28 + (sf38 - sf28) * ((n-28)/10)
--   n > 38 → sf38 + (1.0 - sf38)  * ((n-38)/9)
--
-- Micro-oscillation (texture réaliste, nulle aux 2 extrémités) :
--   + 0.03 * sin(n * 1.2) * sin(n * π / 47)
--
-- Exemple $NOVA (prix=84.2) :
--   n= 0 → 84.2 * 1.40 = 117.88  (avant le scandale — au sommet)
--   n=15 → 84.2 * 1.38 = 116.20  (toujours solide)
--   n=28 → 84.2 * 1.32 = 111.14  (légère nervosité)
--   n=38 → 84.2 * 0.52 =  43.78  (CRASH — leak publié)
--   n=47 → 84.2 * 1.00 =  84.20  (rebond partiel actuel ✓)
-- ============================================================


-- ============================================================
-- 1. VOTES — remise à zéro
-- ============================================================
TRUNCATE votes CASCADE;


-- ============================================================
-- 2. PRICE HISTORY — 48 points × 8 tokens, Δ30min = 24h
--
-- Pivots narratifs par token :
--   nova_corp  : sf0=1.40 sf15=1.38 sf28=1.32 sf38=0.52  (crash scandale)
--   zer0_x     : sf0=0.60 sf15=0.63 sf28=0.68 sf38=1.45  (profite du chaos)
--   vault_bank : sf0=0.95 sf15=0.97 sf28=0.96 sf38=0.73  (exposé NovaCorp)
--   eden_rise  : sf0=0.70 sf15=0.75 sf28=0.82 sf38=0.92  (montée progressive)
--   apex_corp  : sf0=1.05 sf15=1.08 sf28=1.12 sf38=1.28  (profite de la chute Nova)
--   byte_dev   : sf0=0.91 sf15=0.93 sf28=0.95 sf38=0.97  (stable / neutre tech)
--   nyx_cult   : sf0=0.88 sf15=1.05 sf28=1.50 sf38=0.80  (buzz mystique → oublié)
--   flux_dao   : sf0=0.75 sf15=0.78 sf28=0.84 sf38=1.35  (rally DAO en cours)
-- ============================================================
TRUNCATE price_history CASCADE;

WITH pivots(handle, sf0, sf15, sf28, sf38) AS (
  VALUES
    ('nova_corp',  1.40, 1.38, 1.32, 0.52),
    ('zer0_x',     0.60, 0.63, 0.68, 1.45),
    ('vault_bank', 0.95, 0.97, 0.96, 0.73),
    ('eden_rise',  0.70, 0.75, 0.82, 0.92),
    ('apex_corp',  1.05, 1.08, 1.12, 1.28),
    ('byte_dev',   0.91, 0.93, 0.95, 0.97),
    ('nyx_cult',   0.88, 1.05, 1.50, 0.80),
    ('flux_dao',   0.75, 0.78, 0.84, 1.35)
)
INSERT INTO price_history (token, price, recorded_at)
SELECT
  e.token,
  GREATEST(0.01,
    e.price * (
      CASE
        WHEN s.n <= 15 THEN
          p.sf0 + (p.sf15 - p.sf0) * (s.n::float / 15.0)
        WHEN s.n <= 28 THEN
          p.sf15 + (p.sf28 - p.sf15) * ((s.n - 15)::float / 13.0)
        WHEN s.n <= 38 THEN
          p.sf28 + (p.sf38 - p.sf28) * ((s.n - 28)::float / 10.0)
        ELSE
          p.sf38 + (1.0 - p.sf38) * ((s.n - 38)::float / 9.0)
      END
      -- Micro-oscillation réaliste : nulle en n=0 et n=47
      + 0.03 * sin(s.n::float * 1.2) * sin(s.n::float * pi() / 47.0)
    )
  ),
  now() - ((47 - s.n) * interval '30 minutes')
FROM economy e
JOIN agents a ON a.id = e.agent_id
JOIN pivots p ON p.handle = a.handle
CROSS JOIN generate_series(0, 47) AS s(n);


-- ============================================================
-- 3. WEALTH SNAPSHOTS — 14 points × agent, Δ12h = 7 jours
--
-- Même structure piecewise, breakpoints à n=4, 8, 11, 13
-- Récit :
--   ethan_fx  : sf0=1.80 → s'effondre (all-in Nova)
--   nova_corp : sf0=1.55 → chute scandale
--   m4rcus    : sf0=0.35 → monte (dons/scoops)
--   vault_bank: stable autour de 1.0
--   zer0_x    : sf0=0.30 → surge mystérieux
--   eden_rise : montée campagne régulière
--   nyx_cult  : buzz → retombée
--   flux_dao  : rally DAO
--   drift_x   : commence haut, descend (anarchie coûteuse)
--   gh0st_net : commence haut (fuite planifiée), descend
-- ============================================================
TRUNCATE wealth_snapshots CASCADE;

WITH wealth_pivots(handle, sf0, sf4, sf8, sf11) AS (
  VALUES
    ('nova_corp',   1.55, 1.50, 1.45, 0.65),
    ('m4rcus',      0.35, 0.42, 0.58, 0.85),
    ('luna_v',      0.98, 1.00, 1.00, 1.00),
    ('ethan_fx',    1.80, 1.72, 1.65, 0.20),
    ('zer0_x',      0.30, 0.35, 0.45, 1.65),
    ('eden_rise',   0.78, 0.82, 0.88, 0.95),
    ('c1pher',      0.92, 0.95, 0.98, 1.02),
    ('vault_bank',  0.99, 1.00, 0.99, 0.97),
    ('rook_strat',  0.99, 1.00, 1.00, 1.00),
    ('flux_dao',    0.74, 0.78, 0.84, 1.25),
    ('nyx_cult',    0.82, 1.00, 1.45, 0.85),
    ('apex_corp',   0.65, 0.72, 0.82, 1.15),
    ('aria_media',  0.56, 0.62, 0.72, 0.88),
    ('gh0st_net',   1.55, 1.40, 1.20, 1.05),
    ('sol_prophet', 0.95, 0.96, 0.98, 0.99),
    ('byte_dev',    0.80, 0.84, 0.90, 0.97),
    ('mira_pop',    0.70, 0.75, 0.82, 0.92),
    ('drift_x',     1.88, 1.60, 1.30, 1.08),
    ('iris_data',   0.88, 0.90, 0.93, 0.97),
    ('kira_union',  0.76, 0.80, 0.87, 0.95)
)
INSERT INTO wealth_snapshots (agent_handle, wealth, recorded_at)
SELECT
  a.handle,
  GREATEST(50,
    a.wealth * (
      CASE
        WHEN s.n <= 4 THEN
          wp.sf0 + (wp.sf4 - wp.sf0) * (s.n::float / 4.0)
        WHEN s.n <= 8 THEN
          wp.sf4 + (wp.sf8 - wp.sf4) * ((s.n - 4)::float / 4.0)
        WHEN s.n <= 11 THEN
          wp.sf8 + (wp.sf11 - wp.sf8) * ((s.n - 8)::float / 3.0)
        ELSE
          wp.sf11 + (1.0 - wp.sf11) * ((s.n - 11)::float / 2.0)
      END
      -- Micro-oscillation : nulle en n=0 et n=13
      + 0.02 * sin(s.n::float * 1.5) * sin(s.n::float * pi() / 13.0)
    )
  ),
  now() - ((13 - s.n) * interval '12 hours')
FROM agents a
JOIN wealth_pivots wp ON wp.handle = a.handle
CROSS JOIN generate_series(0, 13) AS s(n);
