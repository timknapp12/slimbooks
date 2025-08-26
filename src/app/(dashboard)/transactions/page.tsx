'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Plus, Upload, Filter, Building2, Calendar, Trash2 } from 'lucide-react'
import { CSVUpload } from '@/components/csv-upload'
import { BankConnect } from '@/components/bank-connect'
import {
  formatDate,
  getFirstDayOfMonth,
  getLastDayOfMonth,
  getFirstDayOfYear,
  getLastDayOfYear,
  getCurrentYear,
} from '@/lib/date-utils'
import { useCompany } from '@/contexts/CompanyContext'
import { TransactionForm } from '@/components/transaction-form'
import { TransactionTable } from '@/components/transaction-table'
import { useTransactions } from '@/hooks/use-transactions'
import { getCategoriesByType, getAllCategories } from '@/lib/transaction-utils'
import type { TransactionFormData } from '@/types/transaction'

export default function TransactionsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isCSVUploadOpen, setIsCSVUploadOpen] = useState(false)
  const [isBankConnectOpen, setIsBankConnectOpen] = useState(false)
  const [isFilterVisible, setIsFilterVisible] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth())
  const [dateTo, setDateTo] = useState(getLastDayOfMonth())
  const [isYTDView, setIsYTDView] = useState(false)
  const supabase = createClient()
  const { currentCompany } = useCompany()
  const { toast } = useToast()

  // Use the shared transactions hook
  const {
    transactions,
    deletedTransactions,
    chartOfAccounts,
    loading,
    editingTransactionId,
    editingTransaction,
    addTransaction,
    deleteTransaction,
    restoreTransaction,
    permanentlyDeleteTransaction,
    clearAllDeletedTransactions,
    startEditing,
    cancelEditing,
    saveTransaction,
    setEditingTransaction,
  } = useTransactions({ supabase, currentCompany })

  // Filter transactions based on current filters
  const filteredTransactions = transactions.filter(transaction => {
    // Type filter
    if (filterType !== 'all' && transaction.type !== filterType) {
      return false
    }

    // Category filter
    if (filterCategory !== 'all' && transaction.category !== filterCategory) {
      return false
    }

    // Date filter
    const transactionDate = new Date(transaction.date)
    const fromDate = new Date(dateFrom)
    const toDate = new Date(dateTo)

    if (transactionDate < fromDate || transactionDate > toDate) {
      return false
    }

    return true
  })

  const handleAddTransaction = async (
    formData: TransactionFormData
  ): Promise<boolean> => {
    return (await addTransaction(formData)) || false
  }

  const handleDeleteTransaction = async (
    transactionId: string
  ): Promise<boolean> => {
    return (await deleteTransaction(transactionId)) || false
  }

  const handleRestoreTransaction = async (
    transactionId: string
  ): Promise<boolean> => {
    return (await restoreTransaction(transactionId)) || false
  }

  const handleSaveTransaction = async (): Promise<boolean> => {
    return (await saveTransaction()) || false
  }

  const toggleYTDView = () => {
    if (isYTDView) {
      setDateFrom(getFirstDayOfMonth())
      setDateTo(getLastDayOfMonth())
    } else {
      setDateFrom(getFirstDayOfYear(getCurrentYear()))
      setDateTo(getLastDayOfYear(getCurrentYear()))
    }
    setIsYTDView(!isYTDView)
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Transactions Register
        </h1>
        <p className="text-muted-foreground">
          Manage and track all your financial transactions
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Transaction
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsCSVUploadOpen(true)}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsBankConnectOpen(true)}
          className="flex items-center gap-2"
        >
          <Building2 className="h-4 w-4" />
          Connect Bank
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsFilterVisible(!isFilterVisible)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Filters */}
      {isFilterVisible && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="type-filter">Type</Label>
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
              <div>
                <Label htmlFor="category-filter">Category</Label>
                <Select
                  value={filterCategory}
                  onValueChange={setFilterCategory}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {filterType === 'all'
                      ? getAllCategories(chartOfAccounts).map(
                          (category: string) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          )
                        )
                      : getCategoriesByType(filterType, chartOfAccounts).map(
                          (category: string) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          )
                        )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date-from">From Date</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="date-to">To Date</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={toggleYTDView}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                {isYTDView ? 'Current Month' : 'Year to Date'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFilterType('all')
                  setFilterCategory('all')
                  setDateFrom(getFirstDayOfMonth())
                  setDateTo(getLastDayOfMonth())
                  setIsYTDView(false)
                }}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            {filteredTransactions.length} transaction
            {filteredTransactions.length !== 1 ? 's' : ''} found
            {filterType !== 'all' && ` for ${filterType}`}
            {filterCategory !== 'all' && ` in ${filterCategory}`}
            {` from ${formatDate(dateFrom)} to ${formatDate(dateTo)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length > 0 ? (
            <TransactionTable
              transactions={filteredTransactions}
              chartOfAccounts={chartOfAccounts}
              editingTransactionId={editingTransactionId}
              editingTransaction={editingTransaction}
              onStartEditing={startEditing}
              onCancelEditing={cancelEditing}
              onSaveTransaction={handleSaveTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onUpdateEditingTransaction={setEditingTransaction}
              showActions={true}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {transactions.length === 0
                  ? 'No transactions yet'
                  : 'No transactions match your current filters'}
              </p>
              {transactions.length === 0 && (
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="mt-2"
                >
                  Add Your First Transaction
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deleted Transactions Section */}
      {deletedTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Deleted Transactions
                <span className="text-sm font-normal text-muted-foreground">
                  ({deletedTransactions.length})
                </span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllDeletedTransactions}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10 border-red-500/20"
                title="Clear all deleted transactions permanently"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
            <CardDescription>
              Recently deleted transactions that can be restored
              {deletedTransactions.length === 2 && (
                <span className="block mt-1 text-blue-600 dark:text-blue-400 font-medium">
                  ℹ️ You have 2 deleted transactions. You can delete 1 more
                  before the oldest one is permanently removed.
                </span>
              )}
              {deletedTransactions.length >= 3 && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ You have reached the limit of 3 deleted transactions. The
                  oldest one will be permanently deleted when you delete another
                  transaction.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionTable
              transactions={deletedTransactions}
              chartOfAccounts={chartOfAccounts}
              editingTransactionId={null}
              editingTransaction={{}}
              onStartEditing={() => {}} // No editing for deleted transactions
              onCancelEditing={() => {}}
              onSaveTransaction={() => Promise.resolve(false)}
              onDeleteTransaction={handleRestoreTransaction} // Use restore instead of delete
              onPermanentlyDeleteTransaction={permanentlyDeleteTransaction}
              onUpdateEditingTransaction={() => {}}
              showActions={true}
              className=""
              isDeletedSection={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Add Transaction Dialog */}
      <TransactionForm
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleAddTransaction}
        chartOfAccounts={chartOfAccounts}
      />

      {/* CSV Upload Dialog */}
      <CSVUpload
        isOpen={isCSVUploadOpen}
        onClose={() => setIsCSVUploadOpen(false)}
        onSuccess={() => {
          toast({
            title: 'Success',
            description: 'CSV file uploaded and processed successfully',
          })
        }}
      />

      {/* Bank Connect Dialog */}
      <BankConnect
        isOpen={isBankConnectOpen}
        onClose={() => setIsBankConnectOpen(false)}
        onSuccess={() => {
          toast({
            title: 'Success',
            description: 'Bank account connected successfully',
          })
        }}
      />
    </div>
  )
}
