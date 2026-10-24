-- Streetwise D1 Seed Migration 0002
-- Loads: 6 zones, default settings, 2 marking users (bcrypt hashes for 'streetwise2026')
-- Admin password:  Streetwise#Admin2026
-- Staff password:  Streetwise#Staff2026
-- Change these BEFORE deploying to production!

-- ─── Zones (from data/zones.json) ───────────────────────────────────────────

INSERT OR REPLACE INTO zones (id, name, crew, polygon, status, pause_reason, paused_until) VALUES
('Z-01','Fort and Pettah','Crew A','[[79.842,6.929],[79.862,6.929],[79.862,6.944],[79.842,6.944],[79.842,6.929]]','active',NULL,NULL),
('Z-02','Kollupitiya','Crew B','[[79.849,6.901],[79.862,6.901],[79.862,6.926],[79.849,6.926],[79.849,6.901]]','active',NULL,NULL),
('Z-03','Borella','Crew C','[[79.868,6.906],[79.889,6.906],[79.889,6.925],[79.868,6.925],[79.868,6.906]]','paused','Crew on a flood call','2026-10-26'),
('Z-04','Wellawatte','Crew D','[[79.856,6.868],[79.871,6.868],[79.871,6.898],[79.856,6.898],[79.856,6.868]]','active',NULL,NULL),
('Z-05','Narahenpita','Crew E','[[79.873,6.884],[79.894,6.884],[79.894,6.903],[79.873,6.903],[79.873,6.884]]','active',NULL,NULL),
('Z-06','Rajagiriya','Crew F','[[79.893,6.904],[79.914,6.904],[79.914,6.924],[79.893,6.924],[79.893,6.904]]','active',NULL,NULL);

-- ─── Default Settings (from streetwise.config.example.json) ─────────────────

INSERT OR REPLACE INTO settings (key, value) VALUES
('city',          '"Colombo"'),
('map',           '{"center":[79.878,6.906],"zoom":12.6,"bounds":[[79.84,6.865],[79.916,6.946]]}'),
('report_types',  '[{"key":"pothole","label":"Pothole"},{"key":"street_light","label":"Street light"},{"key":"flooding","label":"Flooding"},{"key":"rubbish","label":"Rubbish"},{"key":"not_relevant","label":"Not relevant"}]'),
('sizes',         '["small","medium","large"]'),
('metrics',       '{"open":"open reports","fixed_30d":"fixed in the last 30 days","fixed_total":"issues fixed, and counting"}'),
('rules',         '{"approval_priority_at_or_above":4,"approval_confidence_below":0.7,"reject_types":["not_relevant"]}'),
('triage',        '{"model_timeout_ms":8000,"model_retries":1}');

-- ─── Marking Users ───────────────────────────────────────────────────────────
-- Passwords are bcrypt hashed (cost 12). Replace with real hashes before submit.
-- Admin:  Streetwise#Admin2026
-- Staff:  Streetwise#Staff2026

INSERT OR IGNORE INTO users (id, email, password_hash, role, active) VALUES
('u-admin-01','admin@streetwise.mark','$2b$12$Kr99EiSf3rzY7u9r3BT6Lepg8M29ZHtCqGx78E/.3QnZgi..6Fzom','admin',1),
('u-staff-01','staff@streetwise.mark','$2b$12$HtIYOVSmGROw.8I3q1cMXOW0Eym0/wznqctBsaXF3.xK9KYEpqhgG','staff',1);
