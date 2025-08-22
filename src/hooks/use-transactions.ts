import { useState, useCallback, useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { useToast } from '@/hooks/use-toast'
import { createSimpleDoubleEntryTransaction } from '@/lib/double-entry'
import type { Transaction, ChartOfAccount, TransactionFormData } from '@/types/transaction'

interface UseTransactionsProps {
  supabase: SupabaseClient
  currentCompany: { id: string } | null
}

export function useTransactions({ supabase, currentCompany }: UseTransactionsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [deletedTransactions, setDeletedTransactions] = useState<Transaction[]>([])
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Partial<Transaction>>({})
  const { toast } = useToast()

  // Dynamic category functions based on Chart of Accounts
  const getCategoriesByType = useCallback((type: string) => {
    const typeMapping: { [key: string]: string } = {
      'income': 'revenue',
      'expense': 'expense',
      'asset': 'asset',
      'liability': 'liability',
      'equity': 'equity'
    }
    
    const accountType = typeMapping[type] || type
    return chartOfAccounts
      .filter(account => account.account_type === accountType)
      .map(account => account.account_name)
  }, [chartOfAccounts])

  const getAllCategories = useCallback(() => {
    return chartOfAccounts.map(account => account.account_name)
  }, [chartOfAccounts])

  // Fetch Chart of Accounts
  const fetchChartOfAccounts = useCallback(async () => {
    try {
      if (!currentCompany) return

      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('account_name, account_type, account_number')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('account_number')

      if (error) {
        console.error('Error fetching Chart of Accounts:', error)
        return
      }

      setChartOfAccounts(data || [])
    } catch (error) {
      console.error('Error fetching Chart of Accounts:', error)
    }
  }, [currentCompany, supabase])

  // Helper function to convert journal entries to transactions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convertJournalEntriesToTransactions = useCallback((journalEntries: any[]): Transaction[] => {
    const convertedTransactions: Transaction[] = []
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    journalEntries?.forEach((journalEntry: any) => {
      // Find the main transaction entry (non-cash entry)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mainEntry = journalEntry.transaction_entries.find((entry: any) => 
        entry.chart_of_accounts.account_name !== 'Cash'
      )
      
      if (mainEntry) {
        const amount = mainEntry.debit_amount || mainEntry.credit_amount || 0
        const accountType = mainEntry.chart_of_accounts.account_type
        
        // Determine transaction type based on account type
        let type: 'income' | 'expense' | 'asset' | 'liability' | 'equity'
        switch (accountType) {
          case 'revenue':
            type = 'income'
            break
          case 'expense':
            type = 'expense'
            break
          case 'asset':
            type = 'asset'
            break
          case 'liability':
            type = 'liability'
            break
          case 'equity':
            type = 'equity'
            break
          default:
            type = 'expense'
        }

        const transaction: Transaction = {
          id: journalEntry.id,
          date: journalEntry.date,
          description: journalEntry.description,
          category: mainEntry.chart_of_accounts.account_name,
          type,
          amount,
          source: journalEntry.source as 'manual' | 'import',
          reference_number: journalEntry.reference_number,
          created_at: journalEntry.created_at
        }

        convertedTransactions.push(transaction)
      }
    })

    return convertedTransactions
  }, [])

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    try {
      if (!currentCompany) return

      // Get active journal entries
      const { data: activeJournalEntries, error: activeError } = await supabase
        .from('journal_entries')
        .select(`
          id,
          date,
          description,
          source,
          reference_number,
          created_at,
          transaction_entries (
            debit_amount,
            credit_amount,
            chart_of_accounts (
              account_name,
              account_type
            )
          )
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_reversed', false)
        .is('deleted_at', null)
        .order('date', { ascending: false })

      if (activeError) throw activeError

      // Get soft-deleted journal entries
      const { data: deletedJournalEntries, error: deletedError } = await supabase
        .from('journal_entries')
        .select(`
          id,
          date,
          description,
          source,
          reference_number,
          created_at,
          transaction_entries (
            debit_amount,
            credit_amount,
            chart_of_accounts (
              account_name,
              account_type
            )
          )
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_reversed', false)
        .not('deleted_at', 'is', null)
        .order('date', { ascending: false })

      if (deletedError) throw deletedError

      // Convert both active and deleted journal entries
      const activeTransactions = convertJournalEntriesToTransactions(activeJournalEntries || [])
      const deletedTransactionsList = convertJournalEntriesToTransactions(deletedJournalEntries || [])

      setTransactions(activeTransactions)
      setDeletedTransactions(deletedTransactionsList)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }, [currentCompany, supabase, convertJournalEntriesToTransactions])

  // Add transaction
  const addTransaction = useCallback(async (formData: TransactionFormData) => {
    try {
      if (!currentCompany) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Create the double-entry transaction using the new function
      await createSimpleDoubleEntryTransaction(
        supabase,
        currentCompany.id,
        user.id,
        formData.date,
        formData.type,
        formData.category,
        parseFloat(formData.amount),
        formData.description,
        'manual'
      )

      toast({
        title: 'Success',
        description: 'Transaction added successfully',
      })

      await fetchTransactions()
      return true
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add transaction'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    }
  }, [currentCompany, supabase, toast, fetchTransactions])

  // Delete transaction
  const deleteTransaction = useCallback(async (transactionId: string) => {
    try {
      if (!currentCompany) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check current count of deleted transactions before deleting
      const currentDeletedCount = deletedTransactions.length
      console.log(`Current deleted transactions count: ${currentDeletedCount}`)

      // Soft delete the journal entry using the database function
      const { data: deleteResult, error } = await supabase
        .rpc('soft_delete_journal_entry', {
          journal_entry_uuid: transactionId,
          user_uuid: user.id
        })

      if (error) {
        console.error('Error soft deleting journal entry:', error)
        toast({
          title: 'Error',
          description: 'Failed to delete transaction',
          variant: 'destructive',
        })
        return false
      }

      if (!deleteResult) {
        toast({
          title: 'Error',
          description: 'Transaction not found',
          variant: 'destructive',
        })
        return false
      }

      // Check if automatic cleanup happened
      if (currentDeletedCount >= 3) {
        toast({
          title: 'Transaction Deleted',
          description: 'Transaction moved to trash. The oldest deleted transaction was automatically removed to maintain the 3-transaction limit.',
        })
      } else {
        toast({
          title: 'Success',
          description: 'Transaction moved to trash (can be restored)',
        })
      }

      await fetchTransactions()
      return true
    } catch (error) {
      console.error('Error deleting transaction:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete transaction',
        variant: 'destructive',
      })
      return false
    }
  }, [currentCompany, supabase, toast, fetchTransactions, deletedTransactions.length])

  // Restore transaction
  const restoreTransaction = useCallback(async (transactionId: string) => {
    try {
      if (!currentCompany) return

      // Restore the journal entry using the database function
      const { data: restoreResult, error } = await supabase
        .rpc('restore_journal_entry', {
          journal_entry_uuid: transactionId
        })

      if (error) {
        console.error('Error restoring journal entry:', error)
        toast({
          title: 'Error',
          description: 'Failed to restore transaction',
          variant: 'destructive',
        })
        return false
      }

      if (!restoreResult) {
        toast({
          title: 'Error',
          description: 'Transaction not found or already restored',
          variant: 'destructive',
        })
        return false
      }

      toast({
        title: 'Success',
        description: 'Transaction restored successfully',
      })

      await fetchTransactions()
      return true
    } catch (error) {
      console.error('Error restoring transaction:', error)
      toast({
        title: 'Error',
        description: 'Failed to restore transaction',
        variant: 'destructive',
      })
      return false
    }
  }, [currentCompany, supabase, toast, fetchTransactions])

  // Edit transaction functions
  const startEditing = useCallback((transaction: Transaction) => {
    setEditingTransactionId(transaction.id)
    setEditingTransaction({
      date: transaction.date,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      description: transaction.description
    })
  }, [])

  const cancelEditing = useCallback(() => {
    setEditingTransactionId(null)
    setEditingTransaction({})
  }, [])

  const saveTransaction = useCallback(async () => {
    if (!editingTransactionId || !currentCompany) return false

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      // Delete the old journal entry (this will cascade delete both debit and credit transaction entries)
      const { error: deleteError } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', editingTransactionId)
        .eq('company_id', currentCompany.id)

      if (deleteError) {
        console.error('Error deleting old journal entry:', deleteError)
        toast({
          title: 'Error',
          description: 'Failed to update transaction',
          variant: 'destructive',
        })
        return false
      }

      // Validate required fields
      if (!editingTransaction.date) {
        toast({
          title: 'Error',
          description: 'Date is required',
          variant: 'destructive',
        })
        return false
      }

      if (!editingTransaction.category) {
        toast({
          title: 'Error',
          description: 'Category is required',
          variant: 'destructive',
        })
        return false
      }

      if (!editingTransaction.amount || editingTransaction.amount <= 0) {
        toast({
          title: 'Error',
          description: 'Amount must be greater than 0',
          variant: 'destructive',
        })
        return false
      }

      // Create the new double-entry transaction
      await createSimpleDoubleEntryTransaction(
        supabase,
        currentCompany.id,
        user.id,
        editingTransaction.date,
        editingTransaction.type || 'expense',
        editingTransaction.category,
        parseFloat(editingTransaction.amount?.toString() || '0'),
        editingTransaction.description || '',
        'manual'
      )

      toast({
        title: 'Success',
        description: 'Transaction updated successfully with all related entries',
      })

      cancelEditing()
      await fetchTransactions()
      return true
    } catch (error) {
      console.error('Error updating transaction:', error)
      toast({
        title: 'Error',
        description: 'Failed to update transaction',
        variant: 'destructive',
      })
      return false
    }
  }, [editingTransactionId, editingTransaction, currentCompany, supabase, toast, cancelEditing, fetchTransactions])

  // Initialize data
  useEffect(() => {
    if (currentCompany) {
      fetchChartOfAccounts()
      fetchTransactions()
    }
  }, [currentCompany?.id]) // Only depend on company ID, not the functions

  return {
    // State
    transactions,
    deletedTransactions,
    chartOfAccounts,
    loading,
    editingTransactionId,
    editingTransaction,
    
    // Functions
    getCategoriesByType,
    getAllCategories,
    fetchTransactions,
    addTransaction,
    deleteTransaction,
    restoreTransaction,
    startEditing,
    cancelEditing,
    saveTransaction,
    setEditingTransaction
  }
} 