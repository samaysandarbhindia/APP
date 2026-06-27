ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check;
ALTER TABLE users
  ADD CONSTRAINT users_account_status_check CHECK (account_status IN ('active','deleted'));

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

UPDATE organization_invites oi
SET invited_user_id = u.id,
    updated_at = NOW()
FROM users u
WHERE oi.invited_user_id IS NULL
  AND oi.accepted_at IS NULL
  AND oi.revoked_at IS NULL
  AND LOWER(oi.email) = LOWER(u.email)
  AND u.account_status = 'active';
