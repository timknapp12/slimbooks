-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create companies table
CREATE TABLE companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    ein TEXT,
    accounting_method TEXT CHECK (accounting_method IN ('cash', 'accrual')) DEFAULT 'cash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'staff')) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_companies junction table for multi-company support
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

-- Create transactions table
CREATE TABLE transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    type TEXT CHECK (type IN ('income', 'expense', 'asset', 'liability', 'equity')) NOT NULL,
    category TEXT,
    description TEXT,
    source TEXT CHECK (source IN ('manual', 'import')) DEFAULT 'manual',
    is_adjustment BOOLEAN DEFAULT FALSE,
    attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to document transaction types
COMMENT ON COLUMN transactions.type IS 'Transaction type: income (revenue), expense (costs), asset (things owned), liability (things owed), equity (owner''s claim including transfers)';

-- Create payables_receivables table
CREATE TABLE payables_receivables (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    type TEXT CHECK (type IN ('payable', 'receivable')) NOT NULL,
    name TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    due_date DATE,
    status TEXT CHECK (status IN ('open', 'paid')) DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bank_statements table
CREATE TABLE bank_statements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    file_url TEXT NOT NULL,
    parsed_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscriptions table for Stripe integration
CREATE TABLE subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    status TEXT,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pricing_plans table for subscription plans
CREATE TABLE pricing_plans (
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

-- Create chart_of_accounts table
CREATE TABLE chart_of_accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    account_number VARCHAR(10) NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    parent_account_id UUID REFERENCES chart_of_accounts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, account_number)
);

-- Create journal_entries table for double-entry accounting
CREATE TABLE journal_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    reference_number VARCHAR(50),
    description TEXT NOT NULL,
    source TEXT CHECK (source IN ('manual', 'import', 'system')) DEFAULT 'manual',
    is_adjustment BOOLEAN DEFAULT FALSE,
    is_reversed BOOLEAN DEFAULT FALSE,
    reversed_by UUID REFERENCES journal_entries(id),
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transaction_entries table for individual debit/credit entries
CREATE TABLE transaction_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES chart_of_accounts(id) ON DELETE CASCADE NOT NULL,
    debit_amount DECIMAL(12,2) DEFAULT 0,
    credit_amount DECIMAL(12,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure only one of debit or credit is set
    CONSTRAINT check_debit_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR 
        (credit_amount > 0 AND debit_amount = 0)
    )
);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies (multi-company support)
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

-- RLS Policies for user_companies
CREATE POLICY "Users can view their company memberships" ON user_companies
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own company memberships" ON user_companies
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own company memberships" ON user_companies
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own company memberships" ON user_companies
    FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for users
CREATE POLICY "Users can view users in their company" ON users
    FOR SELECT USING (id IN (
        SELECT user_id FROM user_companies WHERE company_id IN (
            SELECT company_id FROM user_companies WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (id = auth.uid());

-- RLS Policies for transactions (multi-company support)
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

-- RLS Policies for payables_receivables (multi-company support)
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

-- RLS Policies for bank_statements (Admin only)
CREATE POLICY "Only admins can view bank statements" ON bank_statements
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Only admins can insert bank statements" ON bank_statements
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- RLS Policies for subscriptions (multi-company support)
CREATE POLICY "Users can view their companies subscriptions" ON subscriptions
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- RLS Policies for pricing_plans (public read access for active plans)
CREATE POLICY "Anyone can view active pricing plans" ON pricing_plans
    FOR SELECT USING (is_active = true);

-- RLS Policies for chart_of_accounts (multi-company support)
CREATE POLICY "Users can view chart of accounts in their companies" ON chart_of_accounts
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admins can insert chart of accounts in their companies" ON chart_of_accounts
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Admins can update chart of accounts in their companies" ON chart_of_accounts
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Admins can delete chart of accounts in their companies" ON chart_of_accounts
    FOR DELETE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- RLS Policies for journal_entries (multi-company support)
CREATE POLICY "Users can view journal entries in their companies" ON journal_entries
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert journal entries in their companies" ON journal_entries
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update journal entries in their companies" ON journal_entries
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete journal entries in their companies" ON journal_entries
    FOR DELETE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- RLS Policies for transaction_entries (multi-company support)
CREATE POLICY "Users can view transaction entries in their companies" ON transaction_entries
    FOR SELECT USING (journal_entry_id IN (
        SELECT id FROM journal_entries WHERE company_id IN (
            SELECT company_id FROM user_companies WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Users can insert transaction entries in their companies" ON transaction_entries
    FOR INSERT WITH CHECK (journal_entry_id IN (
        SELECT id FROM journal_entries WHERE company_id IN (
            SELECT company_id FROM user_companies WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Users can update transaction entries in their companies" ON transaction_entries
    FOR UPDATE USING (journal_entry_id IN (
        SELECT id FROM journal_entries WHERE company_id IN (
            SELECT company_id FROM user_companies WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Users can delete transaction entries in their companies" ON transaction_entries
    FOR DELETE USING (journal_entry_id IN (
        SELECT id FROM journal_entries WHERE company_id IN (
            SELECT company_id FROM user_companies WHERE user_id = auth.uid()
        )
    ));

-- Create indexes for better performance
CREATE INDEX idx_transactions_company_id ON transactions(company_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_payables_receivables_company_id ON payables_receivables(company_id);
CREATE INDEX idx_payables_receivables_status ON payables_receivables(status);
CREATE INDEX idx_user_companies_user_id ON user_companies(user_id);
CREATE INDEX idx_user_companies_company_id ON user_companies(company_id);
CREATE INDEX idx_user_companies_default ON user_companies(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_chart_of_accounts_company_id ON chart_of_accounts(company_id);
CREATE INDEX idx_chart_of_accounts_account_type ON chart_of_accounts(account_type);
CREATE INDEX idx_chart_of_accounts_account_number ON chart_of_accounts(account_number);
CREATE INDEX idx_chart_of_accounts_active ON chart_of_accounts(is_active) WHERE is_active = true;
CREATE INDEX idx_journal_entries_company_id ON journal_entries(company_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(date);
CREATE INDEX idx_journal_entries_source ON journal_entries(source);
CREATE INDEX idx_transaction_entries_journal_entry_id ON transaction_entries(journal_entry_id);
CREATE INDEX idx_transaction_entries_account_id ON transaction_entries(account_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payables_receivables_updated_at BEFORE UPDATE ON payables_receivables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_plans_updated_at BEFORE UPDATE ON pricing_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_companies_updated_at 
    BEFORE UPDATE ON user_companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chart_of_accounts_updated_at 
    BEFORE UPDATE ON chart_of_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at 
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transaction_entries_updated_at 
    BEFORE UPDATE ON transaction_entries
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

-- Function to create company with user (for service role usage)
CREATE OR REPLACE FUNCTION create_company_with_user(
    user_uuid UUID,
    company_name TEXT,
    company_address TEXT DEFAULT NULL,
    company_ein TEXT DEFAULT NULL,
    company_accounting_method TEXT DEFAULT 'cash'
)
RETURNS UUID AS $$
DECLARE
    new_company_id UUID;
BEGIN
    -- Create the company
    INSERT INTO companies (name, address, ein, accounting_method)
    VALUES (company_name, company_address, company_ein, company_accounting_method)
    RETURNING id INTO new_company_id;
    
    -- Create user-company relationship
    INSERT INTO user_companies (user_id, company_id, role, is_default)
    VALUES (user_uuid, new_company_id, 'admin', true);
    
    -- Create default chart of accounts
    PERFORM create_default_chart_of_accounts(new_company_id);
    
    RETURN new_company_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create company with user (for authenticated user usage)
CREATE OR REPLACE FUNCTION create_company_with_user_auth(
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
    user_email_confirmed TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get the current user ID
    current_user_id := auth.uid();
    
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to create a company';
    END IF;
    
    -- Check if email is verified
    SELECT email_confirmed_at INTO user_email_confirmed
    FROM auth.users
    WHERE id = current_user_id;
    
    IF user_email_confirmed IS NULL THEN
        RAISE EXCEPTION 'Email must be verified before creating a company';
    END IF;
    
    -- Create the company
    INSERT INTO companies (name, address, ein, accounting_method)
    VALUES (company_name, company_address, company_ein, company_accounting_method)
    RETURNING id INTO new_company_id;
    
    -- Create the user-company relationship
    INSERT INTO user_companies (user_id, company_id, role, is_default)
    VALUES (current_user_id, new_company_id, 'admin', false);
    
    -- Create default Chart of Accounts for the new company
    PERFORM create_default_chart_of_accounts(new_company_id);
    
    -- Return the new company ID
    RETURN new_company_id;
END;
$$;

-- Function to automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to create default Chart of Accounts for a company
CREATE OR REPLACE FUNCTION create_default_chart_of_accounts(company_uuid UUID)
RETURNS void AS $$
BEGIN
    -- Check if chart of accounts already exists for this company
    IF EXISTS (SELECT 1 FROM chart_of_accounts WHERE company_id = company_uuid LIMIT 1) THEN
        RETURN; -- Already exists, don't create duplicates
    END IF;
    
    -- Assets (1000-1999)
    INSERT INTO chart_of_accounts (company_id, account_number, account_name, account_type, description, is_default) VALUES
    (company_uuid, '1000', 'Cash', 'asset', 'Cash on hand and in bank accounts', true),
    (company_uuid, '1100', 'Accounts Receivable', 'asset', 'Amounts owed by customers', true),
    (company_uuid, '1200', 'Inventory', 'asset', 'Merchandise and supplies held for sale', true),
    (company_uuid, '1300', 'Prepaid Expenses', 'asset', 'Expenses paid in advance', true),
    (company_uuid, '1400', 'Equipment', 'asset', 'Office equipment and machinery', true),
    (company_uuid, '1500', 'Furniture', 'asset', 'Office furniture and fixtures', true),
    (company_uuid, '1600', 'Vehicles', 'asset', 'Company vehicles', true),
    (company_uuid, '1700', 'Buildings', 'asset', 'Company buildings and structures', true),
    (company_uuid, '1800', 'Land', 'asset', 'Company land and property', true),
    (company_uuid, '1900', 'Accumulated Depreciation', 'asset', 'Accumulated depreciation on fixed assets', true);

    -- Liabilities (2000-2999)
    INSERT INTO chart_of_accounts (company_id, account_number, account_name, account_type, description, is_default) VALUES
    (company_uuid, '2000', 'Accounts Payable', 'liability', 'Amounts owed to suppliers and vendors', true),
    (company_uuid, '2100', 'Notes Payable', 'liability', 'Short-term and long-term notes', true),
    (company_uuid, '2200', 'Credit Cards', 'liability', 'Credit card balances', true),
    (company_uuid, '2300', 'Sales Tax Payable', 'liability', 'Sales tax collected but not yet remitted', true),
    (company_uuid, '2400', 'Payroll Taxes Payable', 'liability', 'Employee and employer taxes owed', true),
    (company_uuid, '2500', 'Income Tax Payable', 'liability', 'Income taxes owed', true),
    (company_uuid, '2600', 'Loans Payable', 'liability', 'Bank loans and other borrowings', true),
    (company_uuid, '2700', 'Mortgage Payable', 'liability', 'Mortgage on buildings or land', true);

    -- Equity (3000-3999)
    INSERT INTO chart_of_accounts (company_id, account_number, account_name, account_type, description, is_default) VALUES
    (company_uuid, '3000', 'Owner''s Capital', 'equity', 'Owner''s investment in the business', true),
    (company_uuid, '3100', 'Owner''s Draws', 'equity', 'Owner''s withdrawals from the business', true),
    (company_uuid, '3200', 'Retained Earnings', 'equity', 'Accumulated profits not distributed', true),
    (company_uuid, '3300', 'Common Stock', 'equity', 'Common stock issued', true),
    (company_uuid, '3400', 'Paid-in Capital', 'equity', 'Additional paid-in capital', true);

    -- Revenue (4000-4999)
    INSERT INTO chart_of_accounts (company_id, account_number, account_name, account_type, description, is_default) VALUES
    (company_uuid, '4000', 'Sales Revenue', 'revenue', 'Revenue from sales of goods or services', true),
    (company_uuid, '4100', 'Service Revenue', 'revenue', 'Revenue from services provided', true),
    (company_uuid, '4200', 'Consulting Income', 'revenue', 'Revenue from consulting services', true),
    (company_uuid, '4300', 'Rental Income', 'revenue', 'Revenue from rental of property or equipment', true),
    (company_uuid, '4400', 'Interest Income', 'revenue', 'Interest earned on investments', true),
    (company_uuid, '4500', 'Other Income', 'revenue', 'Other miscellaneous income', true);

    -- Expenses (5000-6999)
    INSERT INTO chart_of_accounts (company_id, account_number, account_name, account_type, description, is_default) VALUES
    (company_uuid, '5000', 'Cost of Goods Sold', 'expense', 'Direct costs of producing goods or services', true),
    (company_uuid, '5100', 'Office Supplies', 'expense', 'Office supplies and materials', true),
    (company_uuid, '5200', 'Travel', 'expense', 'Business travel expenses', true),
    (company_uuid, '5300', 'Meals & Entertainment', 'expense', 'Business meals and entertainment', true),
    (company_uuid, '5400', 'Software & Subscriptions', 'expense', 'Software licenses and subscriptions', true),
    (company_uuid, '5500', 'Marketing', 'expense', 'Marketing and advertising expenses', true),
    (company_uuid, '5600', 'Utilities', 'expense', 'Electricity, water, gas, internet, phone', true),
    (company_uuid, '5700', 'Rent', 'expense', 'Office and equipment rental', true),
    (company_uuid, '5800', 'Insurance', 'expense', 'Business insurance premiums', true),
    (company_uuid, '5900', 'Equipment', 'expense', 'Equipment purchases and maintenance', true),
    (company_uuid, '6000', 'Legal & Accounting', 'expense', 'Legal and accounting fees', true),
    (company_uuid, '6100', 'Bank Fees', 'expense', 'Bank charges and fees', true),
    (company_uuid, '6200', 'Professional Services', 'expense', 'Professional services and consulting', true),
    (company_uuid, '6300', 'Depreciation', 'expense', 'Depreciation expense on fixed assets', true),
    (company_uuid, '6400', 'Interest Expense', 'expense', 'Interest on loans and credit', true),
    (company_uuid, '6500', 'Income Tax Expense', 'expense', 'Income tax expense', true),
    (company_uuid, '6600', 'Other Expenses', 'expense', 'Other miscellaneous expenses', true);
END;
$$ LANGUAGE plpgsql;

-- Function to validate journal entry balance
CREATE OR REPLACE FUNCTION validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_debits DECIMAL(12,2);
    total_credits DECIMAL(12,2);
BEGIN
    -- Calculate totals for the journal entry
    SELECT 
        COALESCE(SUM(debit_amount), 0),
        COALESCE(SUM(credit_amount), 0)
    INTO total_debits, total_credits
    FROM transaction_entries
    WHERE journal_entry_id = NEW.journal_entry_id;
    
    -- Check if debits equal credits
    IF total_debits != total_credits THEN
        RAISE EXCEPTION 'Journal entry is not balanced. Debits: %, Credits: %', total_debits, total_credits;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate balance after insert/update
CREATE TRIGGER validate_journal_entry_balance_trigger
    AFTER INSERT OR UPDATE ON transaction_entries
    FOR EACH ROW EXECUTE FUNCTION validate_journal_entry_balance();

-- Function to generate journal reference numbers
CREATE OR REPLACE FUNCTION generate_journal_reference(company_uuid UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    year_part VARCHAR(4);
    next_number INTEGER;
    reference_number VARCHAR(50);
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    -- Get the next number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(je.reference_number FROM 8) AS INTEGER)), 0) + 1
    INTO next_number
    FROM journal_entries je
    WHERE je.company_id = company_uuid 
    AND je.reference_number LIKE year_part || '-JE-%';
    
    reference_number := year_part || '-JE-' || LPAD(next_number::VARCHAR, 5, '0');
    
    RETURN reference_number;
END;
$$ LANGUAGE plpgsql;

-- Function to create double-entry transactions
CREATE OR REPLACE FUNCTION create_double_entry_transaction(
    p_company_id UUID,
    p_user_id UUID,
    p_date DATE,
    p_description TEXT,
    p_entries JSONB, -- Array of {account_name, debit_amount, credit_amount, description}
    p_source TEXT DEFAULT 'manual'
)
RETURNS UUID AS $$
DECLARE
    journal_entry_id UUID;
    entry_record JSONB;
    account_id UUID;
    reference_number VARCHAR(50);
    i INTEGER;
BEGIN
    -- Generate reference number
    reference_number := generate_journal_reference(p_company_id);
    
    -- Create journal entry
    INSERT INTO journal_entries (
        company_id, 
        user_id, 
        date, 
        reference_number, 
        description, 
        source
    ) VALUES (
        p_company_id,
        p_user_id,
        p_date,
        reference_number,
        p_description,
        p_source
    ) RETURNING id INTO journal_entry_id;
    
    -- Create transaction entries using proper JSONB iteration
    FOR i IN 0..jsonb_array_length(p_entries) - 1
    LOOP
        entry_record := p_entries->i;
        
        -- Get account ID from account name
        SELECT id INTO account_id
        FROM chart_of_accounts
        WHERE company_id = p_company_id 
        AND account_name = entry_record->>'account_name'
        AND is_active = true;
        
        IF account_id IS NULL THEN
            RAISE EXCEPTION 'Account not found: %', entry_record->>'account_name';
        END IF;
        
        -- Insert transaction entry
        INSERT INTO transaction_entries (
            journal_entry_id,
            account_id,
            debit_amount,
            credit_amount,
            description
        ) VALUES (
            journal_entry_id,
            account_id,
            COALESCE((entry_record->>'debit_amount')::DECIMAL(12,2), 0),
            COALESCE((entry_record->>'credit_amount')::DECIMAL(12,2), 0),
            entry_record->>'description'
        );
    END LOOP;
    
    RETURN journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create double-entry transaction from simple transaction
CREATE OR REPLACE FUNCTION create_simple_double_entry_transaction(
    p_company_id UUID,
    p_user_id UUID,
    p_date DATE,
    p_type TEXT, -- 'income', 'expense', 'asset', 'liability', 'equity'
    p_category TEXT, -- account name from chart of accounts
    p_amount DECIMAL(12,2),
    p_description TEXT,
    p_source TEXT DEFAULT 'manual'
)
RETURNS UUID AS $$
DECLARE
    journal_entry_id UUID;
    reference_number VARCHAR(50);
    category_account_id UUID;
    corresponding_account_id UUID;
    corresponding_account_name TEXT;
BEGIN
    -- Generate reference number
    reference_number := generate_journal_reference(p_company_id);
    
    -- Get the category account ID
    SELECT id INTO category_account_id
    FROM chart_of_accounts
    WHERE company_id = p_company_id 
    AND account_name = p_category
    AND is_active = true;
    
    IF category_account_id IS NULL THEN
        RAISE EXCEPTION 'Category account not found: %', p_category;
    END IF;
    
    -- Determine corresponding account based on transaction type
    CASE p_type
        WHEN 'income' THEN
            -- Income: Debit Cash, Credit Revenue
            corresponding_account_name := 'Cash';
        WHEN 'expense' THEN
            -- Expense: Debit Expense, Credit Cash
            corresponding_account_name := 'Cash';
        WHEN 'asset' THEN
            IF p_category = 'Cash' THEN
                -- Cash deposit: Debit Cash, Credit Owner's Capital
                corresponding_account_name := 'Owner''s Capital';
            ELSIF p_category = 'Accounts Receivable' THEN
                -- Credit sale: Debit Accounts Receivable, Credit Sales Revenue
                corresponding_account_name := 'Sales Revenue';
            ELSE
                -- Asset purchase: Debit Asset, Credit Cash
                corresponding_account_name := 'Cash';
            END IF;
        WHEN 'liability' THEN
            -- Liability payment: Debit Liability, Credit Cash
            corresponding_account_name := 'Cash';
        WHEN 'equity' THEN
            IF p_category = 'Owner''s Draws' THEN
                -- Owner's draw: Debit Owner's Draws, Credit Cash
                corresponding_account_name := 'Cash';
            ELSE
                -- Equity investment: Debit Cash, Credit Equity
                corresponding_account_name := 'Cash';
            END IF;
        ELSE
            RAISE EXCEPTION 'Invalid transaction type: %', p_type;
    END CASE;
    
    -- Get the corresponding account ID
    SELECT id INTO corresponding_account_id
    FROM chart_of_accounts
    WHERE company_id = p_company_id 
    AND account_name = corresponding_account_name
    AND is_active = true;
    
    IF corresponding_account_id IS NULL THEN
        RAISE EXCEPTION 'Corresponding account not found: % (company_id: %, type: %, category: %)', 
            corresponding_account_name, p_company_id, p_type, p_category;
    END IF;
    
    -- Create journal entry
    INSERT INTO journal_entries (
        company_id, 
        user_id, 
        date, 
        reference_number, 
        description, 
        source
    ) VALUES (
        p_company_id,
        p_user_id,
        p_date,
        reference_number,
        p_description,
        p_source
    ) RETURNING id INTO journal_entry_id;
    
    -- Create transaction entries based on type
    CASE p_type
        WHEN 'income' THEN
            -- Income: Debit Cash, Credit Revenue
            INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
            VALUES (journal_entry_id, corresponding_account_id, p_amount, 0, p_description);
            INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
            VALUES (journal_entry_id, category_account_id, 0, p_amount, p_description);
            
        WHEN 'expense' THEN
            -- Expense: Debit Expense, Credit Cash
            INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
            VALUES (journal_entry_id, category_account_id, p_amount, 0, p_description);
            INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
            VALUES (journal_entry_id, corresponding_account_id, 0, p_amount, p_description);
            
        WHEN 'asset' THEN
            IF p_category = 'Cash' THEN
                -- Cash deposit: Debit Cash, Credit Owner's Capital
                INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
                VALUES (journal_entry_id, category_account_id, p_amount, 0, p_description);
                INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
                VALUES (journal_entry_id, corresponding_account_id, 0, p_amount, p_description);
            ELSIF p_category = 'Accounts Receivable' THEN
                -- Credit sale: Debit Accounts Receivable, Credit Sales Revenue
                INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
                VALUES (journal_entry_id, category_account_id, p_amount, 0, p_description);
                INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
                VALUES (journal_entry_id, corresponding_account_id, 0, p_amount, p_description);
            ELSE
                -- Asset purchase: Debit Asset, Credit Cash
                INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
                VALUES (journal_entry_id, category_account_id, p_amount, 0, p_description);
                INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
                VALUES (journal_entry_id, corresponding_account_id, 0, p_amount, p_description);
            END IF;
            
        WHEN 'liability' THEN
            -- Liability payment: Debit Liability, Credit Cash
            INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
            VALUES (journal_entry_id, category_account_id, p_amount, 0, p_description);
            INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
            VALUES (journal_entry_id, corresponding_account_id, 0, p_amount, p_description);
            
        WHEN 'equity' THEN
            IF p_category = 'Owner''s Draws' THEN
                -- Owner's draw: Debit Owner's Draws, Credit Cash
                INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
                VALUES (journal_entry_id, category_account_id, p_amount, 0, p_description);
                INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
                VALUES (journal_entry_id, corresponding_account_id, 0, p_amount, p_description);
            ELSE
                -- Equity investment: Debit Cash, Credit Equity
                INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
                VALUES (journal_entry_id, corresponding_account_id, p_amount, 0, p_description);
                INSERT INTO transaction_entries (journal_entry_id, account_id, debit_amount, credit_amount, description)
                VALUES (journal_entry_id, category_account_id, 0, p_amount, p_description);
            END IF;
    END CASE;
    
    RETURN journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get account balance
CREATE OR REPLACE FUNCTION get_account_balance(
    p_company_id UUID,
    p_account_id UUID,
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(12,2) AS $$
DECLARE
    total_debits DECIMAL(12,2);
    total_credits DECIMAL(12,2);
    account_type TEXT;
BEGIN
    -- Get account type
    SELECT account_type INTO account_type
    FROM chart_of_accounts
    WHERE id = p_account_id AND company_id = p_company_id;
    
    -- Calculate totals up to the specified date
    SELECT 
        COALESCE(SUM(te.debit_amount), 0),
        COALESCE(SUM(te.credit_amount), 0)
    INTO total_debits, total_credits
    FROM transaction_entries te
    JOIN journal_entries je ON te.journal_entry_id = je.id
    WHERE te.account_id = p_account_id
    AND je.company_id = p_company_id
    AND je.date <= p_as_of_date
    AND je.is_reversed = false;
    
    -- Return balance based on account type
    CASE account_type
        WHEN 'asset', 'expense' THEN
            RETURN total_debits - total_credits;
        WHEN 'liability', 'equity', 'revenue' THEN
            RETURN total_credits - total_debits;
        ELSE
            RETURN total_debits - total_credits;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Soft Delete Functions and Index

-- Create index for soft delete queries
CREATE INDEX idx_journal_entries_deleted_at ON journal_entries(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create function to manage soft delete limit
CREATE OR REPLACE FUNCTION manage_soft_delete_limit(company_uuid UUID)
RETURNS void AS $$
DECLARE
    deleted_count INTEGER;
    oldest_deleted_id UUID;
    oldest_deleted_description TEXT;
BEGIN
    -- Count soft deleted entries for this company
    SELECT COUNT(*) INTO deleted_count
    FROM journal_entries
    WHERE company_id = company_uuid AND deleted_at IS NOT NULL;
    
    -- Log the count for debugging
    RAISE NOTICE 'Company % has % soft deleted entries', company_uuid, deleted_count;
    
    -- If 3 or more soft deleted entries, permanently delete the oldest one to maintain limit of 3
    IF deleted_count >= 3 THEN
        SELECT id, description INTO oldest_deleted_id, oldest_deleted_description
        FROM journal_entries
        WHERE company_id = company_uuid AND deleted_at IS NOT NULL
        ORDER BY deleted_at ASC
        LIMIT 1;
        
        -- Log what we're about to delete
        RAISE NOTICE 'Permanently deleting oldest soft deleted entry: % - %', oldest_deleted_id, oldest_deleted_description;
        
        -- Permanently delete the oldest soft deleted entry
        DELETE FROM journal_entries WHERE id = oldest_deleted_id;
        
        RAISE NOTICE 'Successfully deleted entry %', oldest_deleted_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to soft delete a journal entry
CREATE OR REPLACE FUNCTION soft_delete_journal_entry(
    journal_entry_uuid UUID,
    user_uuid UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    company_uuid UUID;
BEGIN
    -- Get the company_id for this journal entry
    SELECT company_id INTO company_uuid
    FROM journal_entries
    WHERE id = journal_entry_uuid;
    
    IF company_uuid IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Soft delete the journal entry
    UPDATE journal_entries
    SET deleted_at = NOW(),
        deleted_by = user_uuid
    WHERE id = journal_entry_uuid;
    
    -- Manage the soft delete limit
    PERFORM manage_soft_delete_limit(company_uuid);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to restore a soft deleted journal entry
CREATE OR REPLACE FUNCTION restore_journal_entry(journal_entry_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE journal_entries
    SET deleted_at = NULL,
        deleted_by = NULL
    WHERE id = journal_entry_uuid AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create storage bucket for bank statements (only if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
SELECT 'bank-statements', 'bank-statements', false
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'bank-statements'
);

-- Storage policies for bank-statements bucket
CREATE POLICY "Only authenticated users can upload bank statements" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'bank-statements' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Only authenticated users can view their bank statements" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'bank-statements' AND 
    auth.uid() IS NOT NULL
  );

-- Insert default pricing plan
INSERT INTO pricing_plans (name, description, price, stripe_price_id, is_active, features)
VALUES (
    'Basic Plan',
    'Perfect for small businesses getting started with accounting',
    29.00,
    NULL,
    true,
    '["Unlimited transactions", "Financial reports (P&L, Balance Sheet, Cash Flow)", "Bank statement import", "Payables & receivables tracking", "Multiple users", "Email support"]'::jsonb
);

-- Grant necessary permissions
GRANT ALL ON subscriptions TO authenticated;
GRANT ALL ON pricing_plans TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION create_company_with_user TO service_role;
GRANT EXECUTE ON FUNCTION create_company_with_user_auth TO authenticated;
GRANT EXECUTE ON FUNCTION create_double_entry_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION create_simple_double_entry_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_balance TO authenticated;
GRANT EXECUTE ON FUNCTION generate_journal_reference TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_journal_entry TO authenticated;
GRANT EXECUTE ON FUNCTION restore_journal_entry TO authenticated;
GRANT EXECUTE ON FUNCTION manage_soft_delete_limit TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_chart_of_accounts TO authenticated;
GRANT ALL ON journal_entries TO authenticated;
GRANT ALL ON transaction_entries TO authenticated;