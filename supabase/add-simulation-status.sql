-- Adds simulation_status and countdown_end to the settings table
-- simulation_status : 'coming_soon' | 'countdown' | 'live'
-- countdown_end     : ISO timestamp (nullable)

INSERT INTO settings (key, value) VALUES ('simulation_status', 'coming_soon')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('countdown_end', null)
ON CONFLICT (key) DO NOTHING;
