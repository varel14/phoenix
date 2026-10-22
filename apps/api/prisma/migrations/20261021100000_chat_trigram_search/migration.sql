-- Typo-tolerant chat search: trigram similarity over participant names and
-- message contents. pg_trgm is a trusted extension on PostgreSQL 13+, so it
-- installs without superuser on managed services (Supabase, RDS, Cloud SQL).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS users_name_trgm_idx ON users USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS messages_content_trgm_idx ON messages USING gin (content gin_trgm_ops);
