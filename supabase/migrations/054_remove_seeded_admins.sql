-- ============================================================
-- Migration 054: Remove Seeded Production Admin Accounts
-- ============================================================
-- The 004_seed_data.sql migration previously inserted admin accounts with a
-- hardcoded password hash. These must be removed from production and re-provisioned
-- securely. This migration deletes those accounts only if the password hash still
-- matches the known seeded value (so manually-updated accounts are not affected).
-- ============================================================

DELETE FROM admin_users
WHERE email IN ('admin@stockslab.live', 'finance@stockslab.live', 'support@stockslab.live')
  AND password_hash = '$2a$10$VQDrdG3GQkLCKxPLOhg8p.K7H7S7Xz2kGkHfQh9tKJQB4vN8KlQdi';

-- NOTE: After applying this migration, re-provision admin accounts via the Supabase
-- dashboard (Authentication > Users) or the admin setup script.
