import { useState, useCallback, useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { useToast } from '@/hooks/use-toast'
import type { Check, CheckFormData, Payable } from '@/types/check'

interface UseChecksProps {
  supabase: SupabaseClient
  currentCompany: { id: string } | null
}

export function useChecks({ supabase, currentCompany }: UseChecksProps) {
  const [checks, setChecks] = useState<Check[]>([])
  const [payables, setPayables] = useState<Payable[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCheckNumber, setNextCheckNumber] = useState<number>(1001)
  const { toast } = useToast()

  // Fetch checks
  const fetchChecks = useCallback(async () => {
    try {
      if (!currentCompany) return

      const { data, error } = await supabase
        .from('checks')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('date', { ascending: false })

      if (error) throw error

      setChecks(data || [])
    } catch (error) {
      console.error('Error fetching checks:', error)
    } finally {
      setLoading(false)
    }
  }, [currentCompany, supabase])

  // Fetch open payables (for "Pay with Check" feature)
  const fetchPayables = useCallback(async () => {
    try {
      if (!currentCompany) return

      const { data, error } = await supabase
        .from('payables_receivables')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('type', 'payable')
        .eq('status', 'open')
        .order('due_date', { ascending: true })

      if (error) throw error

      setPayables(data || [])
    } catch (error) {
      console.error('Error fetching payables:', error)
    }
  }, [currentCompany, supabase])

  // Fetch next check number
  const fetchNextCheckNumber = useCallback(async () => {
    try {
      if (!currentCompany) return

      const { data, error } = await supabase
        .from('companies')
        .select('next_check_number')
        .eq('id', currentCompany.id)
        .single()

      if (error) throw error

      setNextCheckNumber(data?.next_check_number || 1001)
    } catch (error) {
      console.error('Error fetching next check number:', error)
    }
  }, [currentCompany, supabase])

  // Create a new check (with transaction)
  const createCheck = useCallback(
    async (formData: CheckFormData, payableId?: string) => {
      try {
        if (!currentCompany) return null

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return null

        // Use the RPC function to create check with transaction
        const { data, error } = await supabase.rpc(
          'create_check_with_transaction',
          {
            p_company_id: currentCompany.id,
            p_user_id: user.id,
            p_payee_name: formData.payee_name,
            p_payee_address: formData.payee_address || null,
            p_amount: parseFloat(formData.amount),
            p_memo: formData.memo || null,
            p_date: formData.date,
            p_category: formData.category || 'Accounts Payable',
            p_payable_id: payableId || null,
            p_check_number: formData.check_number
              ? parseInt(formData.check_number)
              : null,
          }
        )

        if (error) {
          console.error('Error creating check:', error)
          toast({
            title: 'Error',
            description: error.message || 'Failed to create check',
            variant: 'destructive',
          })
          return null
        }

        toast({
          title: 'Success',
          description: 'Check created successfully',
        })

        await fetchChecks()
        await fetchNextCheckNumber()
        await fetchPayables()

        return data as string // Returns the check ID
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create check'
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
        return null
      }
    },
    [
      currentCompany,
      supabase,
      toast,
      fetchChecks,
      fetchNextCheckNumber,
      fetchPayables,
    ]
  )

  // Void a check
  const voidCheck = useCallback(
    async (checkId: string, reason?: string) => {
      try {
        if (!currentCompany) return false

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return false

        const { data, error } = await supabase.rpc('void_check', {
          p_check_id: checkId,
          p_user_id: user.id,
          p_reason: reason || null,
        })

        if (error) {
          console.error('Error voiding check:', error)
          toast({
            title: 'Error',
            description: error.message || 'Failed to void check',
            variant: 'destructive',
          })
          return false
        }

        if (!data) {
          toast({
            title: 'Error',
            description: 'Check not found or cannot be voided',
            variant: 'destructive',
          })
          return false
        }

        toast({
          title: 'Success',
          description: 'Check voided successfully',
        })

        await fetchChecks()
        await fetchPayables()
        return true
      } catch (error) {
        console.error('Error voiding check:', error)
        toast({
          title: 'Error',
          description: 'Failed to void check',
          variant: 'destructive',
        })
        return false
      }
    },
    [currentCompany, supabase, toast, fetchChecks, fetchPayables]
  )

  // Mark check as printed
  const markCheckPrinted = useCallback(
    async (checkId: string) => {
      try {
        const { data, error } = await supabase.rpc('mark_check_printed', {
          p_check_id: checkId,
        })

        if (error) {
          console.error('Error marking check as printed:', error)
          toast({
            title: 'Error',
            description: 'Failed to mark check as printed',
            variant: 'destructive',
          })
          return false
        }

        if (!data) {
          toast({
            title: 'Info',
            description: 'Check was already printed or not found',
          })
          return false
        }

        await fetchChecks()
        return true
      } catch (error) {
        console.error('Error marking check as printed:', error)
        return false
      }
    },
    [supabase, toast, fetchChecks]
  )

  // Mark check as cleared
  const markCheckCleared = useCallback(
    async (checkId: string) => {
      try {
        const { data, error } = await supabase.rpc('mark_check_cleared', {
          p_check_id: checkId,
        })

        if (error) {
          console.error('Error marking check as cleared:', error)
          toast({
            title: 'Error',
            description: 'Failed to mark check as cleared',
            variant: 'destructive',
          })
          return false
        }

        if (!data) {
          toast({
            title: 'Info',
            description: 'Check cannot be cleared in its current state',
          })
          return false
        }

        toast({
          title: 'Success',
          description: 'Check marked as cleared',
        })

        await fetchChecks()
        return true
      } catch (error) {
        console.error('Error marking check as cleared:', error)
        return false
      }
    },
    [supabase, toast, fetchChecks]
  )

  // Get check by ID
  const getCheckById = useCallback(
    async (checkId: string): Promise<Check | null> => {
      try {
        const { data, error } = await supabase
          .from('checks')
          .select('*')
          .eq('id', checkId)
          .single()

        if (error) throw error

        return data
      } catch (error) {
        console.error('Error fetching check:', error)
        return null
      }
    },
    [supabase]
  )

  // Delete a pending check (only pending checks can be deleted)
  const deleteCheck = useCallback(
    async (checkId: string) => {
      try {
        if (!currentCompany) return false

        // First get the check to verify it's pending and get the journal_entry_id
        const check = await getCheckById(checkId)
        if (!check) {
          toast({
            title: 'Error',
            description: 'Check not found',
            variant: 'destructive',
          })
          return false
        }

        if (check.status !== 'pending') {
          toast({
            title: 'Error',
            description: 'Only pending checks can be deleted. Void printed checks instead.',
            variant: 'destructive',
          })
          return false
        }

        // Delete the check (this won't delete the journal entry)
        const { error: checkError } = await supabase
          .from('checks')
          .delete()
          .eq('id', checkId)
          .eq('company_id', currentCompany.id)

        if (checkError) throw checkError

        // Delete the associated journal entry if it exists
        if (check.journal_entry_id) {
          const { error: journalError } = await supabase
            .from('journal_entries')
            .delete()
            .eq('id', check.journal_entry_id)

          if (journalError) {
            console.warn('Could not delete associated journal entry:', journalError)
          }
        }

        // Reopen the payable if it was associated
        if (check.payable_id) {
          await supabase
            .from('payables_receivables')
            .update({ status: 'open' })
            .eq('id', check.payable_id)
        }

        toast({
          title: 'Success',
          description: 'Check deleted successfully',
        })

        await fetchChecks()
        await fetchPayables()
        return true
      } catch (error) {
        console.error('Error deleting check:', error)
        toast({
          title: 'Error',
          description: 'Failed to delete check',
          variant: 'destructive',
        })
        return false
      }
    },
    [currentCompany, supabase, toast, fetchChecks, fetchPayables, getCheckById]
  )

  // Initialize data
  useEffect(() => {
    if (currentCompany) {
      fetchChecks()
      fetchPayables()
      fetchNextCheckNumber()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id])

  return {
    // State
    checks,
    payables,
    loading,
    nextCheckNumber,

    // Functions
    fetchChecks,
    fetchPayables,
    createCheck,
    voidCheck,
    markCheckPrinted,
    markCheckCleared,
    getCheckById,
    deleteCheck,
  }
}
