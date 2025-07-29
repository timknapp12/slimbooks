'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { RecurringExpense, RecurringExpenseFormData, Vendor, ChartOfAccount } from '@/types/transaction'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { Plus, Edit, Trash2, DollarSign, Calendar, User, Play, Pause } from 'lucide-react'
import { format } from 'date-fns'

export function RecurringExpenses() {
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null)
  const [formData, setFormData] = useState<RecurringExpenseFormData>({
    name: '',
    amount: 0,
    category: '',
    description: '',
    frequency: 'monthly',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: 'cash',
    notes: ''
  })

  const { toast } = useToast()
  const { currentCompany } = useCompany()
  const supabase = createClient()

  useEffect(() => {
    if (currentCompany) {
      fetchRecurringExpenses()
      fetchVendors()
      fetchAccounts()
    }
  }, [currentCompany])

  const fetchRecurringExpenses = async () => {
    if (!currentCompany) return

    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select(`
          *,
          vendor:vendors(*)
        `)
        .eq('company_id', currentCompany.id)
        .order('name')

      if (error) throw error
      setRecurringExpenses(data || [])
    } catch (error) {
      console.error('Error fetching recurring expenses:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch recurring expenses',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchVendors = async () => {
    if (!currentCompany) return

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setVendors(data || [])
    } catch (error) {
      console.error('Error fetching vendors:', error)
    }
  }

  const fetchAccounts = async () => {
    if (!currentCompany) return

    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('account_type', 'expense')
        .eq('is_active', true)
        .order('account_name')

      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }

  const calculateNextOccurrence = (startDate: string, frequency: string): string => {
    const start = new Date(startDate)
    const now = new Date()
    
    if (start > now) {
      return startDate
    }

    const next = new Date(start)
    
    while (next <= now) {
      switch (frequency) {
        case 'weekly':
          next.setDate(next.getDate() + 7)
          break
        case 'monthly':
          next.setMonth(next.getMonth() + 1)
          break
        case 'quarterly':
          next.setMonth(next.getMonth() + 3)
          break
        case 'yearly':
          next.setFullYear(next.getFullYear() + 1)
          break
      }
    }
    
    return format(next, 'yyyy-MM-dd')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentCompany) return

    try {
      const nextOccurrence = calculateNextOccurrence(formData.start_date, formData.frequency)
      
      const recurringExpenseData = {
        ...formData,
        company_id: currentCompany.id,
        next_occurrence_date: nextOccurrence
      }

      if (editingExpense) {
        const { error } = await supabase
          .from('recurring_expenses')
          .update(recurringExpenseData)
          .eq('id', editingExpense.id)

        if (error) throw error
        toast({
          title: 'Success',
          description: 'Recurring expense updated successfully'
        })
      } else {
        const { error } = await supabase
          .from('recurring_expenses')
          .insert([recurringExpenseData])

        if (error) throw error
        toast({
          title: 'Success',
          description: 'Recurring expense created successfully'
        })
      }

      setDialogOpen(false)
      setEditingExpense(null)
      resetForm()
      fetchRecurringExpenses()
    } catch (error) {
      console.error('Error saving recurring expense:', error)
      toast({
        title: 'Error',
        description: 'Failed to save recurring expense',
        variant: 'destructive'
      })
    }
  }

  const handleEdit = (expense: RecurringExpense) => {
    setEditingExpense(expense)
    setFormData({
      vendor_id: expense.vendor_id || '',
      name: expense.name,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      frequency: expense.frequency,
      start_date: expense.start_date,
      end_date: expense.end_date || '',
      payment_method: expense.payment_method,
      notes: expense.notes || ''
    })
    setDialogOpen(true)
  }

  const handleDelete = async (expense: RecurringExpense) => {
    if (!confirm('Are you sure you want to delete this recurring expense?')) return

    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .delete()
        .eq('id', expense.id)

      if (error) throw error
      toast({
        title: 'Success',
        description: 'Recurring expense deleted successfully'
      })
      fetchRecurringExpenses()
    } catch (error) {
      console.error('Error deleting recurring expense:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete recurring expense',
        variant: 'destructive'
      })
    }
  }

  const handleToggleActive = async (expense: RecurringExpense) => {
    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .update({ is_active: !expense.is_active })
        .eq('id', expense.id)

      if (error) throw error
      toast({
        title: 'Success',
        description: `Recurring expense ${expense.is_active ? 'paused' : 'activated'}`
      })
      fetchRecurringExpenses()
    } catch (error) {
      console.error('Error toggling recurring expense:', error)
      toast({
        title: 'Error',
        description: 'Failed to update recurring expense',
        variant: 'destructive'
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      amount: 0,
      category: '',
      description: '',
      frequency: 'monthly',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      payment_method: 'cash',
      notes: ''
    })
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingExpense(null)
    resetForm()
  }

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'weekly': return 'Weekly'
      case 'monthly': return 'Monthly'
      case 'quarterly': return 'Quarterly'
      case 'yearly': return 'Yearly'
      default: return frequency
    }
  }



  if (loading) {
    return <div className="flex justify-center p-8">Loading recurring expenses...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Recurring Expenses</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Recurring Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? 'Edit Recurring Expense' : 'Add New Recurring Expense'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Office Rent, Internet Service"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vendor_id">Vendor (Optional)</Label>
                  <Select 
                    value={formData.vendor_id || ''} 
                    onValueChange={(value) => setFormData({ ...formData, vendor_id: value || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No vendor</SelectItem>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.account_name} value={account.account_name}>
                          {account.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="frequency">Frequency *</Label>
                <Select 
                  value={formData.frequency} 
                  onValueChange={(value: 'weekly' | 'monthly' | 'quarterly' | 'yearly') => setFormData({ ...formData, frequency: value })}
                >                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date (Optional)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="payment_method">Payment Method *</Label>
                <Select 
                  value={formData.payment_method} 
                  onValueChange={(value: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'other') => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  className="w-full p-2 border rounded-md"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingExpense ? 'Update' : 'Create'} Recurring Expense
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recurring Expenses ({recurringExpenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {recurringExpenses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recurring expenses found. Add your first recurring expense to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurringExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.name}</TableCell>
                      <TableCell>
                        {expense.vendor ? (
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-2 text-gray-400" />
                            {expense.vendor.name}
                          </div>
                        ) : (
                          <span className="text-gray-400">No vendor</span>
                        )}
                      </TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-1 text-gray-400" />
                          {expense.amount.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>{getFrequencyLabel(expense.frequency)}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          {format(new Date(expense.next_occurrence_date), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          expense.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {expense.is_active ? 'Active' : 'Paused'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(expense)}
                            title={expense.is_active ? 'Pause' : 'Activate'}
                          >
                            {expense.is_active ? (
                              <Pause className="w-3 h-3" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(expense)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(expense)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}