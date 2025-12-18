export type CheckStatus = 'pending' | 'printed' | 'voided' | 'cleared' | 'reconciled'

export interface Check {
  id: string
  company_id: string
  user_id?: string
  transaction_id?: string
  journal_entry_id?: string
  payable_id?: string
  check_number: number
  payee_name: string
  payee_address?: string
  amount: number
  amount_in_words?: string
  memo?: string
  date: string
  bank_routing_number?: string
  bank_account_number?: string
  status: CheckStatus
  printed_at?: string
  voided_at?: string
  voided_by?: string
  void_reason?: string
  cleared_at?: string
  created_at?: string
  updated_at?: string
}

export interface CheckFormData {
  payee_name: string
  payee_address: string
  amount: string
  memo: string
  date: string
  category: string
  check_number?: string
}

export interface Payable {
  id: string
  company_id: string
  type: 'payable' | 'receivable'
  name: string
  amount: number
  due_date?: string
  status: 'open' | 'paid'
  created_at?: string
  updated_at?: string
}

export interface CheckPrintData {
  check_number: number
  date: string
  payee_name: string
  payee_address?: string
  amount: number
  amount_in_words: string
  memo?: string
  company_name?: string
  company_address?: string
}

export interface CompanyBankInfo {
  bank_name?: string
  bank_routing_number?: string
  bank_account_number?: string
}
