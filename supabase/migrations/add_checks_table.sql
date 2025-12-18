-- Migration: Add Checks Table
-- Description: Creates checks table linked to transactions and payables for check printing functionality
-- Date: 2024

-- ============================================================================
-- STEP 1: Add next_check_number to companies table
-- ============================================================================

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS next_check_number INTEGER DEFAULT 1001;

COMMENT ON COLUMN companies.next_check_number IS 'The next check number to be used when printing checks';

-- ============================================================================
-- STEP 2: Create checks table
-- ============================================================================

CREATE TABLE IF NOT EXISTS checks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Link to transactions register (the expense transaction this check pays)
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,

    -- Link to payable (optional - if paying a specific payable)
    payable_id UUID REFERENCES payables_receivables(id) ON DELETE SET NULL,

    -- Check details
    check_number INTEGER NOT NULL,
    payee_name TEXT NOT NULL,
    payee_address TEXT,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    amount_in_words TEXT,
    memo TEXT,
    date DATE NOT NULL,

    -- Bank account info (for MICR line - optional)
    bank_routing_number VARCHAR(9),
    bank_account_number VARCHAR(17),

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'printed', 'voided', 'cleared', 'reconciled')),
    printed_at TIMESTAMP WITH TIME ZONE,
    voided_at TIMESTAMP WITH TIME ZONE,
    voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
    void_reason TEXT,
    cleared_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure check numbers are unique per company
    UNIQUE(company_id, check_number)
);

-- Add comments
COMMENT ON TABLE checks IS 'Stores check records linked to the transactions register';
COMMENT ON COLUMN checks.transaction_id IS 'Links to the expense transaction in the register that this check pays';
COMMENT ON COLUMN checks.journal_entry_id IS 'Links to the journal entry for double-entry tracking';
COMMENT ON COLUMN checks.payable_id IS 'Optional link to a payable record if paying a specific bill';
COMMENT ON COLUMN checks.status IS 'Check status: pending (created), printed (sent to printer), voided (cancelled), cleared (cashed), reconciled (matched with bank)';

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE checks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS Policies
-- ============================================================================

-- Users can view checks in their companies
CREATE POLICY "Users can view checks in their companies" ON checks
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- Users can insert checks in their companies
CREATE POLICY "Users can insert checks in their companies" ON checks
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- Users can update checks in their companies
CREATE POLICY "Users can update checks in their companies" ON checks
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- Users can delete checks in their companies (only pending/voided)
CREATE POLICY "Users can delete checks in their companies" ON checks
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM user_companies WHERE user_id = auth.uid()
        )
        AND status IN ('pending', 'voided')
    );

-- ============================================================================
-- STEP 5: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_checks_company_id ON checks(company_id);
CREATE INDEX IF NOT EXISTS idx_checks_transaction_id ON checks(transaction_id);
CREATE INDEX IF NOT EXISTS idx_checks_journal_entry_id ON checks(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_checks_payable_id ON checks(payable_id);
CREATE INDEX IF NOT EXISTS idx_checks_date ON checks(date);
CREATE INDEX IF NOT EXISTS idx_checks_status ON checks(status);
CREATE INDEX IF NOT EXISTS idx_checks_check_number ON checks(company_id, check_number);

-- ============================================================================
-- STEP 6: Create Trigger for updated_at
-- ============================================================================

CREATE TRIGGER update_checks_updated_at
    BEFORE UPDATE ON checks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 7: Create Helper Functions
-- ============================================================================

-- Function to convert number to words (for check amount)
CREATE OR REPLACE FUNCTION number_to_words(amount DECIMAL(12,2))
RETURNS TEXT AS $$
DECLARE
    ones TEXT[] := ARRAY['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                         'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                         'Seventeen', 'Eighteen', 'Nineteen'];
    tens TEXT[] := ARRAY['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    dollars INTEGER;
    cents INTEGER;
    result TEXT := '';
    temp INTEGER;
BEGIN
    dollars := FLOOR(amount)::INTEGER;
    cents := ROUND((amount - dollars) * 100)::INTEGER;

    IF dollars = 0 THEN
        result := 'Zero';
    ELSE
        -- Handle millions
        IF dollars >= 1000000 THEN
            temp := dollars / 1000000;
            IF temp < 20 THEN
                result := result || ones[temp + 1] || ' Million ';
            ELSE
                result := result || tens[(temp / 10) + 1];
                IF temp % 10 > 0 THEN
                    result := result || '-' || ones[(temp % 10) + 1];
                END IF;
                result := result || ' Million ';
            END IF;
            dollars := dollars % 1000000;
        END IF;

        -- Handle thousands
        IF dollars >= 1000 THEN
            temp := dollars / 1000;
            IF temp < 20 THEN
                result := result || ones[temp + 1] || ' Thousand ';
            ELSE
                result := result || tens[(temp / 10) + 1];
                IF temp % 10 > 0 THEN
                    result := result || '-' || ones[(temp % 10) + 1];
                END IF;
                result := result || ' Thousand ';
            END IF;
            dollars := dollars % 1000;
        END IF;

        -- Handle hundreds
        IF dollars >= 100 THEN
            result := result || ones[(dollars / 100) + 1] || ' Hundred ';
            dollars := dollars % 100;
        END IF;

        -- Handle tens and ones
        IF dollars >= 20 THEN
            result := result || tens[(dollars / 10) + 1];
            IF dollars % 10 > 0 THEN
                result := result || '-' || ones[(dollars % 10) + 1];
            END IF;
        ELSIF dollars > 0 THEN
            result := result || ones[dollars + 1];
        END IF;
    END IF;

    result := TRIM(result) || ' and ' || LPAD(cents::TEXT, 2, '0') || '/100 Dollars';

    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get next check number and increment
CREATE OR REPLACE FUNCTION get_next_check_number(company_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    -- Get and increment the next check number atomically
    UPDATE companies
    SET next_check_number = next_check_number + 1
    WHERE id = company_uuid
    RETURNING next_check_number - 1 INTO next_num;

    RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Function to create a check with transaction
CREATE OR REPLACE FUNCTION create_check_with_transaction(
    p_company_id UUID,
    p_user_id UUID,
    p_payee_name TEXT,
    p_payee_address TEXT,
    p_amount DECIMAL(12,2),
    p_memo TEXT,
    p_date DATE,
    p_category TEXT DEFAULT 'Accounts Payable',
    p_payable_id UUID DEFAULT NULL,
    p_check_number INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_check_id UUID;
    new_journal_entry_id UUID;
    actual_check_number INTEGER;
    amount_words TEXT;
BEGIN
    -- Get check number (use provided or get next)
    IF p_check_number IS NULL THEN
        actual_check_number := get_next_check_number(p_company_id);
    ELSE
        actual_check_number := p_check_number;
        -- Update company's next_check_number if this one is higher
        UPDATE companies
        SET next_check_number = GREATEST(next_check_number, p_check_number + 1)
        WHERE id = p_company_id;
    END IF;

    -- Convert amount to words
    amount_words := number_to_words(p_amount);

    -- Create the journal entry for the expense
    new_journal_entry_id := create_simple_double_entry_transaction(
        p_company_id,
        p_user_id,
        p_date,
        'expense',
        p_category,
        p_amount,
        'Check #' || actual_check_number || ' to ' || p_payee_name || COALESCE(' - ' || p_memo, ''),
        'manual'
    );

    -- Create the check record
    INSERT INTO checks (
        company_id,
        user_id,
        journal_entry_id,
        payable_id,
        check_number,
        payee_name,
        payee_address,
        amount,
        amount_in_words,
        memo,
        date,
        status
    ) VALUES (
        p_company_id,
        p_user_id,
        new_journal_entry_id,
        p_payable_id,
        actual_check_number,
        p_payee_name,
        p_payee_address,
        p_amount,
        amount_words,
        p_memo,
        p_date,
        'pending'
    ) RETURNING id INTO new_check_id;

    -- If paying a payable, mark it as paid
    IF p_payable_id IS NOT NULL THEN
        UPDATE payables_receivables
        SET status = 'paid'
        WHERE id = p_payable_id;
    END IF;

    RETURN new_check_id;
END;
$$ LANGUAGE plpgsql;

-- Function to void a check
CREATE OR REPLACE FUNCTION void_check(
    p_check_id UUID,
    p_user_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    check_record RECORD;
BEGIN
    -- Get the check
    SELECT * INTO check_record FROM checks WHERE id = p_check_id;

    IF check_record IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Can only void pending or printed checks
    IF check_record.status NOT IN ('pending', 'printed') THEN
        RAISE EXCEPTION 'Cannot void a check that has been cleared or reconciled';
    END IF;

    -- Void the check
    UPDATE checks
    SET status = 'voided',
        voided_at = NOW(),
        voided_by = p_user_id,
        void_reason = p_reason
    WHERE id = p_check_id;

    -- Soft delete the associated journal entry if exists
    IF check_record.journal_entry_id IS NOT NULL THEN
        PERFORM soft_delete_journal_entry(check_record.journal_entry_id, p_user_id);
    END IF;

    -- If was paying a payable, reopen it
    IF check_record.payable_id IS NOT NULL THEN
        UPDATE payables_receivables
        SET status = 'open'
        WHERE id = check_record.payable_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to mark check as printed
CREATE OR REPLACE FUNCTION mark_check_printed(p_check_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE checks
    SET status = 'printed',
        printed_at = NOW()
    WHERE id = p_check_id AND status = 'pending';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to mark check as cleared
CREATE OR REPLACE FUNCTION mark_check_cleared(p_check_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE checks
    SET status = 'cleared',
        cleared_at = NOW()
    WHERE id = p_check_id AND status IN ('pending', 'printed');

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 8: Grant Permissions
-- ============================================================================

GRANT ALL ON checks TO authenticated;
GRANT EXECUTE ON FUNCTION number_to_words(DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_check_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_check_with_transaction(UUID, UUID, TEXT, TEXT, DECIMAL, TEXT, DATE, TEXT, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION void_check(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_check_printed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_check_cleared(UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Checks table migration completed successfully' as status;
