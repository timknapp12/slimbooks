export interface Transaction {
  id: string
  date: string
  amount: number
  type: 'income' | 'expense' | 'asset' | 'liability' | 'equity'
  category: string
  description: string
  source: 'manual' | 'import'
  reference_number?: string
  created_at?: string
}

export interface TransactionEntry {
  debit_amount: number
  credit_amount: number
  chart_of_accounts: {
    account_name: string
    account_type: string
  }
}

export interface JournalEntry {
  id: string
  date: string
  description: string
  source: string
  reference_number?: string
  created_at?: string
  transaction_entries: TransactionEntry[]
}

export interface ChartOfAccount {
  account_name: string
  account_type: string
  account_number?: string
}

export interface TransactionFormData {
  date: string
  amount: string
  type: 'income' | 'expense' | 'asset' | 'liability' | 'equity'
  category: string
  description: string
}

// Customer Management Types
export interface Customer {
  id: string
  company_id: string
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  tax_id?: string
  payment_terms: number
  credit_limit: number
  is_active: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export interface CustomerFormData {
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  tax_id?: string
  payment_terms: number
  credit_limit: number
  notes?: string
}

// Invoice Management Types
export interface Invoice {
  id: string
  company_id: string
  customer_id: string
  customer?: Customer
  invoice_number: string
  date: string
  due_date: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  terms?: string
  notes?: string
  sent_at?: string
  viewed_at?: string
  created_at: string
  updated_at: string
  invoice_line_items?: InvoiceLineItem[]
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
  created_at: string
  updated_at: string
}

export interface InvoiceFormData {
  customer_id: string
  date: string
  due_date: string
  tax_rate: number
  terms?: string
  notes?: string
  line_items: InvoiceLineItemFormData[]
}

export interface InvoiceLineItemFormData {
  description: string
  quantity: number
  unit_price: number
}

// Payment Management Types
export interface Payment {
  id: string
  company_id: string
  invoice_id?: string
  customer_id: string
  customer?: Customer
  invoice?: Invoice
  payment_number: string
  date: string
  amount: number
  payment_method: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'other'
  reference_number?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface PaymentFormData {
  invoice_id?: string
  customer_id: string
  date: string
  amount: number
  payment_method: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'other'
  reference_number?: string
  notes?: string
}

// Vendor Management Types
export interface Vendor {
  id: string
  company_id: string
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  tax_id?: string
  payment_terms: number
  is_active: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export interface VendorFormData {
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  tax_id?: string
  payment_terms: number
  notes?: string
}

// Expense Management Types
export interface Expense {
  id: string
  company_id: string
  vendor_id?: string
  vendor?: Vendor
  expense_number: string
  date: string
  amount: number
  category: string
  description: string
  payment_method: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'other'
  reference_number?: string
  is_recurring: boolean
  recurring_frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  recurring_end_date?: string
  next_occurrence_date?: string
  receipt_url?: string
  notes?: string
  source: 'manual' | 'import' | 'recurring'
  created_at: string
  updated_at: string
}

export interface ExpenseFormData {
  vendor_id?: string
  date: string
  amount: number
  category: string
  description: string
  payment_method: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'other'
  reference_number?: string
  is_recurring: boolean
  recurring_frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  recurring_end_date?: string
  receipt_file?: File
  notes?: string
}

// Recurring Expense Types
export interface RecurringExpense {
  id: string
  company_id: string
  vendor_id?: string
  vendor?: Vendor
  name: string
  amount: number
  category: string
  description: string
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  start_date: string
  end_date?: string
  next_occurrence_date: string
  is_active: boolean
  payment_method: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'other'
  notes?: string
  created_at: string
  updated_at: string
}

export interface RecurringExpenseFormData {
  vendor_id?: string
  name: string
  amount: number
  category: string
  description: string
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  start_date: string
  end_date?: string
  payment_method: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'other'
  notes?: string
} 