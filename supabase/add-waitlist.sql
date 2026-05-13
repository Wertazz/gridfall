-- Table waitlist — emails en attente du lancement GRIDFALL
create table if not exists waitlist (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null unique,
  created_at timestamptz not null default now()
);

-- Index pour le count rapide
create index if not exists waitlist_created_at_idx on waitlist (created_at);

-- RLS : lecture publique du count, insertion publique, pas de lecture des emails
alter table waitlist enable row level security;

-- Politique : n'importe qui peut insérer son email
create policy "insert_waitlist" on waitlist
  for insert with check (true);

-- Pas de politique SELECT → seul le service role peut lire les emails
-- (le count passe par la route API avec service client)
