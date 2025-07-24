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

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;

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

-- Create indexes for better performance
CREATE INDEX idx_transactions_company_id ON transactions(company_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_payables_receivables_company_id ON payables_receivables(company_id);
CREATE INDEX idx_payables_receivables_status ON payables_receivables(status);
CREATE INDEX idx_user_companies_user_id ON user_companies(user_id);
CREATE INDEX idx_user_companies_company_id ON user_companies(company_id);
CREATE INDEX idx_user_companies_default ON user_companies(user_id, is_default) WHERE is_default = true;

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

-- Create storage bucket for bank statements
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-statements', 'bank-statements', false);

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