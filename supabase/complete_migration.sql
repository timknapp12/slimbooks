-- Complete Migration for SlimBooks Database
-- This migration combines all previous migrations into one comprehensive file
-- Run this in your Supabase SQL Editor to set up the complete database

-- ============================================================================
-- MIGRATION 1: Update transaction types to support all 5 fundamental account types
-- ============================================================================

-- First, drop the existing constraint
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Add the new constraint with all 5 fundamental account types
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
    CHECK (type IN ('income', 'expense', 'asset', 'liability', 'equity'));

-- Update any existing 'transfer' transactions to 'equity' type
UPDATE transactions 
SET type = 'equity' 
WHERE type = 'transfer';

-- Add a comment to document the change
COMMENT ON COLUMN transactions.type IS 'Transaction type: income (revenue), expense (costs), asset (things owned), liability (things owed), equity (owner''s claim including transfers)';

-- ============================================================================
-- MIGRATION 2: Create missing tables if they don't exist
-- ============================================================================

-- Create subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    status TEXT,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pricing_plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS pricing_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stripe_price_id TEXT,
    is_active BOOLEAN DEFAULT true,
    features JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- MIGRATION 3: Add foreign key constraints if they don't exist
-- ============================================================================

-- Add foreign key constraint for subscriptions if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'subscriptions_company_id_fkey'
    ) THEN
        ALTER TABLE subscriptions 
        ADD CONSTRAINT subscriptions_company_id_fkey 
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- MIGRATION 4: Add missing columns to existing tables
-- ============================================================================

-- Add missing columns to pricing_plans table
DO $$ 
BEGIN
    -- Add description column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pricing_plans' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE pricing_plans ADD COLUMN description TEXT;
    END IF;

    -- Add features column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pricing_plans' 
        AND column_name = 'features'
    ) THEN
        ALTER TABLE pricing_plans ADD COLUMN features JSONB;
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pricing_plans' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE pricing_plans ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Add missing columns to subscriptions table
DO $$ 
BEGIN
    -- Add current_period_start column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subscriptions' 
        AND column_name = 'current_period_start'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN current_period_start TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add current_period_end column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subscriptions' 
        AND column_name = 'current_period_end'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN current_period_end TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subscriptions' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- ============================================================================
-- MIGRATION 5: Fix constraints and permissions
-- ============================================================================

-- Check if stripe_price_id column has NOT NULL constraint and remove it if needed
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pricing_plans' 
        AND column_name = 'stripe_price_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE pricing_plans ALTER COLUMN stripe_price_id DROP NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- MIGRATION 6: Enable RLS and create policies
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their company subscription" ON subscriptions;
DROP POLICY IF EXISTS "Anyone can view active pricing plans" ON pricing_plans;

-- Create RLS policies
CREATE POLICY "Users can view their company subscription" ON subscriptions
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Anyone can view active pricing plans" ON pricing_plans
    FOR SELECT USING (is_active = true);

-- ============================================================================
-- MIGRATION 7: Create functions and triggers
-- ============================================================================

-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at (drop first to avoid conflicts)
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pricing_plans_updated_at ON pricing_plans;
CREATE TRIGGER update_pricing_plans_updated_at 
    BEFORE UPDATE ON pricing_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION 8: Insert default data
-- ============================================================================

-- Insert default pricing plan
INSERT INTO pricing_plans (name, description, price, stripe_price_id, is_active, features)
VALUES (
    'Basic Plan',
    'Perfect for small businesses getting started with accounting',
    29.00,
    NULL,
    true,
    '["Unlimited transactions", "Financial reports (P&L, Balance Sheet, Cash Flow)", "Bank statement import", "Payables & receivables tracking", "Multiple users", "Email support"]'::jsonb
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION 9: Grant permissions
-- ============================================================================

-- Grant necessary permissions
GRANT ALL ON subscriptions TO authenticated;
GRANT ALL ON pricing_plans TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the migration completed successfully
SELECT 'Complete migration finished successfully' as status;

-- Check that all required tables exist
SELECT 
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('subscriptions', 'pricing_plans')
ORDER BY table_name;

-- Check that default pricing plan was inserted
SELECT 
    name,
    price,
    is_active
FROM pricing_plans 
WHERE name = 'Basic Plan'; 