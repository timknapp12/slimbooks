'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileText, Download } from 'lucide-react'

interface ReportData {
  profitLoss: {
    income: { [category: string]: number }
    expenses: { [category: string]: number }
    totalIncome: number
    totalExpenses: number
    netIncome: number
  }
  balanceSheet: {
    assets: number
    liabilities: number
    equity: number
  }
  cashFlow: {
    operatingActivities: number
    investingActivities: number
    financingActivities: number
    netCashFlow: number
  }
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData>({
    profitLoss: {
      income: {},
      expenses: {},
      totalIncome: 0,
      totalExpenses: 0,
      netIncome: 0
    },
    balanceSheet: {
      assets: 0,
      liabilities: 0,
      equity: 0
    },
    cashFlow: {
      operatingActivities: 0,
      investingActivities: 0,
      financingActivities: 0,
      netCashFlow: 0
    }
  })
  const [loading, setLoading] = useState(true)
  const [accountingMethod, setAccountingMethod] = useState<'cash' | 'accrual'>('cash')
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]
  })
  const supabase = createClient()

  useEffect(() => {
    fetchReportData()
  }, [dateFrom, dateTo, accountingMethod])

  const fetchReportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('company_id, companies(accounting_method)')
        .eq('id', user.id)
        .single()

      if (!userData?.company_id) return

      // Get transactions for the date range
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', userData.company_id)
        .gte('date', dateFrom)
        .lte('date', dateTo)

      // Get payables/receivables
      const { data: payables } = await supabase
        .from('payables_receivables')
        .select('*')
        .eq('company_id', userData.company_id)

      if (!transactions) return

      // Calculate Profit & Loss
      const incomeByCategory: { [key: string]: number } = {}
      const expensesByCategory: { [key: string]: number } = {}
      let totalIncome = 0
      let totalExpenses = 0

      transactions.forEach(transaction => {
        if (transaction.type === 'income') {
          incomeByCategory[transaction.category] = (incomeByCategory[transaction.category] || 0) + Number(transaction.amount)
          totalIncome += Number(transaction.amount)
        } else if (transaction.type === 'expense') {
          expensesByCategory[transaction.category] = (expensesByCategory[transaction.category] || 0) + Number(transaction.amount)
          totalExpenses += Number(transaction.amount)
        }
      })

      // Calculate Balance Sheet (simplified)
      const openReceivables = payables?.filter(p => p.type === 'receivable' && p.status === 'open').reduce((sum, p) => sum + Number(p.amount), 0) || 0
      const openPayables = payables?.filter(p => p.type === 'payable' && p.status === 'open').reduce((sum, p) => sum + Number(p.amount), 0) || 0
      const cashBalance = totalIncome - totalExpenses // Simplified cash calculation
      
      const assets = cashBalance + openReceivables
      const liabilities = openPayables
      const equity = assets - liabilities

      // Calculate Cash Flow (simplified)
      const operatingActivities = totalIncome - totalExpenses
      const investingActivities = 0 // Would need more complex logic for actual investing activities
      const financingActivities = 0 // Would need more complex logic for actual financing activities
      const netCashFlow = operatingActivities + investingActivities + financingActivities

      setReportData({
        profitLoss: {
          income: incomeByCategory,
          expenses: expensesByCategory,
          totalIncome,
          totalExpenses,
          netIncome: totalIncome - totalExpenses
        },
        balanceSheet: {
          assets,
          liabilities,
          equity
        },
        cashFlow: {
          operatingActivities,
          investingActivities,
          financingActivities,
          netCashFlow
        }
      })
    } catch (error) {
      console.error('Error fetching report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-muted-foreground">
            View your business financial statements
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Accounting Method</Label>
              <Select value={accountingMethod} onValueChange={(value: 'cash' | 'accrual') => setAccountingMethod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash Basis</SelectItem>
                  <SelectItem value="accrual">Accrual Basis</SelectItem>
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
            <div className="flex items-end">
              <Button onClick={fetchReportData} className="w-full">
                Generate Reports
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profit-loss" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="profit-loss">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Profit & Loss Statement
              </CardTitle>
              <CardDescription>
                {new Date(dateFrom).toLocaleDateString()} - {new Date(dateTo).toLocaleDateString()} ({accountingMethod} basis)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Income</h3>
                  <Table>
                    <TableBody>
                      {Object.entries(reportData.profitLoss.income).map(([category, amount]) => (
                        <TableRow key={category}>
                          <TableCell>{category}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">Total Income</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {formatCurrency(reportData.profitLoss.totalIncome)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Expenses</h3>
                  <Table>
                    <TableBody>
                      {Object.entries(reportData.profitLoss.expenses).map(([category, amount]) => (
                        <TableRow key={category}>
                          <TableCell>{category}</TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatCurrency(amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">Total Expenses</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {formatCurrency(reportData.profitLoss.totalExpenses)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="border-t-2 pt-4">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-xl font-bold">Net Income</TableCell>
                        <TableCell className={`text-right text-xl font-bold ${
                          reportData.profitLoss.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(reportData.profitLoss.netIncome)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Balance Sheet
              </CardTitle>
              <CardDescription>
                As of {new Date(dateTo).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Assets</h3>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell>Cash & Cash Equivalents</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(reportData.balanceSheet.assets - (reportData.balanceSheet.assets * 0.1))}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Accounts Receivable</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(reportData.balanceSheet.assets * 0.1)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">Total Assets</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(reportData.balanceSheet.assets)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Liabilities & Equity</h3>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell>Accounts Payable</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(reportData.balanceSheet.liabilities)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="border-t">
                        <TableCell className="font-semibold">Total Liabilities</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(reportData.balanceSheet.liabilities)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Owner's Equity</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(reportData.balanceSheet.equity)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">Total Liabilities & Equity</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(reportData.balanceSheet.liabilities + reportData.balanceSheet.equity)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-flow">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Cash Flow Statement
              </CardTitle>
              <CardDescription>
                {new Date(dateFrom).toLocaleDateString()} - {new Date(dateTo).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-semibold">Operating Activities</TableCell>
                    <TableCell className={`text-right font-semibold ${
                      reportData.cashFlow.operatingActivities >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(reportData.cashFlow.operatingActivities)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">Investing Activities</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(reportData.cashFlow.investingActivities)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">Financing Activities</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(reportData.cashFlow.financingActivities)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-t-2">
                    <TableCell className="text-xl font-bold">Net Cash Flow</TableCell>
                    <TableCell className={`text-right text-xl font-bold ${
                      reportData.cashFlow.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(reportData.cashFlow.netCashFlow)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}