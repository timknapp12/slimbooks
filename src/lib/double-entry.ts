import { SupabaseClient } from '@supabase/supabase-js'

export interface DoubleEntryTransaction {
  companyId: string
  userId: string
  date: string
  description: string
  source: 'manual' | 'import' | 'system'
  entries: Array<{
    accountName: string
    debitAmount?: number
    creditAmount?: number
    description?: string
  }>
}

export interface TransactionEntry {
  accountName: string
  debitAmount?: number
  creditAmount?: number
  description?: string
}

/**
 * Creates a double-entry transaction using the database function
 */
export async function createDoubleEntryTransaction(
  supabase: SupabaseClient,
  transaction: DoubleEntryTransaction
): Promise<string> {
  const { data, error } = await supabase.rpc('create_double_entry_transaction', {
    p_company_id: transaction.companyId,
    p_user_id: transaction.userId,
    p_date: transaction.date,
    p_description: transaction.description,
    p_entries: transaction.entries,
    p_source: transaction.source
  })

  if (error) {
    console.error('Error creating double-entry transaction:', error)
    throw new Error(`Failed to create transaction: ${error.message}`)
  }

  return data
}

/**
 * Creates a simple double-entry transaction using the new database function
 * This function properly uses the company's Chart of Accounts
 */
export async function createSimpleDoubleEntryTransaction(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  date: string,
  type: 'income' | 'expense' | 'asset' | 'liability' | 'equity',
  category: string,
  amount: number,
  description: string,
  source: 'manual' | 'import' | 'system' = 'manual'
): Promise<string> {
  const { data, error } = await supabase.rpc('create_simple_double_entry_transaction', {
    p_company_id: companyId,
    p_user_id: userId,
    p_date: date,
    p_type: type,
    p_category: category,
    p_amount: amount,
    p_description: description,
    p_source: source
  })

  if (error) {
    console.error('Error creating simple double-entry transaction:', error)
    throw new Error(`Failed to create transaction: ${error.message}`)
  }

  return data
}

/**
 * Returns the default corresponding account for transactions
 * Most transactions are balanced with Cash
 */
export function getCorrespondingAccount(): string {
  return 'Cash'
}

/**
 * Creates the appropriate double-entry entries for a transaction
 * Following GAAP principles where:
 * - Transaction type determines the primary account category
 * - Category is the specific account name from chart of accounts
 * - Corresponding account balances the transaction
 * 
 * Note: This function assumes the category parameter is a valid account name
 * from the company's Chart of Accounts. The corresponding account (usually Cash)
 * should also exist in the company's Chart of Accounts.
 */
export function createDoubleEntryEntries(
  type: 'income' | 'expense' | 'asset' | 'liability' | 'equity',
  category: string,
  amount: number,
  description: string
): TransactionEntry[] {
  const entries: TransactionEntry[] = []
  
  // The category parameter should be a valid account name from the company's Chart of Accounts
  // The corresponding account (typically Cash) should also exist in the company's Chart of Accounts
  
  switch (type) {
    case 'income':
      // Income: Debit Cash, Credit the specific revenue account (category)
      // Both "Cash" and the category (e.g., "Sales Revenue") must exist in Chart of Accounts
      entries.push(
        { accountName: 'Cash', debitAmount: amount, description },
        { accountName: category, creditAmount: amount, description }
      )
      break
      
    case 'expense':
      // Expense: Debit the specific expense account (category), Credit Cash
      // Both the category (e.g., "Rent Expense") and "Cash" must exist in Chart of Accounts
      entries.push(
        { accountName: category, debitAmount: amount, description },
        { accountName: 'Cash', creditAmount: amount, description }
      )
      break
      
    case 'asset':
      if (category === 'Cash') {
        // Cash deposit: Debit Cash, Credit Owner's Capital
        // Both "Cash" and "Owner's Capital" must exist in Chart of Accounts
        entries.push(
          { accountName: 'Cash', debitAmount: amount, description },
          { accountName: 'Owner\'s Capital', creditAmount: amount, description }
        )
      } else if (category === 'Accounts Receivable') {
        // Credit sale: Debit Accounts Receivable, Credit Sales Revenue
        // Both "Accounts Receivable" and "Sales Revenue" must exist in Chart of Accounts
        entries.push(
          { accountName: 'Accounts Receivable', debitAmount: amount, description },
          { accountName: 'Sales Revenue', creditAmount: amount, description }
        )
      } else {
        // Asset purchase: Debit the specific asset account (category), Credit Cash
        // Both the category (e.g., "Equipment") and "Cash" must exist in Chart of Accounts
        entries.push(
          { accountName: category, debitAmount: amount, description },
          { accountName: 'Cash', creditAmount: amount, description }
        )
      }
      break
      
    case 'liability':
      // Liability payment: Debit the specific liability account (category), Credit Cash
      // Both the category (e.g., "Accounts Payable") and "Cash" must exist in Chart of Accounts
      entries.push(
        { accountName: category, debitAmount: amount, description },
        { accountName: 'Cash', creditAmount: amount, description }
      )
      break
      
    case 'equity':
      if (category === 'Owner\'s Draws') {
        // Owner's draw: Debit Owner's Draws, Credit Cash
        // Both "Owner's Draws" and "Cash" must exist in Chart of Accounts
        entries.push(
          { accountName: category, debitAmount: amount, description },
          { accountName: 'Cash', creditAmount: amount, description }
        )
      } else {
        // Equity investment: Debit Cash, Credit the specific equity account (category)
        // Both "Cash" and the category (e.g., "Owner's Capital") must exist in Chart of Accounts
        entries.push(
          { accountName: 'Cash', debitAmount: amount, description },
          { accountName: category, creditAmount: amount, description }
        )
      }
      break
  }
  
  return entries
}

/**
 * Converts a simple transaction to double-entry format
 */
export function convertToDoubleEntry(
  companyId: string,
  userId: string,
  date: string,
  type: 'income' | 'expense' | 'asset' | 'liability' | 'equity',
  category: string,
  amount: number,
  description: string,
  source: 'manual' | 'import' | 'system' = 'manual'
): DoubleEntryTransaction {
  const entries = createDoubleEntryEntries(type, category, amount, description)
  
  return {
    companyId,
    userId,
    date,
    description,
    source,
    entries
  }
}

/**
 * Gets account balance using the database function
 */
export async function getAccountBalance(
  supabase: SupabaseClient,
  companyId: string,
  accountId: string,
  asOfDate?: string
): Promise<number> {
  const { data, error } = await supabase.rpc('get_account_balance', {
    p_company_id: companyId,
    p_account_id: accountId,
    p_as_of_date: asOfDate || new Date().toISOString().split('T')[0]
  })

  if (error) {
    console.error('Error getting account balance:', error)
    throw new Error(`Failed to get account balance: ${error.message}`)
  }

  return data || 0
} 