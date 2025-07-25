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