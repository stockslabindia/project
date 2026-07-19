-- Migration: 043_client_tickets.sql
-- Purpose: Support direct client tickets raised from Help & Support.

-- 1. Sequence for client ticket numbering (CT-1000, CT-1001, etc.)
CREATE SEQUENCE IF NOT EXISTS ct_seq START 1000;

-- 2. Client tickets table
CREATE TABLE IF NOT EXISTS client_tickets (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number       text          UNIQUE NOT NULL DEFAULT ('CT-' || nextval('ct_seq')::text),
  customer_id         uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category            text          NOT NULL CHECK (category IN ('deposit', 'withdrawal', 'trading', 'kyc', 'account', 'other')),
  description         text          NOT NULL,
  status              text          NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  admin_response      text,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  closed_at           timestamptz,
  closed_by           uuid          REFERENCES admin_users(id) ON DELETE SET NULL
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_client_tickets_customer ON client_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_client_tickets_status   ON client_tickets(status);

-- 4. Trigger for set_updated_at on client_tickets
CREATE TRIGGER trg_client_tickets_updated_at
  BEFORE UPDATE ON client_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 5. Enable RLS
ALTER TABLE client_tickets ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY "users_read_own_client_tickets" ON client_tickets
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "users_insert_own_client_tickets" ON client_tickets
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());
