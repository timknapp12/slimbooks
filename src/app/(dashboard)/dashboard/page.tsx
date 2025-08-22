'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Plus,
  FileText,
  Download,
  Trash2,
} from 'lucide-react'
import { formatDate } from '@/lib/date-utils'
import { useCompany } from '@/contexts/CompanyContext'
import { generateFinancialReportPDF, downloadPDF } from '@/lib/pdf-generator'
import { generateFinancialReportsDoubleEntry } from '@/lib/report-generator-double-entry'
import type { ReportData } from '@/lib/report-generator-double-entry'
import { TransactionForm } from '@/components/transaction-form'
import { TransactionTable } from '@/components/transaction-table'
import { useTransactions } from '@/hooks/use-transactions'
import {
  formatCurrency,
  getTransactionTypeColor,
  getAmountColor,
  getAmountSign,
} from '@/lib/transaction-utils'
import type { Transaction, TransactionFormData } from '@/types/transaction'

interface DashboardStats {
  totalIncome: number
  totalExpenses: number
  netIncome: number
  openPayables: number
  openReceivables: number
  recentTransactions: Transaction[]
  deletedTransactions: Transaction[]
}

interface DashboardReportData {
  type: 'pl' | 'bs' | 'cf'
  title: string
  period: string
  data: ReportData
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    openPayables: 0,
    openReceivables: 0,
    recentTransactions: [],
    deletedTransactions: [],
  })
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [currentReport, setCurrentReport] = useState<'pl' | 'bs' | 'cf' | null>(
    null
  )
  const [reportDateRange, setReportDateRange] = useState({
    fromDate: new Date().getFullYear() + '-01-01',
    toDate: new Date().getFullYear() + '-12-31',
  })
  const [reportData, setReportData] = useState<DashboardReportData | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [pdfGenerating, setPdfGenerating] = useState(false)
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

  // Calculate dashboard stats from transactions
  const calculateStats = useCallback(() => {
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()

    const monthlyTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date)
      return (
        transactionDate.getMonth() === currentMonth &&
        transactionDate.getFullYear() === currentYear
      )
    })

    const totalIncome = monthlyTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    const totalExpenses = monthlyTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    const netIncome = totalIncome - totalExpenses

    // For now, set payables and receivables to 0
    // TODO: Implement proper payables/receivables tracking
    const openPayables = 0
    const openReceivables = 0

    // Get recent transactions (last 10)
    const recentTransactions = transactions.slice(0, 10)

    setStats({
      totalIncome,
      totalExpenses,
      netIncome,
      openPayables,
      openReceivables,
      recentTransactions,
      deletedTransactions,
    })
  }, [transactions, deletedTransactions])

  // Recalculate stats when transactions change
  useEffect(() => {
    calculateStats()
  }, [transactions, calculateStats])

  const handleAddTransaction = async (
    formData: TransactionFormData
  ): Promise<boolean> => {
    const success = await addTransaction(formData)
    if (success) {
      calculateStats()
    }
    return success || false
  }

  const handleDeleteTransaction = async (
    transactionId: string
  ): Promise<boolean> => {
    const success = await deleteTransaction(transactionId)
    if (success) {
      calculateStats()
    }
    return success || false
  }

  const handleSaveTransaction = async (): Promise<boolean> => {
    const success = await saveTransaction()
    if (success) {
      calculateStats()
    }
    return success || false
  }

  const openReportModal = (reportType: 'pl' | 'bs' | 'cf') => {
    setCurrentReport(reportType)
    setReportModalOpen(true)
  }
  const fetchReportData = useCallback(
    async (reportType: 'pl' | 'bs' | 'cf') => {
      if (!currentCompany) return

      try {
        setReportLoading(true)
        const reportData = await generateFinancialReportsDoubleEntry({
          supabase,
          companyId: currentCompany.id,
          fromDate: reportDateRange.fromDate,
          toDate: reportDateRange.toDate,
        })

        const reportTitles = {
          pl: 'Profit & Loss Statement',
          bs: 'Balance Sheet',
          cf: 'Cash Flow Statement',
        }

        const reportPeriods = {
          pl: `${reportDateRange.fromDate} to ${reportDateRange.toDate}`,
          bs: `As of ${reportDateRange.toDate}`,
          cf: `${reportDateRange.fromDate} to ${reportDateRange.toDate}`,
        }

        setReportData({
          type: reportType,
          title: reportTitles[reportType],
          period: reportPeriods[reportType],
          data: reportData,
        })
      } catch (error) {
        console.error('Error generating report:', error)
        toast({
          title: 'Error',
          description: 'Failed to generate report',
          variant: 'destructive',
        })
      } finally {
        setReportLoading(false)
      }
    },
    [currentCompany, supabase, reportDateRange, toast]
  )

  // Auto-update report when date range changes
  useEffect(() => {
    if (reportModalOpen && currentReport) {
      fetchReportData(currentReport)
    }
  }, [reportModalOpen, currentReport, fetchReportData])

  const downloadReportPDF = async () => {
    if (!reportData || !currentCompany) return

    try {
      setPdfGenerating(true)

      // Use the existing report data structure
      const pdfReportData: ReportData = reportData.data

      // Determine report type for PDF generation
      const reportType =
        reportData.type === 'pl'
          ? 'profit-loss'
          : reportData.type === 'bs'
          ? 'balance-sheet'
          : reportData.type === 'cf'
          ? 'cash-flow'
          : 'all'

      // Generate PDF
      const pdfBytes = await generateFinancialReportPDF({
        companyName: currentCompany.name,
        dateFrom: reportDateRange.fromDate,
        dateTo: reportDateRange.toDate,
        accountingMethod: 'cash',
        reportData: pdfReportData,
        reportType,
      })

      // Create filename
      const filename = `${reportData.title
        .toLowerCase()
        .replace(/\s+/g, '-')}-${reportDateRange.fromDate}-to-${
        reportDateRange.toDate
      }.pdf`

      // Download PDF
      await downloadPDF(pdfBytes, filename)

      toast({
        title: 'Success',
        description: 'PDF downloaded successfully',
      })
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate PDF',
        variant: 'destructive',
      })
    } finally {
      setPdfGenerating(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your business finances
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Payables</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(stats.openPayables)}
            </div>
            <p className="text-xs text-muted-foreground">Amount due</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Open Receivables
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.openReceivables)}
            </div>
            <p className="text-xs text-muted-foreground">Amount owed to you</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                stats.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(stats.netIncome)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
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
          onClick={() => openReportModal('pl')}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Profit & Loss
        </Button>
        <Button
          variant="outline"
          onClick={() => openReportModal('bs')}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Balance Sheet
        </Button>
        <Button
          variant="outline"
          onClick={() => openReportModal('cf')}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Cash Flow
        </Button>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            Your most recent financial transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentTransactions.length > 0 ? (
            <TransactionTable
              transactions={stats.recentTransactions}
              chartOfAccounts={chartOfAccounts}
              editingTransactionId={editingTransactionId}
              editingTransaction={editingTransaction}
              onStartEditing={startEditing}
              onCancelEditing={cancelEditing}
              onSaveTransaction={handleSaveTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onUpdateEditingTransaction={updates =>
                setEditingTransaction(prev => ({ ...prev, ...updates }))
              }
              showActions={true}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No transactions yet</p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="mt-2">
                Add Your First Transaction
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deleted Transactions Section */}
      {stats.deletedTransactions.length > 0 && (
        <Card className="opacity-75 bg-gray-50 border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-gray-600">
                <Trash2 className="h-5 w-5 text-gray-500" />
                Deleted Transactions
                <span className="text-sm text-gray-500 font-normal">
                  ({stats.deletedTransactions.length})
                </span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllDeletedTransactions}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                title="Clear all deleted transactions permanently"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
            <CardDescription className="text-gray-600">
              Recently deleted transactions that can be restored
              {stats.deletedTransactions.length === 2 && (
                <span className="block mt-1 text-blue-600 font-medium">
                  ℹ️ You have 2 deleted transactions. You can delete 1 more
                  before the oldest one is permanently removed.
                </span>
              )}
              {stats.deletedTransactions.length >= 3 && (
                <span className="block mt-1 text-amber-600 font-medium">
                  ⚠️ You have reached the limit of 3 deleted transactions. The
                  oldest one will be permanently deleted when you delete another
                  transaction.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100">
                  <TableHead className="text-gray-600">Date</TableHead>
                  <TableHead className="text-gray-600">Description</TableHead>
                  <TableHead className="text-gray-600">Category</TableHead>
                  <TableHead className="text-gray-600">Type</TableHead>
                  <TableHead className="text-right text-gray-600">
                    Amount
                  </TableHead>
                  <TableHead className="text-gray-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.deletedTransactions.map(transaction => {
                  return (
                    <TableRow
                      key={transaction.id}
                      className="opacity-75 bg-gray-50 hover:bg-gray-100"
                    >
                      <TableCell className="align-middle text-gray-600">
                        {formatDate(transaction.date)}
                      </TableCell>
                      <TableCell className="align-middle text-gray-600">
                        {transaction.description}
                      </TableCell>
                      <TableCell className="align-middle text-gray-600">
                        {transaction.category}
                      </TableCell>
                      <TableCell className="align-middle">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium opacity-75 ${getTransactionTypeColor(
                            transaction.type
                          )}`}
                        >
                          {transaction.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <span
                          className={`font-medium opacity-75 ${getAmountColor(
                            transaction.type
                          )}`}
                        >
                          {getAmountSign(transaction.type)}
                          {formatCurrency(transaction.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreTransaction(transaction.id)}
                            className="h-8 px-3 hover:bg-green-50 hover:border-green-300 text-green-600 border-green-200"
                          >
                            <span className="text-green-600">Restore</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              permanentlyDeleteTransaction(transaction.id)
                            }
                            className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-300 text-red-600 border-red-200"
                            title="Delete permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
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

      {/* Report Modal */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{reportData?.title || 'Report'}</DialogTitle>
                <DialogDescription>
                  {reportData?.period || 'Financial Report'}
                </DialogDescription>
              </div>
              {reportData && (
                <Button
                  onClick={downloadReportPDF}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={pdfGenerating}
                >
                  <Download className="h-4 w-4" />
                  {pdfGenerating ? 'Generating...' : 'Download PDF'}
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Date Range Controls */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label
                htmlFor="fromDate"
                className="block text-sm font-medium mb-1"
              >
                From Date
              </label>
              <input
                id="fromDate"
                type="date"
                value={reportDateRange.fromDate}
                onChange={e => {
                  setReportDateRange({
                    ...reportDateRange,
                    fromDate: e.target.value,
                  })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label
                htmlFor="toDate"
                className="block text-sm font-medium mb-1"
              >
                To Date
              </label>
              <input
                id="toDate"
                type="date"
                value={reportDateRange.toDate}
                onChange={e => {
                  setReportDateRange({
                    ...reportDateRange,
                    toDate: e.target.value,
                  })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* Report Content */}
          {reportLoading ? (
            <div className="text-center py-8">
              <p>Generating report...</p>
            </div>
          ) : reportData ? (
            <div className="space-y-6">
              {reportData.type === 'pl' && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Revenue</h3>
                  {reportData.data.profitLoss.revenue.map(item => (
                    <div
                      key={item.accountName}
                      className="flex justify-between py-1"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 font-mono">
                          {item.accountNumber}
                        </span>
                        <span>{item.accountName}</span>
                      </span>
                      <span className="text-green-600 font-medium">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Revenue</span>
                      <span className="text-green-600">
                        {formatCurrency(
                          reportData.data.profitLoss.totalRevenue
                        )}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 mt-6">
                    Cost of Goods Sold
                  </h3>
                  {reportData.data.profitLoss.costOfGoodsSold.map(item => (
                    <div
                      key={item.accountName}
                      className="flex justify-between py-1"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 font-mono">
                          {item.accountNumber}
                        </span>
                        <span>{item.accountName}</span>
                      </span>
                      <span className="text-red-600 font-medium">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total COGS</span>
                      <span className="text-red-600">
                        {formatCurrency(
                          reportData.data.profitLoss.totalCostOfGoodsSold
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Gross Profit</span>
                      <span className="text-green-600">
                        {formatCurrency(reportData.data.profitLoss.grossProfit)}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 mt-6">
                    Operating Expenses
                  </h3>
                  {reportData.data.profitLoss.operatingExpenses.map(item => (
                    <div
                      key={item.accountName}
                      className="flex justify-between py-1"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 font-mono">
                          {item.accountNumber}
                        </span>
                        <span>{item.accountName}</span>
                      </span>
                      <span className="text-red-600 font-medium">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Operating Expenses</span>
                      <span className="text-red-600">
                        {formatCurrency(
                          reportData.data.profitLoss.totalOperatingExpenses
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Operating Income</span>
                      <span className="text-green-600">
                        {formatCurrency(
                          reportData.data.profitLoss.operatingIncome
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Net Income</span>
                      <span className="text-green-600">
                        {formatCurrency(reportData.data.profitLoss.netIncome)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {reportData.type === 'bs' && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Assets</h3>
                  {reportData.data.balanceSheet.assets.map(item => (
                    <div
                      key={item.accountName}
                      className="flex justify-between py-1"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 font-mono">
                          {item.accountNumber}
                        </span>
                        <span>{item.accountName}</span>
                      </span>
                      <span className="font-medium">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Assets</span>
                      <span>
                        {formatCurrency(
                          reportData.data.balanceSheet.totalAssets
                        )}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 mt-6">
                    Liabilities
                  </h3>
                  {reportData.data.balanceSheet.liabilities.map(item => (
                    <div
                      key={item.accountName}
                      className="flex justify-between py-1"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 font-mono">
                          {item.accountNumber}
                        </span>
                        <span>{item.accountName}</span>
                      </span>
                      <span className="font-medium">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Liabilities</span>
                      <span>
                        {formatCurrency(
                          reportData.data.balanceSheet.totalLiabilities
                        )}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 mt-6">Equity</h3>
                  {reportData.data.balanceSheet.equity.map(item => (
                    <div
                      key={item.accountName}
                      className="flex justify-between py-1"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 font-mono">
                          {item.accountNumber}
                        </span>
                        <span>{item.accountName}</span>
                      </span>
                      <span className="font-medium">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Equity</span>
                      <span>
                        {formatCurrency(
                          reportData.data.balanceSheet.totalEquity
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {reportData.type === 'cf' && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Operating Activities
                  </h3>
                  {reportData.data.cashFlow.operatingActivities.map(item => (
                    <div
                      key={item.accountName}
                      className="flex justify-between py-1"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 font-mono">
                          {item.accountNumber}
                        </span>
                        <span>{item.accountName}</span>
                      </span>
                      <span
                        className={
                          item.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Operating Activities</span>
                      <span
                        className={
                          reportData.data.cashFlow.totalOperatingActivities >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }
                      >
                        {formatCurrency(
                          reportData.data.cashFlow.totalOperatingActivities
                        )}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 mt-6">
                    Investing Activities
                  </h3>
                  {reportData.data.cashFlow.investingActivities.map(item => (
                    <div
                      key={item.accountName}
                      className="flex justify-between py-1"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 font-mono">
                          {item.accountNumber}
                        </span>
                        <span>{item.accountName}</span>
                      </span>
                      <span
                        className={
                          item.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Investing Activities</span>
                      <span
                        className={
                          reportData.data.cashFlow.totalInvestingActivities >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }
                      >
                        {formatCurrency(
                          reportData.data.cashFlow.totalInvestingActivities
                        )}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 mt-6">
                    Financing Activities
                  </h3>
                  {reportData.data.cashFlow.financingActivities.map(item => (
                    <div
                      key={item.accountName}
                      className="flex justify-between py-1"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 font-mono">
                          {item.accountNumber}
                        </span>
                        <span>{item.accountName}</span>
                      </span>
                      <span
                        className={
                          item.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Financing Activities</span>
                      <span
                        className={
                          reportData.data.cashFlow.totalFinancingActivities >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }
                      >
                        {formatCurrency(
                          reportData.data.cashFlow.totalFinancingActivities
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="border-t-2 pt-4 mt-6">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Net Cash Flow</span>
                      <span
                        className={
                          reportData.data.cashFlow.netCashFlow >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }
                      >
                        {formatCurrency(reportData.data.cashFlow.netCashFlow)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p>No data available for the selected period</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}