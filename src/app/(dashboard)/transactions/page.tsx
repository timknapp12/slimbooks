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
import { useToast } from '@/hooks/use-toast'
import { Plus, Upload, Filter, Building2, Calendar, Edit2, Check, X } from 'lucide-react'
import { CSVUpload } from '@/components/csv-upload'
import { BankConnect } from '@/components/bank-connect'
import { expenseCategories, incomeCategories, assetCategories, liabilityCategories, equityCategories, allCategories, autoCategorizeTranaction } from '@/lib/categorization'
import { formatDate, formatDateForDB, getFirstDayOfMonth, getLastDayOfMonth, getFirstDayOfYear, getLastDayOfYear, getCurrentYear } from '@/lib/date-utils'
import { useCompany } from '@/contexts/CompanyContext'

interface Transaction {
  id: string
  date: string
  amount: number
  type: 'income' | 'expense' | 'asset' | 'liability' | 'equity'
  category: string
  description: string
  source: 'manual' | 'import'
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isCSVUploadOpen, setIsCSVUploadOpen] = useState(false)
  const [isBankConnectOpen, setIsBankConnectOpen] = useState(false)
  const [isFilterVisible, setIsFilterVisible] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth())
  const [dateTo, setDateTo] = useState(getLastDayOfMonth())
  const [isYTDView, setIsYTDView] = useState(false)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Partial<Transaction>>({})
  const { toast } = useToast()
  const supabase = createClient()
  const { currentCompany } = useCompany()

  // Form state for new transaction
  const [formData, setFormData] = useState({
    date: formatDateForDB(new Date()),
    amount: '',
    type: 'expense' as 'income' | 'expense' | 'asset' | 'liability' | 'equity',
    category: '',
    description: ''
  })

  // Reset category when type changes in form
  useEffect(() => {
    setFormData(prev => ({ ...prev, category: '' }))
  }, [formData.type])

  // Reset category when type changes in editing
  useEffect(() => {
    if (editingTransaction.type && editingTransaction.category) {
      const currentType = editingTransaction.type
      const currentCategory = editingTransaction.category
      const validCategories = currentType === 'income' ? incomeCategories : 
                             currentType === 'expense' ? expenseCategories :
                             currentType === 'asset' ? assetCategories :
                             currentType === 'liability' ? liabilityCategories :
                             equityCategories
      
      if (!validCategories.includes(currentCategory)) {
        setEditingTransaction(prev => ({ ...prev, category: '' }))
      }
    }
  }, [editingTransaction.type])

  // Reset filter category when filter type changes
  useEffect(() => {
    if (filterType !== 'all' && filterCategory !== 'all') {
      const validCategories = filterType === 'income' ? incomeCategories : 
                             filterType === 'expense' ? expenseCategories :
                             filterType === 'asset' ? assetCategories :
                             filterType === 'liability' ? liabilityCategories :
                             equityCategories
      if (!validCategories.includes(filterCategory)) {
        setFilterCategory('all')
      }
    }
  }, [filterType, filterCategory])

  const fetchTransactions = useCallback(async () => {
    try {
      if (!currentCompany) return

      let query = supabase
        .from('transactions')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('date', { ascending: false })

      if (filterType !== 'all') {
        query = query.eq('type', filterType)
      }

      if (filterCategory !== 'all') {
        query = query.eq('category', filterCategory)
      }

      if (dateFrom) {
        query = query.gte('date', dateFrom)
      }

      if (dateTo) {
        query = query.lte('date', dateTo)
      }

      const { data, error } = await query

      if (error) throw error

      setTransactions(data || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch transactions',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filterType, filterCategory, dateFrom, dateTo, currentCompany, supabase, toast])

  useEffect(() => {
    if (currentCompany) {
      fetchTransactions()
    }
  }, [fetchTransactions, currentCompany])

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (!currentCompany) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('transactions')
        .insert({
          company_id: currentCompany.id,
          user_id: user.id,
          date: formData.date,
          amount: parseFloat(formData.amount),
          type: formData.type,
          category: formData.category,
          description: formData.description,
          source: 'manual'
        })

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Transaction added successfully',
      })

      setIsAddDialogOpen(false)
      setFormData({
        date: formatDateForDB(new Date()),
        amount: '',
        type: 'expense',
        category: '',
        description: ''
      })
      fetchTransactions()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add transaction'
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



  const startEditing = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id)
    setEditingTransaction({
      date: transaction.date,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      description: transaction.description
    })
  }

  const cancelEditing = () => {
    setEditingTransactionId(null)
    setEditingTransaction({})
  }

  const saveTransaction = async () => {
    if (!editingTransactionId) return

    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          date: editingTransaction.date,
          amount: editingTransaction.amount,
          type: editingTransaction.type,
          category: editingTransaction.category,
          description: editingTransaction.description
        })
        .eq('id', editingTransactionId)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Transaction updated successfully',
      })

      setEditingTransactionId(null)
      setEditingTransaction({})
      fetchTransactions()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update transaction'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            Manage your income, expenses, and transfers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBankConnectOpen(true)}>
            <Building2 className="mr-2 h-4 w-4" />
            Connect Bank
          </Button>
          <Button variant="outline" onClick={() => setIsFilterVisible(!isFilterVisible)}>
            <Filter className="mr-2 h-4 w-4" />
            Filter Transactions
          </Button>
          <Button variant="outline" onClick={() => setIsCSVUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Transaction</DialogTitle>
                <DialogDescription>
                  Enter the details for your new transaction
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="$0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(value: 'income' | 'expense' | 'asset' | 'liability' | 'equity') => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="liability">Liability</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(formData.type === 'income' ? incomeCategories : 
                        formData.type === 'expense' ? expenseCategories :
                        formData.type === 'asset' ? assetCategories :
                        formData.type === 'liability' ? liabilityCategories :
                        equityCategories).map((category: string) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Notes"
                    value={formData.description}
                    onChange={(e) => {
                      const description = e.target.value
                      const suggestedCategory = autoCategorizeTranaction(description, formData.type)
                      setFormData({ 
                        ...formData, 
                        description,
                        category: formData.category || suggestedCategory
                      })
                    }}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Add Transaction
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isFilterVisible && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="liability">Liability</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {(filterType === 'income' ? incomeCategories : 
                      filterType === 'expense' ? expenseCategories : 
                      filterType === 'asset' ? assetCategories :
                      filterType === 'liability' ? liabilityCategories :
                      filterType === 'equity' ? equityCategories :
                      allCategories).map((category: string) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span>{transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found</span>
                {(dateFrom || dateTo) && (
                  <span className="text-muted-foreground">
                    {dateFrom && dateTo ? (
                      <span>• {formatDate(dateFrom)} - {formatDate(dateTo)}</span>
                    ) : dateFrom ? (
                      <span>• From {formatDate(dateFrom)}</span>
                    ) : dateTo ? (
                      <span>• To {formatDate(dateTo)}</span>
                    ) : null}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (isYTDView) {
                    setDateFrom(getFirstDayOfMonth())
                    setDateTo(getLastDayOfMonth())
                    setIsYTDView(false)
                  }
                }}
                disabled={!isYTDView}
                className={!isYTDView ? "opacity-50 cursor-not-allowed" : ""}
              >
                <Calendar className="mr-2 h-4 w-4" />
                This Month
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (!isYTDView) {
                    setDateFrom(getFirstDayOfYear(getCurrentYear()))
                    setDateTo(getLastDayOfYear(getCurrentYear()))
                    setIsYTDView(true)
                  }
                }}
                disabled={isYTDView}
                className={isYTDView ? "opacity-50 cursor-not-allowed" : ""}
              >
                <Calendar className="mr-2 h-4 w-4" />
                This Year
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => {
                const isEditing = editingTransactionId === transaction.id
                return (
                  <TableRow key={transaction.id} className={isEditing ? "bg-blue-50 border-blue-200" : ""}>
                    <TableCell className="align-middle">
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editingTransaction.date || ''}
                          onChange={(e) => setEditingTransaction({...editingTransaction, date: e.target.value})}
                          className="w-36 h-8 text-sm"
                        />
                      ) : (
                        formatDate(transaction.date)
                      )}
                    </TableCell>
                    <TableCell className="align-middle">
                      {isEditing ? (
                        <Input
                          value={editingTransaction.description || ''}
                          onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})}
                          className="h-8 text-sm"
                        />
                      ) : (
                        transaction.description
                      )}
                    </TableCell>
                    <TableCell className="align-middle">
                      {isEditing ? (
                        <Select 
                          value={editingTransaction.category || ''} 
                          onValueChange={(value) => setEditingTransaction({...editingTransaction, category: value})}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(editingTransaction.type === 'income' ? incomeCategories : 
                              editingTransaction.type === 'expense' ? expenseCategories :
                              editingTransaction.type === 'asset' ? assetCategories :
                              editingTransaction.type === 'liability' ? liabilityCategories :
                              equityCategories).map((category: string) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        transaction.category
                      )}
                    </TableCell>
                    <TableCell className="align-middle">
                      {isEditing ? (
                        <Select 
                          value={editingTransaction.type || ''} 
                          onValueChange={(value: 'income' | 'expense' | 'asset' | 'liability' | 'equity') => setEditingTransaction({...editingTransaction, type: value})}
                        >
                          <SelectTrigger className="w-[100px] h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">Income</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="asset">Asset</SelectItem>
                            <SelectItem value="liability">Liability</SelectItem>
                            <SelectItem value="equity">Equity</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          transaction.type === 'income' 
                            ? 'bg-green-100 text-green-800'
                            : transaction.type === 'expense'
                            ? 'bg-red-100 text-red-800'
                            : transaction.type === 'asset'
                            ? 'bg-purple-100 text-purple-800'
                            : transaction.type === 'liability'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {transaction.type}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-middle">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editingTransaction.amount || ''}
                          onChange={(e) => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value) || 0})}
                          className="w-24 h-8 text-sm"
                        />
                      ) : (
                        <span className={`font-medium ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-middle">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        transaction.source === 'manual' 
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {transaction.source}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={saveTransaction}
                            className="h-8 w-8 p-0 hover:bg-green-50 hover:border-green-300"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                            className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-300"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(transaction)}
                          className="h-8 w-8 p-0 hover:bg-blue-50 hover:border-blue-300"
                        >
                          <Edit2 className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {transactions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found. Add your first transaction to get started.
            </div>
          )}
        </CardContent>
      </Card>

      <CSVUpload
        isOpen={isCSVUploadOpen}
        onClose={() => setIsCSVUploadOpen(false)}
        onSuccess={fetchTransactions}
      />

      <BankConnect
        isOpen={isBankConnectOpen}
        onClose={() => setIsBankConnectOpen(false)}
        onSuccess={fetchTransactions}
      />
    </div>
  )
}