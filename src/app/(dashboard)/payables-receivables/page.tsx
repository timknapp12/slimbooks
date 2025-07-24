'use client'

import { useEffect, useState, useCallback } from 'react'

export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Plus, CheckCircle } from 'lucide-react'
import { formatDate, isOverdue } from '@/lib/date-utils'
import { useCompany } from '@/contexts/CompanyContext'

interface PayableReceivable {
  id: string
  type: 'payable' | 'receivable'
  name: string
  amount: number
  due_date: string
  status: 'open' | 'paid'
  created_at: string
}

export default function PayablesReceivablesPage() {
  const [items, setItems] = useState<PayableReceivable[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()
  const { currentCompany } = useCompany()

  // Form state
  const [formData, setFormData] = useState({
    type: 'payable' as 'payable' | 'receivable',
    name: '',
    amount: '',
    due_date: ''
  })

  const fetchItems = useCallback(async () => {
    try {
      if (!currentCompany) return

      const { data, error } = await supabase
        .from('payables_receivables')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('due_date', { ascending: true })

      if (error) throw error

      setItems(data || [])
    } catch (error) {
      console.error('Error fetching payables/receivables:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch payables/receivables',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [currentCompany, supabase, toast])

  useEffect(() => {
    if (currentCompany) {
      fetchItems()
    }
  }, [fetchItems, currentCompany])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (!currentCompany) return

      const { error } = await supabase
        .from('payables_receivables')
        .insert({
          company_id: currentCompany.id,
          type: formData.type,
          name: formData.name,
          amount: parseFloat(formData.amount),
          due_date: formData.due_date,
          status: 'open'
        })

      if (error) throw error

      toast({
        title: 'Success',
        description: `${formData.type === 'payable' ? 'Payable' : 'Receivable'} added successfully`,
      })

      setIsAddDialogOpen(false)
      setFormData({
        type: 'payable',
        name: '',
        amount: '',
        due_date: ''
      })
      fetchItems()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add item'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const handleMarkPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payables_receivables')
        .update({ status: 'paid' })
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Marked as paid',
      })

      fetchItems()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update status'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }



  const payables = items.filter(item => item.type === 'payable')
  const receivables = items.filter(item => item.type === 'receivable')
  const openPayables = payables.filter(item => item.status === 'open')
  const openReceivables = receivables.filter(item => item.status === 'open')

  const totalOpenPayables = openPayables.reduce((sum, item) => sum + item.amount, 0)
  const totalOpenReceivables = openReceivables.reduce((sum, item) => sum + item.amount, 0)

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payables & Receivables</h1>
          <p className="text-muted-foreground">
            Track what you owe and what others owe you
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Payable/Receivable</DialogTitle>
              <DialogDescription>
                Track money you owe or money owed to you
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={formData.type} onValueChange={(value: 'payable' | 'receivable') => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payable">Payable (Money I owe)</SelectItem>
                    <SelectItem value="receivable">Receivable (Money owed to me)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name/Description</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Invoice #123, Vendor payment"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">
                Add {formData.type === 'payable' ? 'Payable' : 'Receivable'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Total Open Payables</CardTitle>
            <CardDescription>Money you owe</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {formatCurrency(totalOpenPayables)}
            </div>
            <p className="text-sm text-muted-foreground">
              {openPayables.length} open item{openPayables.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Total Open Receivables</CardTitle>
            <CardDescription>Money owed to you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(totalOpenReceivables)}
            </div>
            <p className="text-sm text-muted-foreground">
              {openReceivables.length} open item{openReceivables.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payables" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payables">
            Payables ({payables.length})
          </TabsTrigger>
          <TabsTrigger value="receivables">
            Receivables ({receivables.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payables">
          <Card>
            <CardHeader>
              <CardTitle>Accounts Payable</CardTitle>
              <CardDescription>
                Money you owe to vendors and suppliers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name/Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payables.map((item) => (
                    <TableRow key={item.id} className={isOverdue(item.due_date, item.status) ? 'bg-red-50' : ''}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="font-medium text-red-600">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell>
                        {item.due_date ? formatDate(item.due_date) : 'No due date'}
                        {isOverdue(item.due_date, item.status) && (
                          <span className="ml-2 text-xs text-red-600 font-medium">OVERDUE</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'open' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {item.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkPaid(item.id)}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {payables.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No payables found. Add your first payable to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receivables">
          <Card>
            <CardHeader>
              <CardTitle>Accounts Receivable</CardTitle>
              <CardDescription>
                Money owed to you by customers and clients
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name/Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivables.map((item) => (
                    <TableRow key={item.id} className={isOverdue(item.due_date, item.status) ? 'bg-red-50' : ''}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="font-medium text-green-600">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell>
                        {item.due_date ? formatDate(item.due_date) : 'No due date'}
                        {isOverdue(item.due_date, item.status) && (
                          <span className="ml-2 text-xs text-red-600 font-medium">OVERDUE</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'open' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {item.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkPaid(item.id)}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {receivables.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No receivables found. Add your first receivable to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}