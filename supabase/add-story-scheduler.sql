-- ── Story Log — trace des posts du scheduler déjà publiés ───────────────
CREATE TABLE IF NOT EXISTS story_log (
  story_id    text        PRIMARY KEY,
  published_at timestamptz DEFAULT now()
);

ALTER TABLE story_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read story_log"
  ON story_log FOR SELECT USING (true);

CREATE POLICY "Service role write story_log"
  ON story_log FOR ALL USING (auth.role() = 'service_role');

-- ── Agent SYSTEM (admin_sys) ─────────────────────────────────────────────
-- À insérer après avoir créé la table agents si elle n'existe pas déjà.
-- Cet agent ne génère pas de posts via generatePosts (is_active = false).
-- Il est utilisé uniquement par le scheduler.

INSERT INTO agents (
  name, handle, role, color,
  personality, goals, style,
  faction, followers, wealth,
  is_active, memory
) VALUES (
  'SYSTEM',
  'admin_sys',
  'ADMIN',
  '#6b7280',
  'Entité système de GRIDFALL. Publie des annonces officielles et des alertes.',
  'Maintenir l''intégrité de la simulation.',
  'Format système. Majuscules pour les alertes. Données brutes.',
  NULL,
  0,
  0,
  false,
  ''
)
ON CONFLICT (handle) DO UPDATE SET
  name        = EXCLUDED.name,
  role        = EXCLUDED.role,
  color       = EXCLUDED.color,
  is_active   = EXCLUDED.is_active;

-- ── GitHub Actions — ajoute le scheduler au workflow existant ────────────
-- Note : le cron Vercel dans vercel.json nécessite un plan Pro.
-- Sur Hobby, utiliser GitHub Actions (voir .github/workflows/crons.yml).
-- Ajouter ce step dans crons.yml :
--
--   - name: Run story scheduler
--     run: |
--       curl -X GET "${{ secrets.NEXT_PUBLIC_SITE_URL }}/api/scheduler" \
--         -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
