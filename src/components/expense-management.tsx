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
import { Expense, ExpenseFormData, Vendor, ChartOfAccount } from '@/types/transaction'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { Plus, Edit, Trash2, DollarSign, Calendar, User, Paperclip, Upload } from 'lucide-react'
import { format } from 'date-fns'

export function ExpenseManagement() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState<ExpenseFormData>({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: 0,
    category: '',
    description: '',
    payment_method: 'cash',
    reference_number: '',
    is_recurring: false,
    notes: ''
  })

  const { toast } = useToast()
  const { currentCompany } = useCompany()
  const supabase = createClient()

  useEffect(() => {
    if (currentCompany) {
      fetchExpenses()
      fetchVendors()
      fetchAccounts()
    }
  }, [currentCompany])

  const fetchExpenses = async () => {
    if (!currentCompany) return

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          vendor:vendors(*)
        `)
        .eq('company_id', currentCompany.id)
        .order('date', { ascending: false })

      if (error) throw error
      setExpenses(data || [])
    } catch (error) {
      console.error('Error fetching expenses:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch expenses',
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

  const uploadReceipt = async (file: File): Promise<string | null> => {
    if (!currentCompany) return null

    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${currentCompany.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName)

      return data.publicUrl
    } catch (error) {
      console.error('Error uploading receipt:', error)
      toast({
        title: 'Error',
        description: 'Failed to upload receipt',
        variant: 'destructive'
      })
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentCompany) return

    try {
      let receiptUrl = null
      if (formData.receipt_file) {
        receiptUrl = await uploadReceipt(formData.receipt_file)
        if (!receiptUrl) return // Upload failed
      }

      const expenseData = {
        ...formData,
        company_id: currentCompany.id,
        expense_number: `EXP-${Date.now()}`, // Temporary - should use proper numbering
        receipt_url: receiptUrl,
        receipt_file: undefined // Remove file from data
      }

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id)

        if (error) throw error
        toast({
          title: 'Success',
          description: 'Expense updated successfully'
        })
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([expenseData])

        if (error) throw error
        toast({
          title: 'Success',
          description: 'Expense recorded successfully'
        })
      }

      setDialogOpen(false)
      setEditingExpense(null)
      resetForm()
      fetchExpenses()
    } catch (error) {
      console.error('Error saving expense:', error)
      toast({
        title: 'Error',
        description: 'Failed to save expense',
        variant: 'destructive'
      })
    }
  }

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      vendor_id: expense.vendor_id || '',
      date: expense.date,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      payment_method: expense.payment_method,
      reference_number: expense.reference_number || '',
      is_recurring: expense.is_recurring,
      recurring_frequency: expense.recurring_frequency,
      recurring_end_date: expense.recurring_end_date || '',
      notes: expense.notes || ''
    })
    setDialogOpen(true)
  }

  const handleDelete = async (expense: Expense) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id)

      if (error) throw error
      toast({
        title: 'Success',
        description: 'Expense deleted successfully'
      })
      fetchExpenses()
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete expense',
        variant: 'destructive'
      })
    }
  }

  const resetForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      category: '',
      description: '',
      payment_method: 'cash',
      reference_number: '',
      is_recurring: false,
      notes: ''
    })
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingExpense(null)
    resetForm()
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Cash'
      case 'check': return 'Check'
      case 'credit_card': return 'Credit Card'
      case 'bank_transfer': return 'Bank Transfer'
      case 'other': return 'Other'
      default: return method
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading expenses...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Expense Management</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? 'Edit Expense' : 'Add New Expense'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
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
                  <Label htmlFor="reference_number">Reference Number</Label>
                  <Input
                    id="reference_number"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    placeholder="Check #, Transaction ID, etc."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="receipt">Receipt Upload</Label>
                <Input
                  id="receipt"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setFormData({ ...formData, receipt_file: file })
                    }
                  }}
                />
                {formData.receipt_file && (
                  <p className="text-sm text-gray-600 mt-1">
                    Selected: {formData.receipt_file.name}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                />
                <Label htmlFor="is_recurring">This is a recurring expense</Label>
              </div>

              {formData.is_recurring && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="recurring_frequency">Frequency</Label>
                    <Select 
                      value={formData.recurring_frequency || ''} 
                      onValueChange={(value: 'weekly' | 'monthly' | 'quarterly' | 'yearly') => setFormData({ ...formData, recurring_frequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="recurring_end_date">End Date (Optional)</Label>
                    <Input
                      id="recurring_end_date"
                      type="date"
                      value={formData.recurring_end_date}
                      onChange={(e) => setFormData({ ...formData, recurring_end_date: e.target.value })}
                    />
                  </div>
                </div>
              )}

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
                <Button type="submit" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Upload className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      {editingExpense ? 'Update' : 'Add'} Expense
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expenses ({expenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No expenses found. Add your first expense to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          {format(new Date(expense.date), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
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
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-1 text-gray-400" />
                          {expense.amount.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>{getPaymentMethodLabel(expense.payment_method)}</TableCell>
                      <TableCell>
                        {expense.receipt_url ? (
                          <a 
                            href={expense.receipt_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-600 hover:text-blue-800"
                          >
                            <Paperclip className="w-3 h-3 mr-1" />
                            View
                          </a>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
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