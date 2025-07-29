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
import { Payment, PaymentFormData, Customer, Invoice } from '@/types/transaction'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { Plus, Edit, Trash2, DollarSign, Calendar, User, FileText } from 'lucide-react'
import { format } from 'date-fns'

export function PaymentTracking() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [formData, setFormData] = useState<PaymentFormData>({
    customer_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: 0,
    payment_method: 'cash',
    reference_number: '',
    notes: ''
  })

  const { toast } = useToast()
  const { currentCompany } = useCompany()
  const supabase = createClient()

  useEffect(() => {
    if (currentCompany) {
      fetchPayments()
      fetchCustomers()
      fetchInvoices()
    }
  }, [currentCompany])

  const fetchPayments = async () => {
    if (!currentCompany) return

    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          customer:customers(*),
          invoice:invoices(*)
        `)
        .eq('company_id', currentCompany.id)
        .order('date', { ascending: false })

      if (error) throw error
      setPayments(data || [])
    } catch (error) {
      console.error('Error fetching payments:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch payments',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    if (!currentCompany) return

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchInvoices = async () => {
    if (!currentCompany) return

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', currentCompany.id)
        .in('status', ['sent', 'viewed', 'partial', 'overdue'])
        .order('date', { ascending: false })

      if (error) throw error
      setInvoices(data || [])
    } catch (error) {
      console.error('Error fetching invoices:', error)
    }
  }

  const getCustomerInvoices = (customerId: string) => {
    return invoices.filter(invoice => invoice.customer_id === customerId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentCompany) return

    try {
      if (editingPayment) {
        const { error } = await supabase
          .from('payments')
          .update({
            ...formData,
            payment_number: `PAY-${Date.now()}` // Temporary - should use proper numbering
          })
          .eq('id', editingPayment.id)

        if (error) throw error
        toast({
          title: 'Success',
          description: 'Payment updated successfully'
        })
      } else {
        const { error } = await supabase
          .from('payments')
          .insert([{
            ...formData,
            company_id: currentCompany.id,
            payment_number: `PAY-${Date.now()}` // Temporary - should use proper numbering
          }])

        if (error) throw error
        toast({
          title: 'Success',
          description: 'Payment recorded successfully'
        })
      }

      setDialogOpen(false)
      setEditingPayment(null)
      resetForm()
      fetchPayments()
    } catch (error) {
      console.error('Error saving payment:', error)
      toast({
        title: 'Error',
        description: 'Failed to save payment',
        variant: 'destructive'
      })
    }
  }

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment)
    setFormData({
      invoice_id: payment.invoice_id || '',
      customer_id: payment.customer_id,
      date: payment.date,
      amount: payment.amount,
      payment_method: payment.payment_method,
      reference_number: payment.reference_number || '',
      notes: payment.notes || ''
    })
    setDialogOpen(true)
  }

  const handleDelete = async (payment: Payment) => {
    if (!confirm('Are you sure you want to delete this payment?')) return

    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', payment.id)

      if (error) throw error
      toast({
        title: 'Success',
        description: 'Payment deleted successfully'
      })
      fetchPayments()
    } catch (error) {
      console.error('Error deleting payment:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete payment',
        variant: 'destructive'
      })
    }
  }

  const resetForm = () => {
    setFormData({
      customer_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      payment_method: 'cash',
      reference_number: '',
      notes: ''
    })
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingPayment(null)
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
    return <div className="flex justify-center p-8">Loading payments...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Payment Tracking</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPayment ? 'Edit Payment' : 'Record New Payment'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer_id">Customer *</Label>
                  <Select 
                    value={formData.customer_id} 
                    onValueChange={(value) => setFormData({ ...formData, customer_id: value, invoice_id: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="invoice_id">Invoice (Optional)</Label>
                  <Select 
                    value={formData.invoice_id || ''} 
                    onValueChange={(value) => setFormData({ ...formData, invoice_id: value || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No specific invoice</SelectItem>
                      {getCustomerInvoices(formData.customer_id).map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - ${invoice.total_amount.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Payment Date *</Label>
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
                  {editingPayment ? 'Update' : 'Record'} Payment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payments ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No payments found. Record your first payment to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.payment_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2 text-gray-400" />
                          {payment.customer?.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {payment.invoice ? (
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-gray-400" />
                            {payment.invoice.invoice_number}
                          </div>
                        ) : (
                          <span className="text-gray-400">General payment</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          {format(new Date(payment.date), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-1 text-gray-400" />
                          {payment.amount.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>{getPaymentMethodLabel(payment.payment_method)}</TableCell>
                      <TableCell>{payment.reference_number || '-'}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(payment)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(payment)}
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