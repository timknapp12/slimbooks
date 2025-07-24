'use client'

import { useEffect, useState, useCallback } from 'react'

export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DollarSign, TrendingUp, TrendingDown, Users, Edit2, Check, X, Plus, FileText, Download } from 'lucide-react'
import { formatDate, getFirstDayOfMonth, getLastDayOfMonth, formatDateForDB, getFirstDayOfYear, getLastDayOfYear } from '@/lib/date-utils'
import { useCompany } from '@/contexts/CompanyContext'
import { expenseCategories, incomeCategories, assetCategories, liabilityCategories, equityCategories } from '@/lib/categorization'
import { useToast } from '@/hooks/use-toast'
import { generateFinancialReportPDF, downloadPDF, type ReportData } from '@/lib/pdf-generator'

interface Transaction {
  id: string
  description: string
  date: string
  category: string
  type: 'income' | 'expense' | 'asset' | 'liability' | 'equity'
  amount: number
  created_at: string
}

interface DashboardStats {
  totalIncome: number
  totalExpenses: number
  netIncome: number
  openPayables: number
  openReceivables: number
  recentTransactions: Transaction[]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    openPayables: 0,
    openReceivables: 0,
    recentTransactions: []
  })
  const [loading, setLoading] = useState(true)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Partial<Transaction>>({})
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    date: formatDateForDB(new Date()),
    amount: '',
    type: 'expense' as 'income' | 'expense' | 'asset' | 'liability' | 'equity',
    category: '',
    description: ''
  })
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [currentReport, setCurrentReport] = useState<'pl' | 'bs' | 'cf' | null>(null)
  const [reportDateRange, setReportDateRange] = useState({
    fromDate: getFirstDayOfYear(new Date().getFullYear()),
    toDate: getLastDayOfYear(new Date().getFullYear())
  })
  const [reportData, setReportData] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const supabase = createClient()
  const { currentCompany } = useCompany()
  const { toast } = useToast()

  const fetchDashboardData = useCallback(async () => {
    try {
      if (!currentCompany) return

      // Get transactions for current month
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', currentCompany.id)
        .gte('date', getFirstDayOfMonth())
        .lte('date', getLastDayOfMonth())

      // Get payables/receivables
      const { data: payables } = await supabase
        .from('payables_receivables')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('status', 'open')

      // Calculate stats
      const income = transactions?.filter((t: Transaction) => t.type === 'income').reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0) || 0
      const expenses = transactions?.filter((t: Transaction) => t.type === 'expense').reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0) || 0
      
      // Calculate payables from both payables_receivables table and liability transactions
      const payablesFromTable = payables?.filter((p: { type: string; amount: number }) => p.type === 'payable').reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0) || 0
      const payablesFromTransactions = transactions?.filter((t: Transaction) => t.type === 'liability').reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0) || 0
      const openPayables = payablesFromTable + payablesFromTransactions
      
      // Calculate receivables from both payables_receivables table and asset transactions (Accounts Receivable)
      const receivablesFromTable = payables?.filter((p: { type: string; amount: number }) => p.type === 'receivable').reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0) || 0
      const receivablesFromTransactions = transactions?.filter((t: Transaction) => t.type === 'asset' && t.category === 'Accounts Receivable').reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0) || 0
      const openReceivables = receivablesFromTable + receivablesFromTransactions

      // Get recent transactions
      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })
        .limit(5)

      setStats({
        totalIncome: income,
        totalExpenses: expenses,
        netIncome: income - expenses,
        openPayables,
        openReceivables,
        recentTransactions: recentTransactions || []
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (currentCompany) {
      fetchDashboardData()
    }
  }, [fetchDashboardData, currentCompany])

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

      // Refresh dashboard data
      await fetchDashboardData()
      cancelEditing()
    } catch (error) {
      console.error('Error updating transaction:', error)
    }
  }

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
      await fetchDashboardData()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add transaction'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const fetchReportData = async (reportType: 'pl' | 'bs' | 'cf') => {
    if (!currentCompany) return

    setReportLoading(true)
    try {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', currentCompany.id)
        .gte('date', reportDateRange.fromDate)
        .lte('date', reportDateRange.toDate)

      if (!transactions) return

      let reportData: any = {}

      if (reportType === 'pl') {
        // Profit & Loss Statement
        const income = transactions.filter((t: Transaction) => t.type === 'income')
        const expenses = transactions.filter((t: Transaction) => t.type === 'expense')
        
        const incomeByCategory = income.reduce((acc: any, t: Transaction) => {
          acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
          return acc
        }, {})
        
        const expensesByCategory = expenses.reduce((acc: any, t: Transaction) => {
          acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
          return acc
        }, {})

        const totalIncome = income.reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)
        const totalExpenses = expenses.reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)
        const netIncome = totalIncome - totalExpenses

        reportData = {
          type: 'pl',
          title: 'Profit & Loss Statement',
          period: `${formatDate(reportDateRange.fromDate)} - ${formatDate(reportDateRange.toDate)}`,
          income: incomeByCategory,
          expenses: expensesByCategory,
          totalIncome,
          totalExpenses,
          netIncome
        }
      } else if (reportType === 'bs') {
        // Balance Sheet
        const assets = transactions.filter((t: Transaction) => t.type === 'asset')
        const liabilities = transactions.filter((t: Transaction) => t.type === 'liability')
        const equity = transactions.filter((t: Transaction) => t.type === 'equity')

        const assetsByCategory = assets.reduce((acc: any, t: Transaction) => {
          acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
          return acc
        }, {})

        const liabilitiesByCategory = liabilities.reduce((acc: any, t: Transaction) => {
          acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
          return acc
        }, {})

        const equityByCategory = equity.reduce((acc: any, t: Transaction) => {
          acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
          return acc
        }, {})

        const totalAssets = assets.reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)
        const totalLiabilities = liabilities.reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)
        const totalEquity = equity.reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)

        reportData = {
          type: 'bs',
          title: 'Balance Sheet',
          period: `As of ${formatDate(reportDateRange.toDate)}`,
          assets: assetsByCategory,
          liabilities: liabilitiesByCategory,
          equity: equityByCategory,
          totalAssets,
          totalLiabilities,
          totalEquity
        }
      } else if (reportType === 'cf') {
        // Cash Flow Statement
        const income = transactions.filter((t: Transaction) => t.type === 'income')
        const expenses = transactions.filter((t: Transaction) => t.type === 'expense')
        const assets = transactions.filter((t: Transaction) => t.type === 'asset')
        const liabilities = transactions.filter((t: Transaction) => t.type === 'liability')

        const operatingIncome = income.reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)
        const operatingExpenses = expenses.reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)
        const netOperatingCash = operatingIncome - operatingExpenses

        const investingActivities = assets.reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)
        const financingActivities = liabilities.reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0)

        const netCashFlow = netOperatingCash - investingActivities + financingActivities

        reportData = {
          type: 'cf',
          title: 'Cash Flow Statement',
          period: `${formatDate(reportDateRange.fromDate)} - ${formatDate(reportDateRange.toDate)}`,
          operatingIncome,
          operatingExpenses,
          netOperatingCash,
          investingActivities,
          financingActivities,
          netCashFlow
        }
      }

      setReportData(reportData)
    } catch (error) {
      console.error('Error fetching report data:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive',
      })
    } finally {
      setReportLoading(false)
    }
  }

  const openReportModal = (reportType: 'pl' | 'bs' | 'cf') => {
    setCurrentReport(reportType)
    setReportModalOpen(true)
    fetchReportData(reportType)
  }

  // Auto-update report when date range changes
  useEffect(() => {
    if (reportModalOpen && currentReport) {
      fetchReportData(currentReport)
    }
  }, [reportDateRange.fromDate, reportDateRange.toDate, reportModalOpen, currentReport])

  const downloadReportPDF = async () => {
    if (!reportData || !currentCompany) return

    try {
      setPdfGenerating(true)

      // Prepare report data in the format expected by the PDF generator
      const pdfReportData: ReportData = {
        profitLoss: {
          revenue: reportData.type === 'pl' ? reportData.income : {},
          costOfGoodsSold: {},
          operatingExpenses: reportData.type === 'pl' ? reportData.expenses : {},
          otherIncome: {},
          otherExpenses: {},
          totalRevenue: reportData.type === 'pl' ? reportData.totalIncome : 0,
          totalCostOfGoodsSold: 0,
          totalOperatingExpenses: reportData.type === 'pl' ? reportData.totalExpenses : 0,
          totalOtherIncome: 0,
          totalOtherExpenses: 0,
          grossProfit: reportData.type === 'pl' ? reportData.totalIncome : 0,
          operatingIncome: reportData.type === 'pl' ? reportData.netIncome : 0,
          netIncome: reportData.type === 'pl' ? reportData.netIncome : 0
        },
        balanceSheet: {
          assets: reportData.type === 'bs' ? reportData.assets : {},
          liabilities: reportData.type === 'bs' ? reportData.liabilities : {},
          equity: reportData.type === 'bs' ? reportData.equity : {},
          totalAssets: reportData.type === 'bs' ? reportData.totalAssets : 0,
          totalLiabilities: reportData.type === 'bs' ? reportData.totalLiabilities : 0,
          totalEquity: reportData.type === 'bs' ? reportData.totalEquity : 0
        },
        cashFlow: {
          operatingActivities: {},
          investingActivities: {},
          financingActivities: {},
          totalOperatingActivities: reportData.type === 'cf' ? reportData.netOperatingCash : 0,
          totalInvestingActivities: reportData.type === 'cf' ? reportData.investingActivities : 0,
          totalFinancingActivities: reportData.type === 'cf' ? reportData.financingActivities : 0,
          netCashFlow: reportData.type === 'cf' ? reportData.netCashFlow : 0
        },
        generalLedger: {
          accounts: {},
          totalDebits: 0,
          totalCredits: 0
        },
        trialBalance: {
          accounts: {},
          totalDebits: 0,
          totalCredits: 0,
          isBalanced: true
        }
      }

      // Determine report type for PDF generation
      const reportType = reportData.type === 'pl' ? 'profit-loss' : 
                        reportData.type === 'bs' ? 'balance-sheet' : 
                        reportData.type === 'cf' ? 'cash-flow' : 'all'

      // Generate PDF
      const pdfBytes = await generateFinancialReportPDF({
        companyName: currentCompany.name,
        dateFrom: reportDateRange.fromDate,
        dateTo: reportDateRange.toDate,
        accountingMethod: 'cash',
        reportData: pdfReportData,
        reportType
      })

      // Create filename
      const filename = `${reportData.title.toLowerCase().replace(/\s+/g, '-')}-${reportDateRange.fromDate}-to-${reportDateRange.toDate}.pdf`

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
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
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
            <CardTitle className="text-sm font-medium">Open Receivables</CardTitle>
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
            <div className={`text-2xl font-bold ${stats.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(stats.netIncome)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Buttons */}
      <div className="grid gap-4 md:grid-cols-3">
        <Button 
          onClick={() => openReportModal('pl')} 
          variant="outline" 
          className="h-20 flex flex-col items-center justify-center space-y-2"
        >
          <FileText className="h-6 w-6" />
          <span>Profit & Loss</span>
        </Button>
        <Button 
          onClick={() => openReportModal('bs')} 
          variant="outline" 
          className="h-20 flex flex-col items-center justify-center space-y-2"
        >
          <FileText className="h-6 w-6" />
          <span>Balance Sheet</span>
        </Button>
        <Button 
          onClick={() => openReportModal('cf')} 
          variant="outline" 
          className="h-20 flex flex-col items-center justify-center space-y-2"
        >
          <FileText className="h-6 w-6" />
          <span>Cash Flow</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Your latest financial activity
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats.recentTransactions.length === 0 ? (
            <p className="text-muted-foreground">No transactions yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentTransactions.map((transaction) => {
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
          )}
        </CardContent>
      </Card>

      {/* Add Transaction Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Add a new transaction to your records
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddTransaction} className="space-y-4">
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
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="$0.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="type">Type *</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value: 'income' | 'expense' | 'asset' | 'liability' | 'equity') => setFormData({ ...formData, type: value, category: '' })}
              >
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
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Notes"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                Add Transaction
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={reportDateRange.fromDate}
                onChange={(e) => {
                  setReportDateRange({ ...reportDateRange, fromDate: e.target.value })
                }}
              />
            </div>
            <div>
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={reportDateRange.toDate}
                onChange={(e) => {
                  setReportDateRange({ ...reportDateRange, toDate: e.target.value })
                }}
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
                  <h3 className="text-lg font-semibold mb-4">Income</h3>
                  {Object.entries(reportData.income).map(([category, amount]: [string, any]) => (
                    <div key={category} className="flex justify-between py-1">
                      <span>{category}</span>
                      <span className="text-green-600 font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Income</span>
                      <span className="text-green-600">{formatCurrency(reportData.totalIncome)}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 mt-6">Expenses</h3>
                  {Object.entries(reportData.expenses).map(([category, amount]: [string, any]) => (
                    <div key={category} className="flex justify-between py-1">
                      <span>{category}</span>
                      <span className="text-red-600 font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Expenses</span>
                      <span className="text-red-600">{formatCurrency(reportData.totalExpenses)}</span>
                    </div>
                  </div>

                  <div className="border-t-2 pt-4 mt-6">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Net Income</span>
                      <span className={reportData.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(reportData.netIncome)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {reportData.type === 'bs' && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Assets</h3>
                  {Object.entries(reportData.assets).map(([category, amount]: [string, any]) => (
                    <div key={category} className="flex justify-between py-1">
                      <span>{category}</span>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Assets</span>
                      <span>{formatCurrency(reportData.totalAssets)}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 mt-6">Liabilities</h3>
                  {Object.entries(reportData.liabilities).map(([category, amount]: [string, any]) => (
                    <div key={category} className="flex justify-between py-1">
                      <span>{category}</span>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Liabilities</span>
                      <span>{formatCurrency(reportData.totalLiabilities)}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 mt-6">Equity</h3>
                  {Object.entries(reportData.equity).map(([category, amount]: [string, any]) => (
                    <div key={category} className="flex justify-between py-1">
                      <span>{category}</span>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total Equity</span>
                      <span>{formatCurrency(reportData.totalEquity)}</span>
                    </div>
                  </div>
                </div>
              )}

              {reportData.type === 'cf' && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Operating Activities</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Operating Income</span>
                      <span className="text-green-600 font-medium">{formatCurrency(reportData.operatingIncome)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Operating Expenses</span>
                      <span className="text-red-600 font-medium">{formatCurrency(reportData.operatingExpenses)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Net Operating Cash</span>
                        <span className={reportData.netOperatingCash >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(reportData.netOperatingCash)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 mt-6">Investing Activities</h3>
                  <div className="flex justify-between">
                    <span>Investing Activities</span>
                    <span className="text-red-600 font-medium">{formatCurrency(reportData.investingActivities)}</span>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 mt-6">Financing Activities</h3>
                  <div className="flex justify-between">
                    <span>Financing Activities</span>
                    <span className="text-green-600 font-medium">{formatCurrency(reportData.financingActivities)}</span>
                  </div>

                  <div className="border-t-2 pt-4 mt-6">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Net Cash Flow</span>
                      <span className={reportData.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(reportData.netCashFlow)}
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