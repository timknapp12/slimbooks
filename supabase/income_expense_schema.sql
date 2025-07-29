-- Income Tracking Schema Extensions
-- Customers table for customer management
CREATE TABLE customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'US',
    tax_id TEXT,
    payment_terms INTEGER DEFAULT 30, -- Net payment terms in days
    credit_limit DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table for invoice management
CREATE TABLE invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5,4) DEFAULT 0, -- Tax rate as decimal (e.g., 0.0825 for 8.25%)
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled')) DEFAULT 'draft',
    terms TEXT,
    notes TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, invoice_number)
);

-- Invoice line items
CREATE TABLE invoice_line_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table for tracking invoice payments
CREATE TABLE payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    payment_number VARCHAR(50),
    date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'check', 'credit_card', 'bank_transfer', 'other')) DEFAULT 'cash',
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expense Tracking Schema Extensions
-- Vendors table for vendor management
CREATE TABLE vendors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'US',
    tax_id TEXT,
    payment_terms INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced expenses table
CREATE TABLE expenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    expense_number VARCHAR(50),
    date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'check', 'credit_card', 'bank_transfer', 'other')) DEFAULT 'cash',
    reference_number TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurring_frequency TEXT CHECK (recurring_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    recurring_end_date DATE,
    next_occurrence_date DATE,
    receipt_url TEXT,
    notes TEXT,
    source TEXT CHECK (source IN ('manual', 'import', 'recurring')) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recurring expenses template
CREATE TABLE recurring_expenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    frequency TEXT CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    next_occurrence_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    payment_method TEXT CHECK (payment_method IN ('cash', 'check', 'credit_card', 'bank_transfer', 'other')) DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
SELECT 'receipts', 'receipts', false
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'receipts'
);

-- Enable RLS on new tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Users can view customers in their companies" ON customers
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert customers in their companies" ON customers
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update customers in their companies" ON customers
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete customers in their companies" ON customers
    FOR DELETE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- RLS Policies for invoices
CREATE POLICY "Users can view invoices in their companies" ON invoices
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert invoices in their companies" ON invoices
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update invoices in their companies" ON invoices
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete invoices in their companies" ON invoices
    FOR DELETE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- RLS Policies for invoice_line_items
CREATE POLICY "Users can view invoice line items in their companies" ON invoice_line_items
    FOR SELECT USING (invoice_id IN (
        SELECT id FROM invoices WHERE company_id IN (
            SELECT company_id FROM user_companies WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Users can insert invoice line items in their companies" ON invoice_line_items
    FOR INSERT WITH CHECK (invoice_id IN (
        SELECT id FROM invoices WHERE company_id IN (
            SELECT company_id FROM user_companies WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Users can update invoice line items in their companies" ON invoice_line_items
    FOR UPDATE USING (invoice_id IN (
        SELECT id FROM invoices WHERE company_id IN (
            SELECT company_id FROM user_companies WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Users can delete invoice line items in their companies" ON invoice_line_items
    FOR DELETE USING (invoice_id IN (
        SELECT id FROM invoices WHERE company_id IN (
            SELECT company_id FROM user_companies WHERE user_id = auth.uid()
        )
    ));

-- RLS Policies for payments
CREATE POLICY "Users can view payments in their companies" ON payments
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert payments in their companies" ON payments
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update payments in their companies" ON payments
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete payments in their companies" ON payments
    FOR DELETE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- RLS Policies for vendors
CREATE POLICY "Users can view vendors in their companies" ON vendors
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert vendors in their companies" ON vendors
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update vendors in their companies" ON vendors
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete vendors in their companies" ON vendors
    FOR DELETE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- RLS Policies for expenses
CREATE POLICY "Users can view expenses in their companies" ON expenses
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert expenses in their companies" ON expenses
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update expenses in their companies" ON expenses
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete expenses in their companies" ON expenses
    FOR DELETE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- RLS Policies for recurring_expenses
CREATE POLICY "Users can view recurring expenses in their companies" ON recurring_expenses
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert recurring expenses in their companies" ON recurring_expenses
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update recurring expenses in their companies" ON recurring_expenses
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete recurring expenses in their companies" ON recurring_expenses
    FOR DELETE USING (company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    ));

-- Storage policies for receipts bucket
CREATE POLICY "Users can upload receipts" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'receipts' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view receipts" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'receipts' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update receipts" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'receipts' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete receipts" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'receipts' AND 
    auth.uid() IS NOT NULL
  );

-- Create indexes for better performance
CREATE INDEX idx_customers_company_id ON customers(company_id);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_active ON customers(is_active) WHERE is_active = true;

CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_date ON invoices(date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);

CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);

CREATE INDEX idx_payments_company_id ON payments(company_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_date ON payments(date);

CREATE INDEX idx_vendors_company_id ON vendors(company_id);
CREATE INDEX idx_vendors_name ON vendors(name);
CREATE INDEX idx_vendors_active ON vendors(is_active) WHERE is_active = true;

CREATE INDEX idx_expenses_company_id ON expenses(company_id);
CREATE INDEX idx_expenses_vendor_id ON expenses(vendor_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_recurring ON expenses(is_recurring) WHERE is_recurring = true;

CREATE INDEX idx_recurring_expenses_company_id ON recurring_expenses(company_id);
CREATE INDEX idx_recurring_expenses_next_occurrence ON recurring_expenses(next_occurrence_date);
CREATE INDEX idx_recurring_expenses_active ON recurring_expenses(is_active) WHERE is_active = true;

-- Add updated_at triggers for new tables
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_line_items_updated_at BEFORE UPDATE ON invoice_line_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_expenses_updated_at BEFORE UPDATE ON recurring_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number(company_uuid UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    year_part VARCHAR(4);
    next_number INTEGER;
    invoice_number VARCHAR(50);
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    -- Get the next number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(i.invoice_number FROM 8) AS INTEGER)), 0) + 1
    INTO next_number
    FROM invoices i
    WHERE i.company_id = company_uuid 
    AND i.invoice_number LIKE year_part || '-INV-%';
    
    invoice_number := year_part || '-INV-' || LPAD(next_number::VARCHAR, 5, '0');
    
    RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate expense numbers
CREATE OR REPLACE FUNCTION generate_expense_number(company_uuid UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    year_part VARCHAR(4);
    next_number INTEGER;
    expense_number VARCHAR(50);
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    -- Get the next number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(e.expense_number FROM 8) AS INTEGER)), 0) + 1
    INTO next_number
    FROM expenses e
    WHERE e.company_id = company_uuid 
    AND e.expense_number LIKE year_part || '-EXP-%';
    
    expense_number := year_part || '-EXP-' || LPAD(next_number::VARCHAR, 5, '0');
    
    RETURN expense_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate payment numbers
CREATE OR REPLACE FUNCTION generate_payment_number(company_uuid UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    year_part VARCHAR(4);
    next_number INTEGER;
    payment_number VARCHAR(50);
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    -- Get the next number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(p.payment_number FROM 8) AS INTEGER)), 0) + 1
    INTO next_number
    FROM payments p
    WHERE p.company_id = company_uuid 
    AND p.payment_number LIKE year_part || '-PAY-%';
    
    payment_number := year_part || '-PAY-' || LPAD(next_number::VARCHAR, 5, '0');
    
    RETURN payment_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice totals when line items change
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    invoice_subtotal DECIMAL(12,2);
    invoice_tax_amount DECIMAL(12,2);
    invoice_total DECIMAL(12,2);
    tax_rate DECIMAL(5,4);
BEGIN
    -- Get the current tax rate for the invoice
    SELECT i.tax_rate INTO tax_rate
    FROM invoices i
    WHERE i.id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Calculate new subtotal
    SELECT COALESCE(SUM(line_total), 0) INTO invoice_subtotal
    FROM invoice_line_items
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Calculate tax amount
    invoice_tax_amount := invoice_subtotal * tax_rate;
    
    -- Calculate total
    invoice_total := invoice_subtotal + invoice_tax_amount;
    
    -- Update the invoice
    UPDATE invoices
    SET subtotal = invoice_subtotal,
        tax_amount = invoice_tax_amount,
        total_amount = invoice_total,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice totals when line items change
CREATE TRIGGER update_invoice_totals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
    FOR EACH ROW EXECUTE FUNCTION update_invoice_totals();

-- Function to update invoice status based on payments
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
    total_paid DECIMAL(12,2);
    invoice_total DECIMAL(12,2);
    new_status TEXT;
    invoice_due_date DATE;
BEGIN
    -- Get total payments for the invoice
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM payments
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Get invoice total and due date
    SELECT total_amount, due_date INTO invoice_total, invoice_due_date
    FROM invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Determine new status
    IF total_paid = 0 THEN
        IF invoice_due_date < CURRENT_DATE THEN
            new_status := 'overdue';
        ELSE
            new_status := 'sent';
        END IF;
    ELSIF total_paid >= invoice_total THEN
        new_status := 'paid';
    ELSE
        new_status := 'partial';
    END IF;
    
    -- Update invoice status and amount paid
    UPDATE invoices
    SET status = new_status,
        amount_paid = total_paid,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice status when payments change
CREATE TRIGGER update_invoice_status_trigger
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_status();

-- Function to create journal entries for invoices
CREATE OR REPLACE FUNCTION create_invoice_journal_entry(
    p_invoice_id UUID
)
RETURNS UUID AS $$
DECLARE
    invoice_record RECORD;
    journal_entry_id UUID;
    ar_account_id UUID;
    revenue_account_id UUID;
    tax_account_id UUID;
BEGIN
    -- Get invoice details
    SELECT i.*, c.name as customer_name
    INTO invoice_record
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.id = p_invoice_id;
    
    -- Get account IDs
    SELECT id INTO ar_account_id
    FROM chart_of_accounts
    WHERE company_id = invoice_record.company_id 
    AND account_name = 'Accounts Receivable'
    AND is_active = true;
    
    SELECT id INTO revenue_account_id
    FROM chart_of_accounts
    WHERE company_id = invoice_record.company_id 
    AND account_name = 'Sales Revenue'
    AND is_active = true;
    
    SELECT id INTO tax_account_id
    FROM chart_of_accounts
    WHERE company_id = invoice_record.company_id 
    AND account_name = 'Sales Tax Payable'
    AND is_active = true;
    
    -- Create journal entry
    INSERT INTO journal_entries (
        company_id, 
        date, 
        reference_number, 
        description, 
        source
    ) VALUES (
        invoice_record.company_id,
        invoice_record.date,
        'INV-' || invoice_record.invoice_number,
        'Invoice to ' || invoice_record.customer_name,
        'system'
    ) RETURNING id INTO journal_entry_id;
    
    -- Debit Accounts Receivable for total amount
    INSERT INTO transaction_entries (
        journal_entry_id,
        account_id,
        debit_amount,
        credit_amount,
        description
    ) VALUES (
        journal_entry_id,
        ar_account_id,
        invoice_record.total_amount,
        0,
        'Invoice ' || invoice_record.invoice_number
    );
    
    -- Credit Sales Revenue for subtotal
    INSERT INTO transaction_entries (
        journal_entry_id,
        account_id,
        debit_amount,
        credit_amount,
        description
    ) VALUES (
        journal_entry_id,
        revenue_account_id,
        0,
        invoice_record.subtotal,
        'Invoice ' || invoice_record.invoice_number
    );
    
    -- Credit Sales Tax Payable for tax amount (if any)
    IF invoice_record.tax_amount > 0 THEN
        INSERT INTO transaction_entries (
            journal_entry_id,
            account_id,
            debit_amount,
            credit_amount,
            description
        ) VALUES (
            journal_entry_id,
            tax_account_id,
            0,
            invoice_record.tax_amount,
            'Sales tax on invoice ' || invoice_record.invoice_number
        );
    END IF;
    
    RETURN journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create journal entries for payments
CREATE OR REPLACE FUNCTION create_payment_journal_entry(
    p_payment_id UUID
)
RETURNS UUID AS $$
DECLARE
    payment_record RECORD;
    journal_entry_id UUID;
    cash_account_id UUID;
    ar_account_id UUID;
BEGIN
    -- Get payment details
    SELECT p.*, c.name as customer_name, i.invoice_number
    INTO payment_record
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    LEFT JOIN invoices i ON p.invoice_id = i.id
    WHERE p.id = p_payment_id;
    
    -- Get account IDs
    SELECT id INTO cash_account_id
    FROM chart_of_accounts
    WHERE company_id = payment_record.company_id 
    AND account_name = 'Cash'
    AND is_active = true;
    
    SELECT id INTO ar_account_id
    FROM chart_of_accounts
    WHERE company_id = payment_record.company_id 
    AND account_name = 'Accounts Receivable'
    AND is_active = true;
    
    -- Create journal entry
    INSERT INTO journal_entries (
        company_id, 
        date, 
        reference_number, 
        description, 
        source
    ) VALUES (
        payment_record.company_id,
        payment_record.date,
        'PAY-' || payment_record.payment_number,
        'Payment from ' || payment_record.customer_name || 
        CASE WHEN payment_record.invoice_number IS NOT NULL 
             THEN ' for invoice ' || payment_record.invoice_number 
             ELSE '' END,
        'system'
    ) RETURNING id INTO journal_entry_id;
    
    -- Debit Cash
    INSERT INTO transaction_entries (
        journal_entry_id,
        account_id,
        debit_amount,
        credit_amount,
        description
    ) VALUES (
        journal_entry_id,
        cash_account_id,
        payment_record.amount,
        0,
        'Payment ' || payment_record.payment_number
    );
    
    -- Credit Accounts Receivable
    INSERT INTO transaction_entries (
        journal_entry_id,
        account_id,
        debit_amount,
        credit_amount,
        description
    ) VALUES (
        journal_entry_id,
        ar_account_id,
        0,
        payment_record.amount,
        'Payment ' || payment_record.payment_number
    );
    
    RETURN journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create journal entries for expenses
CREATE OR REPLACE FUNCTION create_expense_journal_entry(
    p_expense_id UUID
)
RETURNS UUID AS $$
DECLARE
    expense_record RECORD;
    journal_entry_id UUID;
    expense_account_id UUID;
    cash_account_id UUID;
    ap_account_id UUID;
BEGIN
    -- Get expense details
    SELECT e.*, v.name as vendor_name
    INTO expense_record
    FROM expenses e
    LEFT JOIN vendors v ON e.vendor_id = v.id
    WHERE e.id = p_expense_id;
    
    -- Get expense account ID by category
    SELECT id INTO expense_account_id
    FROM chart_of_accounts
    WHERE company_id = expense_record.company_id 
    AND account_name = expense_record.category
    AND is_active = true;
    
    -- If category doesn't match an account, use "Other Expenses"
    IF expense_account_id IS NULL THEN
        SELECT id INTO expense_account_id
        FROM chart_of_accounts
        WHERE company_id = expense_record.company_id 
        AND account_name = 'Other Expenses'
        AND is_active = true;
    END IF;
    
    -- Get cash account ID
    SELECT id INTO cash_account_id
    FROM chart_of_accounts
    WHERE company_id = expense_record.company_id 
    AND account_name = 'Cash'
    AND is_active = true;
    
    -- Get accounts payable ID
    SELECT id INTO ap_account_id
    FROM chart_of_accounts
    WHERE company_id = expense_record.company_id 
    AND account_name = 'Accounts Payable'
    AND is_active = true;
    
    -- Create journal entry
    INSERT INTO journal_entries (
        company_id, 
        date, 
        reference_number, 
        description, 
        source
    ) VALUES (
        expense_record.company_id,
        expense_record.date,
        'EXP-' || expense_record.expense_number,
        'Expense: ' || expense_record.description ||
        CASE WHEN expense_record.vendor_name IS NOT NULL 
             THEN ' - ' || expense_record.vendor_name 
             ELSE '' END,
        'system'
    ) RETURNING id INTO journal_entry_id;
    
    -- Debit Expense Account
    INSERT INTO transaction_entries (
        journal_entry_id,
        account_id,
        debit_amount,
        credit_amount,
        description
    ) VALUES (
        journal_entry_id,
        expense_account_id,
        expense_record.amount,
        0,
        'Expense ' || expense_record.expense_number
    );
    
    -- Credit Cash or Accounts Payable based on payment method
    IF expense_record.payment_method IN ('cash', 'check', 'credit_card', 'bank_transfer') THEN
        -- Credit Cash for immediate payments
        INSERT INTO transaction_entries (
            journal_entry_id,
            account_id,
            debit_amount,
            credit_amount,
            description
        ) VALUES (
            journal_entry_id,
            cash_account_id,
            0,
            expense_record.amount,
            'Expense payment ' || expense_record.expense_number
        );
    ELSE
        -- Credit Accounts Payable for unpaid expenses
        INSERT INTO transaction_entries (
            journal_entry_id,
            account_id,
            debit_amount,
            credit_amount,
            description
        ) VALUES (
            journal_entry_id,
            ap_account_id,
            0,
            expense_record.amount,
            'Expense payable ' || expense_record.expense_number
        );
    END IF;
    
    RETURN journal_entry_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process recurring expenses
CREATE OR REPLACE FUNCTION process_recurring_expenses()
RETURNS INTEGER AS $$
DECLARE
    recurring_expense RECORD;
    new_expense_id UUID;
    next_date DATE;
    processed_count INTEGER := 0;
BEGIN
    -- Process all active recurring expenses that are due
    FOR recurring_expense IN 
        SELECT * FROM recurring_expenses 
        WHERE is_active = true 
        AND next_occurrence_date <= CURRENT_DATE
        AND (end_date IS NULL OR next_occurrence_date <= end_date)
    LOOP
        -- Generate expense number
        INSERT INTO expenses (
            company_id,
            vendor_id,
            expense_number,
            date,
            amount,
            category,
            description,
            payment_method,
            notes,
            source
        ) VALUES (
            recurring_expense.company_id,
            recurring_expense.vendor_id,
            generate_expense_number(recurring_expense.company_id),
            recurring_expense.next_occurrence_date,
            recurring_expense.amount,
            recurring_expense.category,
            recurring_expense.description || ' (Recurring)',
            recurring_expense.payment_method,
            recurring_expense.notes,
            'recurring'
        ) RETURNING id INTO new_expense_id;
        
        -- Create journal entry for the expense
        PERFORM create_expense_journal_entry(new_expense_id);
        
        -- Calculate next occurrence date
        CASE recurring_expense.frequency
            WHEN 'weekly' THEN
                next_date := recurring_expense.next_occurrence_date + INTERVAL '1 week';
            WHEN 'monthly' THEN
                next_date := recurring_expense.next_occurrence_date + INTERVAL '1 month';
            WHEN 'quarterly' THEN
                next_date := recurring_expense.next_occurrence_date + INTERVAL '3 months';
            WHEN 'yearly' THEN
                next_date := recurring_expense.next_occurrence_date + INTERVAL '1 year';
        END CASE;
        
        -- Update next occurrence date or deactivate if past end date
        IF recurring_expense.end_date IS NOT NULL AND next_date > recurring_expense.end_date THEN
            UPDATE recurring_expenses
            SET is_active = false,
                updated_at = NOW()
            WHERE id = recurring_expense.id;
        ELSE
            UPDATE recurring_expenses
            SET next_occurrence_date = next_date,
                updated_at = NOW()
            WHERE id = recurring_expense.id;
        END IF;
        
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions on new functions
GRANT EXECUTE ON FUNCTION generate_invoice_number TO authenticated;
GRANT EXECUTE ON FUNCTION generate_expense_number TO authenticated;
GRANT EXECUTE ON FUNCTION generate_payment_number TO authenticated;
GRANT EXECUTE ON FUNCTION create_invoice_journal_entry TO authenticated;
GRANT EXECUTE ON FUNCTION create_payment_journal_entry TO authenticated;
GRANT EXECUTE ON FUNCTION create_expense_journal_entry TO authenticated;
GRANT EXECUTE ON FUNCTION process_recurring_expenses TO authenticated;

-- Grant permissions on new tables
GRANT ALL ON customers TO authenticated;
GRANT ALL ON invoices TO authenticated;
GRANT ALL ON invoice_line_items TO authenticated;
GRANT ALL ON payments TO authenticated;
GRANT ALL ON vendors TO authenticated;
GRANT ALL ON expenses TO authenticated;
GRANT ALL ON recurring_expenses TO authenticated;