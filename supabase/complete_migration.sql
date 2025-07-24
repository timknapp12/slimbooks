-- Complete Migration for Multi-Company Support
-- This migration consolidates all changes needed for multi-company functionality

-- ============================================================================
-- STEP 1: Create user_companies junction table
-- ============================================================================

CREATE TABLE user_companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('admin', 'staff')) DEFAULT 'admin',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, company_id)
);

-- ============================================================================
-- STEP 2: Remove company_id from users table (if it exists)
-- ============================================================================

-- Check if company_id column exists and remove it
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE users DROP COLUMN company_id;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Migrate existing data
-- ============================================================================

-- This step is only needed if you have existing data
-- For fresh installations, this will be skipped
DO $$
DECLARE
    user_record RECORD;
    company_record RECORD;
BEGIN
    -- Check if there are any users with company_id (from old structure)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'company_id'
    ) THEN
        -- Migrate existing user-company relationships
        FOR user_record IN 
            SELECT id, company_id FROM users WHERE company_id IS NOT NULL
        LOOP
            INSERT INTO user_companies (user_id, company_id, role, is_default)
            VALUES (user_record.id, user_record.company_id, 'admin', true)
            ON CONFLICT (user_id, company_id) DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Update RLS policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users can insert companies" ON companies;
DROP POLICY IF EXISTS "Users can update their own company" ON companies;
DROP POLICY IF EXISTS "Users can delete their own company" ON companies;

-- Create new policies for multi-company support
CREATE POLICY "Users can view companies they belong to" ON companies
    FOR SELECT USING (id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert companies" ON companies
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update companies they belong to" ON companies
    FOR UPDATE USING (id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete companies they belong to" ON companies
    FOR DELETE USING (id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- ============================================================================
-- STEP 5: Create RLS policies for user_companies
-- ============================================================================

ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company memberships" ON user_companies
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own company memberships" ON user_companies
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own company memberships" ON user_companies
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own company memberships" ON user_companies
    FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- STEP 6: Update RLS policies for other tables
-- ============================================================================

-- Update transactions policies
DROP POLICY IF EXISTS "Users can view transactions in their company" ON transactions;
DROP POLICY IF EXISTS "Users can insert transactions in their company" ON transactions;
DROP POLICY IF EXISTS "Users can update transactions in their company" ON transactions;
DROP POLICY IF EXISTS "Users can delete transactions in their company" ON transactions;

CREATE POLICY "Users can view transactions in their companies" ON transactions
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert transactions in their companies" ON transactions
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update transactions in their companies" ON transactions
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete transactions in their companies" ON transactions
    FOR DELETE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- Update payables_receivables policies
DROP POLICY IF EXISTS "Users can view payables/receivables in their company" ON payables_receivables;
DROP POLICY IF EXISTS "Users can insert payables/receivables in their company" ON payables_receivables;
DROP POLICY IF EXISTS "Users can update payables/receivables in their company" ON payables_receivables;
DROP POLICY IF EXISTS "Users can delete payables/receivables in their company" ON payables_receivables;

CREATE POLICY "Users can view payables/receivables in their companies" ON payables_receivables
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert payables/receivables in their companies" ON payables_receivables
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update payables/receivables in their companies" ON payables_receivables
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete payables/receivables in their companies" ON payables_receivables
    FOR DELETE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- Update bank_statements policies
DROP POLICY IF EXISTS "Only admins can view bank statements" ON bank_statements;
DROP POLICY IF EXISTS "Only admins can insert bank statements" ON bank_statements;

CREATE POLICY "Only admins can view bank statements" ON bank_statements
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Only admins can insert bank statements" ON bank_statements
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- Update subscriptions policies
DROP POLICY IF EXISTS "Users can view their company subscription" ON subscriptions;

CREATE POLICY "Users can view their companies subscriptions" ON subscriptions
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- ============================================================================
-- STEP 7: Create indexes for performance
-- ============================================================================

CREATE INDEX idx_user_companies_user_id ON user_companies(user_id);
CREATE INDEX idx_user_companies_company_id ON user_companies(company_id);
CREATE INDEX idx_user_companies_default ON user_companies(user_id, is_default) WHERE is_default = true;

-- ============================================================================
-- STEP 8: Create triggers and functions
-- ============================================================================

-- Create trigger for user_companies updated_at
CREATE TRIGGER update_user_companies_updated_at 
    BEFORE UPDATE ON user_companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one default company per user
CREATE OR REPLACE FUNCTION ensure_single_default_company()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is being set as default, unset all other defaults for this user
    IF NEW.is_default = true THEN
        UPDATE user_companies 
        SET is_default = false 
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    
    -- If this user has no default company, make this one default
    IF NOT EXISTS (
        SELECT 1 FROM user_companies 
        WHERE user_id = NEW.user_id AND is_default = true
    ) THEN
        NEW.is_default = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure single default company
CREATE TRIGGER ensure_single_default_company_trigger
    BEFORE INSERT OR UPDATE ON user_companies
    FOR EACH ROW EXECUTE FUNCTION ensure_single_default_company();

-- Function to get user's default company
CREATE OR REPLACE FUNCTION get_user_default_company(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
    default_company_id UUID;
BEGIN
    SELECT company_id INTO default_company_id
    FROM user_companies
    WHERE user_id = user_uuid AND is_default = true
    LIMIT 1;
    
    RETURN default_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create company with user (for multi-company support)
CREATE OR REPLACE FUNCTION create_company_with_user(
    company_name TEXT,
    company_address TEXT DEFAULT NULL,
    company_ein TEXT DEFAULT NULL,
    company_accounting_method TEXT DEFAULT 'cash'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_company_id UUID;
    current_user_id UUID;
BEGIN
    -- Get the current user ID
    current_user_id := auth.uid();
    
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to create a company';
    END IF;
    
    -- Create the company
    INSERT INTO companies (name, address, ein, accounting_method)
    VALUES (company_name, company_address, company_ein, company_accounting_method)
    RETURNING id INTO new_company_id;
    
    -- Create the user-company relationship
    INSERT INTO user_companies (user_id, company_id, role, is_default)
    VALUES (current_user_id, new_company_id, 'admin', false);
    
    -- Return the new company ID
    RETURN new_company_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_company_with_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the migration completed successfully
SELECT 'Multi-company migration completed successfully' as status;

-- Check that user_companies table was created
SELECT 
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name = 'user_companies';

-- Check that the function was created
SELECT 
    proname as function_name,
    'EXISTS' as status
FROM pg_proc 
WHERE proname = 'create_company_with_user'; 