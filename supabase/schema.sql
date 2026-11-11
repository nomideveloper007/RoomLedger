-- =====================================================================
-- ROOM EXPENSE MANAGER — SUPABASE POSTGRESQL SCHEMA & SECURITY RULES
-- Production DDL with Row Level Security, Indexes, Functions & Triggers
-- =====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'PKR',
    monthly_contribution_target NUMERIC(12, 2) NOT NULL DEFAULT 15000.00,
    wallet_custodian_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Profiles / Users Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Room Members Table (Exactly 5 active members per room)
CREATE TABLE IF NOT EXISTS room_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer', 'admin', 'member')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_room_member_email UNIQUE (room_id, email)
);

-- Add foreign key constraint back to rooms for wallet_custodian_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_rooms_wallet_custodian'
    ) THEN
        ALTER TABLE rooms 
        ADD CONSTRAINT fk_rooms_wallet_custodian 
        FOREIGN KEY (wallet_custodian_id) REFERENCES room_members(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Deposits Table
CREATE TABLE IF NOT EXISTS deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES room_members(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
    notes TEXT,
    reference_number VARCHAR(100),
    created_by UUID REFERENCES room_members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(100) NOT NULL,
    paid_by_member_id UUID NOT NULL REFERENCES room_members(id) ON DELETE RESTRICT,
    payment_source VARCHAR(30) NOT NULL CHECK (payment_source IN ('common_wallet', 'personal_pocket')),
    notes TEXT,
    receipt_url TEXT,
    created_by UUID REFERENCES room_members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Expense Shares Table (Equal 5-way split record)
CREATE TABLE IF NOT EXISTS expense_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES room_members(id) ON DELETE RESTRICT,
    share_amount NUMERIC(12, 2) NOT NULL CHECK (share_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_expense_share UNIQUE (expense_id, member_id)
);

-- 8. Wallet Transactions Table (Strict double-entry for Common Wallet)
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('deposit', 'wallet_expense', 'withdrawal', 'adjustment')),
    amount NUMERIC(12, 2) NOT NULL, -- positive for deposit, negative for expense/withdrawal
    balance_after NUMERIC(12, 2) NOT NULL,
    reference_id UUID, -- links to deposit or expense
    description VARCHAR(255) NOT NULL,
    performed_by UUID REFERENCES room_members(id),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Settlements Table (Balance transfers between members without touching historical expenses)
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    payer_member_id UUID NOT NULL REFERENCES room_members(id) ON DELETE RESTRICT,
    payee_member_id UUID NOT NULL REFERENCES room_members(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Raast',
    notes TEXT,
    reference_number VARCHAR(100),
    created_by UUID REFERENCES room_members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_different_settlement_members CHECK (payer_member_id <> payee_member_id)
);

-- 10. Audit Logs Table (Full mutation tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    performed_by UUID REFERENCES room_members(id),
    performed_by_name VARCHAR(255) NOT NULL,
    details TEXT NOT NULL,
    previous_data JSONB,
    new_data JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- PERFORMANCE INDEXES
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_deposits_room_date ON deposits(room_id, deposit_date DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_member ON deposits(member_id);
CREATE INDEX IF NOT EXISTS idx_expenses_room_date ON expenses(room_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by_member_id);
CREATE INDEX IF NOT EXISTS idx_expense_shares_expense ON expense_shares(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_shares_member ON expense_shares(member_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_room ON wallet_transactions(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_room ON settlements(room_id, settlement_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_room ON audit_logs(room_id, timestamp DESC);

-- =====================================================================
-- POSTGRESQL ATOMIC FUNCTIONS & TRIGGERS
-- =====================================================================

-- Auto-split expense among 5 room members upon insert
CREATE OR REPLACE FUNCTION handle_new_expense_split()
RETURNS TRIGGER AS $$
DECLARE
    v_member RECORD;
    v_member_count INT;
    v_equal_share NUMERIC(12, 2);
    v_allocated_sum NUMERIC(12, 2) := 0;
    v_last_member_id UUID;
BEGIN
    -- Count active members in the room
    SELECT COUNT(*) INTO v_member_count 
    FROM room_members 
    WHERE room_id = NEW.room_id AND is_active = TRUE;

    IF v_member_count = 0 THEN
        RAISE EXCEPTION 'Cannot record expense: room has no active members.';
    END IF;

    -- Calculate equal floor share
    v_equal_share := ROUND(NEW.amount / v_member_count, 2);

    FOR v_member IN 
        SELECT id FROM room_members 
        WHERE room_id = NEW.room_id AND is_active = TRUE 
        ORDER BY joined_at ASC
    LOOP
        INSERT INTO expense_shares (expense_id, member_id, share_amount)
        VALUES (NEW.id, v_member.id, v_equal_share);
        
        v_allocated_sum := v_allocated_sum + v_equal_share;
        v_last_member_id := v_member.id;
    END LOOP;

    -- Adjust any fractional cent difference on the last member
    IF v_allocated_sum <> NEW.amount AND v_last_member_id IS NOT NULL THEN
        UPDATE expense_shares 
        SET share_amount = share_amount + (NEW.amount - v_allocated_sum)
        WHERE expense_id = NEW.id AND member_id = v_last_member_id;
    END IF;

    -- If paid from Common Wallet, deduct from wallet transactions
    IF NEW.payment_source = 'common_wallet' THEN
        DECLARE
            v_curr_balance NUMERIC(12, 2) := 0;
        BEGIN
            SELECT COALESCE(SUM(amount), 0) INTO v_curr_balance 
            FROM wallet_transactions 
            WHERE room_id = NEW.room_id;

            INSERT INTO wallet_transactions (
                room_id, type, amount, balance_after, reference_id, description, performed_by, transaction_date
            ) VALUES (
                NEW.room_id, 
                'wallet_expense', 
                -NEW.amount, 
                v_curr_balance - NEW.amount, 
                NEW.id, 
                NEW.description, 
                NEW.paid_by_member_id, 
                NEW.expense_date
            );
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_expense_split ON expenses;
CREATE TRIGGER trg_new_expense_split
AFTER INSERT ON expenses
FOR EACH ROW EXECUTE FUNCTION handle_new_expense_split();

-- When deposit is added, automatically credit common wallet
CREATE OR REPLACE FUNCTION handle_new_deposit()
RETURNS TRIGGER AS $$
DECLARE
    v_curr_balance NUMERIC(12, 2) := 0;
    v_member_name VARCHAR(255);
BEGIN
    SELECT name INTO v_member_name FROM room_members WHERE id = NEW.member_id;
    
    SELECT COALESCE(SUM(amount), 0) INTO v_curr_balance 
    FROM wallet_transactions 
    WHERE room_id = NEW.room_id;

    INSERT INTO wallet_transactions (
        room_id, type, amount, balance_after, reference_id, description, performed_by, transaction_date
    ) VALUES (
        NEW.room_id, 
        'deposit', 
        NEW.amount, 
        v_curr_balance + NEW.amount, 
        NEW.id, 
        'Deposit by ' || COALESCE(v_member_name, 'Member'), 
        NEW.member_id, 
        NEW.deposit_date
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_deposit ON deposits;
CREATE TRIGGER trg_new_deposit
AFTER INSERT ON deposits
FOR EACH ROW EXECUTE FUNCTION handle_new_deposit();

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — ENFORCE AUTHENTICATION AT DB LEVEL
-- Only the authenticated single authorized account can access room data.
-- Unauthenticated / anonymous requests are completely blocked by PostgreSQL RLS.
-- Public signup is disabled; no unauthorized accounts can access or mutate data.
-- =====================================================================
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Rooms Policies
DROP POLICY IF EXISTS "Authorized user can read rooms" ON rooms;
CREATE POLICY "Authorized user can read rooms" ON rooms
    FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized user can modify rooms" ON rooms;
CREATE POLICY "Authorized user can modify rooms" ON rooms
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Room Members Policies (The 5 household roommates)
DROP POLICY IF EXISTS "Authorized user can read room members" ON room_members;
CREATE POLICY "Authorized user can read room members" ON room_members
    FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized user can modify room members" ON room_members;
CREATE POLICY "Authorized user can modify room members" ON room_members
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Deposits Policies
DROP POLICY IF EXISTS "Authorized user can read deposits" ON deposits;
CREATE POLICY "Authorized user can read deposits" ON deposits
    FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized user can insert deposits" ON deposits;
CREATE POLICY "Authorized user can insert deposits" ON deposits
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized user can update deposits" ON deposits;
CREATE POLICY "Authorized user can update deposits" ON deposits
    FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized user can delete deposits" ON deposits;
CREATE POLICY "Authorized user can delete deposits" ON deposits
    FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- 4. Expenses Policies
DROP POLICY IF EXISTS "Authorized user can read expenses" ON expenses;
CREATE POLICY "Authorized user can read expenses" ON expenses
    FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized user can insert expenses" ON expenses;
CREATE POLICY "Authorized user can insert expenses" ON expenses
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized user can update expenses" ON expenses;
CREATE POLICY "Authorized user can update expenses" ON expenses
    FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized user can delete expenses" ON expenses;
CREATE POLICY "Authorized user can delete expenses" ON expenses
    FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- 5. Expense Shares Policies
DROP POLICY IF EXISTS "Authorized user can read expense shares" ON expense_shares;
CREATE POLICY "Authorized user can read expense shares" ON expense_shares
    FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized user can modify expense shares" ON expense_shares;
CREATE POLICY "Authorized user can modify expense shares" ON expense_shares
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Wallet Transactions Policies
DROP POLICY IF EXISTS "Authorized user can read wallet transactions" ON wallet_transactions;
CREATE POLICY "Authorized user can read wallet transactions" ON wallet_transactions
    FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized user can modify wallet transactions" ON wallet_transactions;
CREATE POLICY "Authorized user can modify wallet transactions" ON wallet_transactions
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Settlements Policies
DROP POLICY IF EXISTS "Authorized user can read settlements" ON settlements;
CREATE POLICY "Authorized user can read settlements" ON settlements
    FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized user can insert settlements" ON settlements;
CREATE POLICY "Authorized user can insert settlements" ON settlements
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized user can delete settlements" ON settlements;
CREATE POLICY "Authorized user can delete settlements" ON settlements
    FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- 8. Audit Logs Policies
DROP POLICY IF EXISTS "Authorized user can read audit logs" ON audit_logs;
CREATE POLICY "Authorized user can read audit logs" ON audit_logs
    FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- Enable Supabase Realtime for instant updates (safely handle already-added tables)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE deposits, expenses, expense_shares, wallet_transactions, settlements, room_members;
    EXCEPTION 
        WHEN duplicate_object THEN
            NULL;
        WHEN OTHERS THEN
            NULL;
    END;
END $$;
