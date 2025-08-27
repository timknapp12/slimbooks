import { useState, useCallback, useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { useToast } from '@/hooks/use-toast'
import { createSimpleDoubleEntryTransaction } from '@/lib/double-entry'
import type {
  Transaction,
  ChartOfAccount,
  TransactionFormData,
} from '@/types/transaction'

interface JournalEntryChartOfAccount {
  account_name: string
  account_type: string
}

interface JournalEntryTransactionEntry {
  debit_amount: number | null
  credit_amount: number | null
  chart_of_accounts: JournalEntryChartOfAccount | JournalEntryChartOfAccount[] // Support both object and array
}

interface JournalEntryData {
  id: string
  date: string
  description: string
  source: string
  reference_number: string | null
  created_at: string
  transaction_entries: JournalEntryTransactionEntry[]
}

interface UseTransactionsProps {
  supabase: SupabaseClient
  currentCompany: { id: string } | null
}

export function useTransactions({
  supabase,
  currentCompany,
}: UseTransactionsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [deletedTransactions, setDeletedTransactions] = useState<Transaction[]>(
    []
  )
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null)
  const [editingTransaction, setEditingTransaction] = useState<
    Partial<Transaction>
  >({})
  const { toast } = useToast()

  // Dynamic category functions based on Chart of Accounts
  const getCategoriesByType = useCallback(
    (type: string) => {
      const typeMapping: { [key: string]: string } = {
        income: 'revenue',
        expense: 'expense',
        asset: 'asset',
        liability: 'liability',
        equity: 'equity',
      }

      const accountType = typeMapping[type] || type
      return chartOfAccounts
        .filter(account => account.account_type === accountType)
        .map(account => account.account_name)
    },
    [chartOfAccounts]
  )

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
  const convertJournalEntriesToTransactions = useCallback(
    (journalEntries: JournalEntryData[]): Transaction[] => {
      const convertedTransactions: Transaction[] = []

      journalEntries?.forEach((journalEntry: JournalEntryData) => {
        // Find the main transaction entry (non-cash entry)
        const mainEntry = journalEntry.transaction_entries.find(
          (entry: JournalEntryTransactionEntry) => {
            const accountName = Array.isArray(entry.chart_of_accounts)
              ? entry.chart_of_accounts[0]?.account_name
              : entry.chart_of_accounts?.account_name
            return accountName !== 'Cash'
          }
        )

        if (mainEntry) {
          const amount = mainEntry.debit_amount || mainEntry.credit_amount || 0
          const accountType = Array.isArray(mainEntry.chart_of_accounts)
            ? mainEntry.chart_of_accounts[0]?.account_type
            : mainEntry.chart_of_accounts?.account_type

          // Determine transaction type based on account type and transaction pattern
          let type: 'income' | 'expense' | 'asset' | 'liability' | 'equity'

          // Special case: Cash deposit (Debit Cash, Credit Owner's Capital) should be treated as asset
          const cashEntry = journalEntry.transaction_entries.find(entry => {
            const accountName = Array.isArray(entry.chart_of_accounts)
              ? entry.chart_of_accounts[0]?.account_name
              : entry.chart_of_accounts?.account_name
            return accountName === 'Cash'
          })

          const categoryName = Array.isArray(mainEntry.chart_of_accounts)
            ? mainEntry.chart_of_accounts[0]?.account_name
            : mainEntry.chart_of_accounts?.account_name

          if (
            cashEntry &&
            cashEntry.debit_amount &&
            categoryName === "Owner's Capital"
          ) {
            // This is a cash deposit - treat as asset transaction
            type = 'asset'
          } else {
            // Use the standard logic based on account type
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
          }

          // Determine the category based on transaction type
          let finalCategory: string
          if (
            cashEntry &&
            cashEntry.debit_amount &&
            categoryName === "Owner's Capital"
          ) {
            // For cash deposits, show "Cash" as the category
            finalCategory = 'Cash'
          } else {
            finalCategory = categoryName || ''
          }

          const transaction: Transaction = {
            id: journalEntry.id,
            date: journalEntry.date,
            description: journalEntry.description,
            category: finalCategory,
            type,
            amount,
            source: journalEntry.source as 'manual' | 'import',
            reference_number: journalEntry.reference_number || undefined,
            created_at: journalEntry.created_at,
          }

          convertedTransactions.push(transaction)
        }
      })

      return convertedTransactions
    },
    []
  )

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    try {
      if (!currentCompany) return

      // Get active journal entries using raw SQL to ensure proper joins
      const { data: activeJournalEntries, error: activeError } = await supabase
        .from('journal_entries')
        .select(
          `
          id,
          date,
          description,
          source,
          reference_number,
          created_at,
          transaction_entries!inner (
            debit_amount,
            credit_amount,
            chart_of_accounts!inner (
              account_name,
              account_type
            )
          )
        `
        )
        .eq('company_id', currentCompany.id)
        .eq('is_reversed', false)
        .is('deleted_at', null)
        .order('date', { ascending: false })

      if (activeError) throw activeError

      // Get soft-deleted journal entries
      const { data: deletedJournalEntries, error: deletedError } =
        await supabase
          .from('journal_entries')
          .select(
            `
            id,
            date,
            description,
            source,
            reference_number,
            created_at,
            transaction_entries!inner (
              debit_amount,
              credit_amount,
              chart_of_accounts!inner (
                account_name,
                account_type
              )
            )
          `
          )
          .eq('company_id', currentCompany.id)
          .eq('is_reversed', false)
          .not('deleted_at', 'is', null)
          .order('date', { ascending: false })

      if (deletedError) throw deletedError

      // Convert both active and deleted journal entries
      const activeTransactions = convertJournalEntriesToTransactions(
        activeJournalEntries || []
      )
      const deletedTransactionsList = convertJournalEntriesToTransactions(
        deletedJournalEntries || []
      )

      setTransactions(activeTransactions)
      setDeletedTransactions(deletedTransactionsList)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }, [currentCompany, supabase, convertJournalEntriesToTransactions])

  // Add transaction
  const addTransaction = useCallback(
    async (formData: TransactionFormData) => {
      try {
        if (!currentCompany) return

        const {
          data: { user },
        } = await supabase.auth.getUser()
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
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to add transaction'
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
        return false
      }
    },
    [currentCompany, supabase, toast, fetchTransactions]
  )

  // Delete transaction
  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      try {
        if (!currentCompany) return

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        // Check current count of deleted transactions before deleting
        const currentDeletedCount = deletedTransactions.length
        console.log(
          `Current deleted transactions count: ${currentDeletedCount}`
        )

        // Soft delete the journal entry using the database function
        const { data: deleteResult, error } = await supabase.rpc(
          'soft_delete_journal_entry',
          {
            journal_entry_uuid: transactionId,
            user_uuid: user.id,
          }
        )

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
            description:
              'Transaction moved to trash. The oldest deleted transaction was automatically removed to maintain the 3-transaction limit.',
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
    },
    [
      currentCompany,
      supabase,
      toast,
      fetchTransactions,
      deletedTransactions.length,
    ]
  )

  // Restore transaction
  const restoreTransaction = useCallback(
    async (transactionId: string) => {
      try {
        if (!currentCompany) return

        // Restore the journal entry using the database function
        const { data: restoreResult, error } = await supabase.rpc(
          'restore_journal_entry',
          {
            journal_entry_uuid: transactionId,
          }
        )

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
    },
    [currentCompany, supabase, toast, fetchTransactions]
  )

  // Permanently delete transaction
  const permanentlyDeleteTransaction = useCallback(
    async (transactionId: string): Promise<boolean> => {
      try {
        if (!currentCompany) return false

        // Permanently delete the journal entry
        const { error } = await supabase
          .from('journal_entries')
          .delete()
          .eq('id', transactionId)
          .eq('company_id', currentCompany.id)

        if (error) {
          console.error('Error permanently deleting journal entry:', error)
          toast({
            title: 'Error',
            description: 'Failed to permanently delete transaction',
            variant: 'destructive',
          })
          return false
        }

        toast({
          title: 'Success',
          description: 'Transaction permanently deleted',
        })

        await fetchTransactions()
        return true
      } catch (error) {
        console.error('Error permanently deleting transaction:', error)
        toast({
          title: 'Error',
          description: 'Failed to permanently delete transaction',
          variant: 'destructive',
        })
        return false
      }
    },
    [currentCompany, supabase, toast, fetchTransactions]
  )

  // Clear all deleted transactions
  const clearAllDeletedTransactions =
    useCallback(async (): Promise<boolean> => {
      try {
        if (!currentCompany) return false

        // Get all deleted transaction IDs
        const deletedIds = deletedTransactions.map(t => t.id)

        if (deletedIds.length === 0) {
          toast({
            title: 'Info',
            description: 'No deleted transactions to clear',
          })
          return true
        }

        // Permanently delete all deleted transactions
        const { error } = await supabase
          .from('journal_entries')
          .delete()
          .eq('company_id', currentCompany.id)
          .in('id', deletedIds)

        if (error) {
          console.error('Error clearing deleted transactions:', error)
          toast({
            title: 'Error',
            description: 'Failed to clear deleted transactions',
            variant: 'destructive',
          })
          return false
        }

        toast({
          title: 'Success',
          description: `Cleared ${deletedIds.length} deleted transaction${
            deletedIds.length === 1 ? '' : 's'
          }`,
        })

        await fetchTransactions()
        return true
      } catch (error) {
        console.error('Error clearing deleted transactions:', error)
        toast({
          title: 'Error',
          description: 'Failed to clear deleted transactions',
          variant: 'destructive',
        })
        return false
      }
    }, [
      currentCompany,
      supabase,
      toast,
      fetchTransactions,
      deletedTransactions,
    ])

  // Edit transaction functions
  const startEditing = useCallback((transaction: Transaction) => {
    setEditingTransactionId(transaction.id)
    setEditingTransaction({
      date: transaction.date,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      description: transaction.description,
    })
  }, [])

  const cancelEditing = useCallback(() => {
    setEditingTransactionId(null)
    setEditingTransaction({})
  }, [])

  const saveTransaction = useCallback(async () => {
    if (!editingTransactionId || !currentCompany) return false

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
        description:
          'Transaction updated successfully with all related entries',
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
  }, [
    editingTransactionId,
    editingTransaction,
    currentCompany,
    supabase,
    toast,
    cancelEditing,
    fetchTransactions,
  ])

  // Initialize data
  useEffect(() => {
    if (currentCompany) {
      fetchChartOfAccounts()
      fetchTransactions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    permanentlyDeleteTransaction,
    clearAllDeletedTransactions,
    startEditing,
    cancelEditing,
    saveTransaction,
    setEditingTransaction,
  }
}
