'use client'

import { useEffect, useState, useCallback } from 'react'

export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from '@/components/ui/table'
import { FileText, Download } from 'lucide-react'
import { generateFinancialReportPDF, downloadPDF, type ReportData } from '@/lib/pdf-generator'
import { 
  formatDate, 
  getCurrentYear, 
  getCurrentMonth, 
  getFirstDayOfYear,
  getLastDayOfYear,
  getFirstDayOfSpecificMonth,
  getLastDayOfSpecificMonth,
  getYearOptions
} from '@/lib/date-utils'
import { useCompany } from '@/contexts/CompanyContext'

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData>({
    profitLoss: {
      revenue: {},
      costOfGoodsSold: {},
      operatingExpenses: {},
      otherIncome: {},
      otherExpenses: {},
      totalRevenue: 0,
      totalCostOfGoodsSold: 0,
      totalOperatingExpenses: 0,
      totalOtherIncome: 0,
      totalOtherExpenses: 0,
      grossProfit: 0,
      operatingIncome: 0,
      netIncome: 0
    },
    balanceSheet: {
      assets: {},
      liabilities: {},
      equity: {},
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0
    },
    cashFlow: {
      operatingActivities: {},
      investingActivities: {},
      financingActivities: {},
      totalOperatingActivities: 0,
      totalInvestingActivities: 0,
      totalFinancingActivities: 0,
      netCashFlow: 0
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
  })
  const [loading, setLoading] = useState(true)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [showMoreReports, setShowMoreReports] = useState(false)
  const accountingMethod = 'cash' // Default accounting method
  const [selectedYear, setSelectedYear] = useState(getCurrentYear())
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [dateFrom, setDateFrom] = useState(getFirstDayOfYear(getCurrentYear()))
  const [dateTo, setDateTo] = useState(getLastDayOfYear(getCurrentYear()))
  const supabase = createClient()
  const { currentCompany } = useCompany()

  const fetchReportData = useCallback(async () => {
    try {
      if (!currentCompany) return

      // Get transactions for the date range
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', currentCompany.id)
        .gte('date', dateFrom)
        .lte('date', dateTo)

      // Get payables/receivables
      const { data: payables } = await supabase
        .from('payables_receivables')
        .select('*')
        .eq('company_id', currentCompany.id)

      if (!transactions) return

      // Calculate Profit & Loss according to GAAP standards
      const revenueByCategory: { [key: string]: number } = {}
      const costOfGoodsSoldByCategory: { [key: string]: number } = {}
      const operatingExpensesByCategory: { [key: string]: number } = {}
      const otherIncomeByCategory: { [key: string]: number } = {}
      const otherExpensesByCategory: { [key: string]: number } = {}
      
      let totalRevenue = 0
      let totalCostOfGoodsSold = 0
      let totalOperatingExpenses = 0
      let totalOtherIncome = 0
      let totalOtherExpenses = 0

      transactions.forEach((transaction: { type: string; category: string; amount: number }) => {
        const amount = Number(transaction.amount)
        
        if (transaction.type === 'income') {
          // Categorize income into Revenue vs Other Income
          if (['Sales Revenue', 'Service Revenue', 'Consulting Income', 'Rental Income'].includes(transaction.category)) {
            revenueByCategory[transaction.category] = (revenueByCategory[transaction.category] || 0) + amount
            totalRevenue += amount
          } else {
            otherIncomeByCategory[transaction.category] = (otherIncomeByCategory[transaction.category] || 0) + amount
            totalOtherIncome += amount
          }
        } else if (transaction.type === 'expense') {
          // Categorize expenses into COGS vs Operating Expenses vs Other Expenses
          if (['Cost of Goods Sold', 'Inventory', 'Materials', 'Direct Labor'].includes(transaction.category)) {
            costOfGoodsSoldByCategory[transaction.category] = (costOfGoodsSoldByCategory[transaction.category] || 0) + amount
            totalCostOfGoodsSold += amount
          } else if (['Office Supplies', 'Travel', 'Meals & Entertainment', 'Software & Subscriptions', 'Marketing', 'Utilities', 'Rent', 'Insurance', 'Equipment', 'Legal & Accounting', 'Bank Fees', 'Professional Services'].includes(transaction.category)) {
            operatingExpensesByCategory[transaction.category] = (operatingExpensesByCategory[transaction.category] || 0) + amount
            totalOperatingExpenses += amount
          } else {
            otherExpensesByCategory[transaction.category] = (otherExpensesByCategory[transaction.category] || 0) + amount
            totalOtherExpenses += amount
          }
        }
      })

      // Calculate Balance Sheet according to GAAP standards
      const assetsByCategory: { [key: string]: number } = {}
      const liabilitiesByCategory: { [key: string]: number } = {}
      const equityByCategory: { [key: string]: number } = {}
      
      let totalAssets = 0
      let totalLiabilities = 0
      let totalEquity = 0

      // Process all transactions for balance sheet
      transactions.forEach((transaction: { type: string; category: string; amount: number }) => {
        const amount = Number(transaction.amount)
        
        if (transaction.type === 'asset') {
          assetsByCategory[transaction.category] = (assetsByCategory[transaction.category] || 0) + amount
          totalAssets += amount
        } else if (transaction.type === 'liability') {
          liabilitiesByCategory[transaction.category] = (liabilitiesByCategory[transaction.category] || 0) + amount
          totalLiabilities += amount
        } else if (transaction.type === 'equity') {
          equityByCategory[transaction.category] = (equityByCategory[transaction.category] || 0) + amount
          totalEquity += amount
        }
      })

      // Add payables/receivables to balance sheet
      const openReceivables = payables?.filter((p: { type: string; status: string; amount: number }) => p.type === 'receivable' && p.status === 'open').reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0) || 0
      const openPayables = payables?.filter((p: { type: string; status: string; amount: number }) => p.type === 'payable' && p.status === 'open').reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0) || 0
      
      if (openReceivables > 0) {
        assetsByCategory['Accounts Receivable'] = (assetsByCategory['Accounts Receivable'] || 0) + openReceivables
        totalAssets += openReceivables
      }
      
      if (openPayables > 0) {
        liabilitiesByCategory['Accounts Payable'] = (liabilitiesByCategory['Accounts Payable'] || 0) + openPayables
        totalLiabilities += openPayables
      }

      // Calculate net income for retained earnings
      const grossProfit = totalRevenue - totalCostOfGoodsSold
      const operatingIncome = grossProfit - totalOperatingExpenses
      const netIncome = operatingIncome + totalOtherIncome - totalOtherExpenses
      
      // Add net income to retained earnings in equity
      if (netIncome !== 0) {
        equityByCategory['Retained Earnings'] = (equityByCategory['Retained Earnings'] || 0) + netIncome
        totalEquity += netIncome
      }

      // Ensure Assets = Liabilities + Equity (basic accounting equation)
      const accountingEquationBalance = totalAssets - (totalLiabilities + totalEquity)
      if (Math.abs(accountingEquationBalance) > 0.01) {
        // Adjust equity to balance the equation
        equityByCategory['Retained Earnings'] = (equityByCategory['Retained Earnings'] || 0) + accountingEquationBalance
        totalEquity += accountingEquationBalance
      }

      // Calculate Cash Flow Statement according to GAAP standards
      const operatingActivitiesByCategory: { [key: string]: number } = {}
      const investingActivitiesByCategory: { [key: string]: number } = {}
      const financingActivitiesByCategory: { [key: string]: number } = {}
      
      let totalOperatingActivities = 0
      let totalInvestingActivities = 0
      let totalFinancingActivities = 0

      // Process all transactions for cash flow categorization
      transactions.forEach((transaction: { type: string; category: string; amount: number }) => {
        const amount = Number(transaction.amount)
        
        if (transaction.type === 'income') {
          // Operating activities - revenue generation
          operatingActivitiesByCategory[transaction.category] = (operatingActivitiesByCategory[transaction.category] || 0) + amount
          totalOperatingActivities += amount
        } else if (transaction.type === 'expense') {
          // Operating activities - expense payments
          operatingActivitiesByCategory[transaction.category] = (operatingActivitiesByCategory[transaction.category] || 0) - amount
          totalOperatingActivities -= amount
        } else if (transaction.type === 'asset') {
          // Investing activities - asset purchases/sales
          if (['Equipment', 'Furniture', 'Vehicles', 'Buildings', 'Land'].includes(transaction.category)) {
            investingActivitiesByCategory[transaction.category] = (investingActivitiesByCategory[transaction.category] || 0) - amount
            totalInvestingActivities -= amount
          } else {
            // Other assets might be operating (inventory, prepaid expenses)
            operatingActivitiesByCategory[transaction.category] = (operatingActivitiesByCategory[transaction.category] || 0) - amount
            totalOperatingActivities -= amount
          }
        } else if (transaction.type === 'liability') {
          // Financing activities - debt transactions
          financingActivitiesByCategory[transaction.category] = (financingActivitiesByCategory[transaction.category] || 0) + amount
          totalFinancingActivities += amount
        } else if (transaction.type === 'equity') {
          // Financing activities - equity transactions
          if (['Owner\'s Capital', 'Owner\'s Draws', 'Owner\'s Draw', 'Owner\'s Contribution', 'Common Stock'].includes(transaction.category)) {
            financingActivitiesByCategory[transaction.category] = (financingActivitiesByCategory[transaction.category] || 0) + amount
            totalFinancingActivities += amount
          } else if (['Loan Transaction', 'Investment Transaction'].includes(transaction.category)) {
            financingActivitiesByCategory[transaction.category] = (financingActivitiesByCategory[transaction.category] || 0) + amount
            totalFinancingActivities += amount
          } else {
            // Internal transfers and other equity items
            operatingActivitiesByCategory[transaction.category] = (operatingActivitiesByCategory[transaction.category] || 0) + amount
            totalOperatingActivities += amount
          }
        }
      })

      // Add net income as starting point for operating activities
      if (netIncome !== 0) {
        operatingActivitiesByCategory['Net Income'] = (operatingActivitiesByCategory['Net Income'] || 0) + netIncome
        totalOperatingActivities += netIncome
      }

      // Add changes in working capital (simplified)
      const changeInReceivables = openReceivables > 0 ? -openReceivables : 0
      const changeInPayables = openPayables > 0 ? openPayables : 0
      
      if (changeInReceivables !== 0) {
        operatingActivitiesByCategory['Change in Accounts Receivable'] = changeInReceivables
        totalOperatingActivities += changeInReceivables
      }
      
      if (changeInPayables !== 0) {
        operatingActivitiesByCategory['Change in Accounts Payable'] = changeInPayables
        totalOperatingActivities += changeInPayables
      }

      const netCashFlow = totalOperatingActivities + totalInvestingActivities + totalFinancingActivities

      // Calculate General Ledger according to GAAP standards
      const generalLedgerAccounts: { [account: string]: { debits: number; credits: number; balance: number } } = {}
      let totalDebits = 0
      let totalCredits = 0

      // Process all transactions for general ledger
      transactions.forEach((transaction: { type: string; category: string; amount: number; description?: string; date: string }) => {
        const amount = Number(transaction.amount)
        const accountName = transaction.category
        
        if (!generalLedgerAccounts[accountName]) {
          generalLedgerAccounts[accountName] = { debits: 0, credits: 0, balance: 0 }
        }

        // Apply double-entry bookkeeping rules
        if (transaction.type === 'asset') {
          // Assets: Debit increases, Credit decreases
          generalLedgerAccounts[accountName].debits += amount
          generalLedgerAccounts[accountName].balance += amount
          totalDebits += amount
        } else if (transaction.type === 'liability') {
          // Liabilities: Credit increases, Debit decreases
          generalLedgerAccounts[accountName].credits += amount
          generalLedgerAccounts[accountName].balance -= amount
          totalCredits += amount
        } else if (transaction.type === 'equity') {
          // Equity: Credit increases, Debit decreases
          generalLedgerAccounts[accountName].credits += amount
          generalLedgerAccounts[accountName].balance -= amount
          totalCredits += amount
        } else if (transaction.type === 'income') {
          // Income: Credit increases, Debit decreases
          generalLedgerAccounts[accountName].credits += amount
          generalLedgerAccounts[accountName].balance -= amount
          totalCredits += amount
        } else if (transaction.type === 'expense') {
          // Expenses: Debit increases, Credit decreases
          generalLedgerAccounts[accountName].debits += amount
          generalLedgerAccounts[accountName].balance += amount
          totalDebits += amount
        }
      })

      // Calculate Trial Balance
      const trialBalanceAccounts: { [account: string]: { debits: number; credits: number; balance: number } } = {}
      let trialBalanceTotalDebits = 0
      let trialBalanceTotalCredits = 0

      // Copy general ledger accounts to trial balance
      Object.entries(generalLedgerAccounts).forEach(([account, data]) => {
        trialBalanceAccounts[account] = { ...data }
        if (data.balance > 0) {
          trialBalanceTotalDebits += data.balance
        } else {
          trialBalanceTotalCredits += Math.abs(data.balance)
        }
      })

      // Check if trial balance is balanced (debits = credits)
      const isBalanced = Math.abs(trialBalanceTotalDebits - trialBalanceTotalCredits) < 0.01

      setReportData({
        profitLoss: {
          revenue: revenueByCategory,
          costOfGoodsSold: costOfGoodsSoldByCategory,
          operatingExpenses: operatingExpensesByCategory,
          otherIncome: otherIncomeByCategory,
          otherExpenses: otherExpensesByCategory,
          totalRevenue,
          totalCostOfGoodsSold,
          totalOperatingExpenses,
          totalOtherIncome,
          totalOtherExpenses,
          grossProfit,
          operatingIncome,
          netIncome
        },
        balanceSheet: {
          assets: assetsByCategory,
          liabilities: liabilitiesByCategory,
          equity: equityByCategory,
          totalAssets,
          totalLiabilities,
          totalEquity
        },
        cashFlow: {
          operatingActivities: operatingActivitiesByCategory,
          investingActivities: investingActivitiesByCategory,
          financingActivities: financingActivitiesByCategory,
          totalOperatingActivities,
          totalInvestingActivities,
          totalFinancingActivities,
          netCashFlow
        },
        generalLedger: {
          accounts: generalLedgerAccounts,
          totalDebits,
          totalCredits
        },
        trialBalance: {
          accounts: trialBalanceAccounts,
          totalDebits: trialBalanceTotalDebits,
          totalCredits: trialBalanceTotalCredits,
          isBalanced
        }
      })
    } catch (error) {
      console.error('Error fetching report data:', error)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, currentCompany, supabase])

  useEffect(() => {
    if (currentCompany) {
      fetchReportData()
    }
  }, [fetchReportData, currentCompany])
  useEffect(() => {
    updateDatesForYear(selectedYear)
  }, []) // Only run once on mount

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const updateDatesForYear = (year: number) => {
    setDateFrom(getFirstDayOfYear(year))
    setDateTo(getLastDayOfYear(year))
  }

  const updateDatesForMonth = (year: number, month: number) => {
    setDateFrom(getFirstDayOfSpecificMonth(year, month))
    setDateTo(getLastDayOfSpecificMonth(year, month))
  }

  const handleYearChange = (year: number) => {
    setSelectedYear(year)
    updateDatesForYear(year)
  }

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month)
    updateDatesForMonth(selectedYear, month)
  }

  const isFullYear = () => {
    // Parse dates consistently using UTC to avoid timezone issues
    const fromDate = new Date(dateFrom + 'T00:00:00.000Z')
    const toDate = new Date(dateTo + 'T00:00:00.000Z')
    
    // Check if it's a full year (January 1st to December 31st of same year)
    return fromDate.getUTCFullYear() === toDate.getUTCFullYear() &&
           fromDate.getUTCMonth() === 0 && fromDate.getUTCDate() === 1 &&
           toDate.getUTCMonth() === 11 && toDate.getUTCDate() === 31
  }

  const isFullMonth = () => {
    // Parse dates consistently using UTC to avoid timezone issues
    const fromDate = new Date(dateFrom + 'T00:00:00.000Z')
    const toDate = new Date(dateTo + 'T00:00:00.000Z')
    
    // Check if it's a full month (1st to last day of same month)
    if (fromDate.getUTCFullYear() !== toDate.getUTCFullYear() || 
        fromDate.getUTCMonth() !== toDate.getUTCMonth()) {
      return false
    }
    
    // Check if fromDate is the 1st of the month
    if (fromDate.getUTCDate() !== 1) {
      return false
    }
    
    // Check if toDate is the last day of the month
    const lastDayOfMonth = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + 1, 0))
    return toDate.getUTCDate() === lastDayOfMonth.getUTCDate()
  }

  const handleExportProfitLossPDF = async () => {
    try {
      setPdfGenerating(true)
      const pdfBytes = await generateFinancialReportPDF({
        companyName: 'Your Company',
        dateFrom,
        dateTo,
        accountingMethod,
        reportData,
        reportType: 'profit-loss',
      })

      const filename = `profit-loss-report-${dateFrom}-to-${dateTo}.pdf`
      await downloadPDF(pdfBytes, filename)
    } catch (error) {
      console.error('Error generating Profit & Loss PDF:', error)
    } finally {
      setPdfGenerating(false)
    }
  }

  const handleExportBalanceSheetPDF = async () => {
    try {
      setPdfGenerating(true)
      const pdfBytes = await generateFinancialReportPDF({
        companyName: 'Your Company',
        dateFrom,
        dateTo,
        accountingMethod,
        reportData,
        reportType: 'balance-sheet',
      })

      const filename = `balance-sheet-report-${dateTo}.pdf`
      await downloadPDF(pdfBytes, filename)
    } catch (error) {
      console.error('Error generating Balance Sheet PDF:', error)
    } finally {
      setPdfGenerating(false)
    }
  }

  const handleExportCashFlowPDF = async () => {
    try {
      setPdfGenerating(true)
      const pdfBytes = await generateFinancialReportPDF({
        companyName: 'Your Company',
        dateFrom,
        dateTo,
        accountingMethod,
        reportData,
        reportType: 'cash-flow',
      })

      const filename = `cash-flow-report-${dateFrom}-to-${dateTo}.pdf`
      await downloadPDF(pdfBytes, filename)
    } catch (error) {
      console.error('Error generating Cash Flow PDF:', error)
    } finally {
      setPdfGenerating(false)
    }
  }

  const handleExportGeneralLedgerPDF = async () => {
    try {
      setPdfGenerating(true)
      const pdfBytes = await generateFinancialReportPDF({
        companyName: 'Your Company',
        dateFrom,
        dateTo,
        accountingMethod,
        reportData,
        reportType: 'general-ledger',
      })

      const filename = `general-ledger-${dateFrom}-to-${dateTo}.pdf`
      await downloadPDF(pdfBytes, filename)
    } catch (error) {
      console.error('Error generating General Ledger PDF:', error)
    } finally {
      setPdfGenerating(false)
    }
  }

  const handleExportTrialBalancePDF = async () => {
    try {
      setPdfGenerating(true)
      const pdfBytes = await generateFinancialReportPDF({
        companyName: 'Your Company',
        dateFrom,
        dateTo,
        accountingMethod,
        reportData,
        reportType: 'trial-balance',
      })

      const filename = `trial-balance-${dateTo}.pdf`
      await downloadPDF(pdfBytes, filename)
    } catch (error) {
      console.error('Error generating Trial Balance PDF:', error)
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
        <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
        <p className="text-muted-foreground">
          View your business financial statements
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Dates</CardTitle>
        </CardHeader>
        <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
                              <Label className={isFullYear() ? "font-bold" : ""}>Year</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => handleYearChange(parseInt(value))}>
                  <SelectTrigger style={isFullYear() ? { fontWeight: 'bold', border: '2px solid #6b7280' } : {}}>
                  <SelectValue />
                </SelectTrigger>
                                  <SelectContent>
                    {getYearOptions().map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
                              <Label className={isFullMonth() && !isFullYear() ? "font-bold" : ""}>Month</Label>
                <Select value={selectedMonth.toString()} onValueChange={(value) => handleMonthChange(parseInt(value))}>
                  <SelectTrigger style={isFullMonth() && !isFullYear() ? { fontWeight: 'bold', border: '2px solid #6b7280' } : {}}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">January</SelectItem>
                  <SelectItem value="1">February</SelectItem>
                  <SelectItem value="2">March</SelectItem>
                  <SelectItem value="3">April</SelectItem>
                  <SelectItem value="4">May</SelectItem>
                  <SelectItem value="5">June</SelectItem>
                  <SelectItem value="6">July</SelectItem>
                  <SelectItem value="7">August</SelectItem>
                  <SelectItem value="8">September</SelectItem>
                  <SelectItem value="9">October</SelectItem>
                  <SelectItem value="10">November</SelectItem>
                  <SelectItem value="11">December</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={isFullYear() || isFullMonth() || (!isFullYear() && !isFullMonth()) ? "font-bold" : ""}>From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={isFullYear() || isFullMonth() || (!isFullYear() && !isFullMonth()) ? { fontWeight: 'bold', border: '2px solid #6b7280' } : {}}
              />
            </div>
            <div className="space-y-2">
              <Label className={isFullYear() || isFullMonth() || (!isFullYear() && !isFullMonth()) ? "font-bold" : ""}>To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={isFullYear() || isFullMonth() || (!isFullYear() && !isFullMonth()) ? { fontWeight: 'bold', border: '2px solid #6b7280' } : {}}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profit-loss" className="space-y-4">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
            <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
            <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
            {showMoreReports && (
              <>
                <TabsTrigger value="general-ledger">General Ledger</TabsTrigger>
                <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
              </>
            )}
          </TabsList>
          <Button 
            variant="outline" 
            onClick={() => setShowMoreReports(!showMoreReports)}
            className="ml-4"
          >
            {showMoreReports ? 'Less Reports' : 'More Reports'}
          </Button>
        </div>

        <TabsContent value="profit-loss">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Profit & Loss Statement
                  </CardTitle>
                  <CardDescription>
                    {formatDate(dateFrom)} - {formatDate(dateTo)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExportProfitLossPDF} 
                    disabled={pdfGenerating}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {pdfGenerating ? 'Generating...' : 'Download PDF'}
                  </Button>
                  {isFullYear() && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                      Full Year
                    </div>
                  )}
                  {isFullMonth() && !isFullYear() && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                      Full Month
                    </div>
                  )}
                  {!isFullYear() && !isFullMonth() && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                      Custom Range
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Revenue Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Revenue</h3>
                  <Table>
                    <TableBody>
                      {Object.entries(reportData.profitLoss.revenue).map(([category, amount]) => (
                        <TableRow key={category}>
                          <TableCell>{category}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">Total Revenue</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(reportData.profitLoss.totalRevenue)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Cost of Goods Sold Section */}
                {Object.keys(reportData.profitLoss.costOfGoodsSold).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Cost of Goods Sold</h3>
                    <Table>
                      <TableBody>
                        {Object.entries(reportData.profitLoss.costOfGoodsSold).map(([category, amount]) => (
                          <TableRow key={category}>
                            <TableCell>{category}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2">
                          <TableCell className="font-semibold">Total Cost of Goods Sold</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(reportData.profitLoss.totalCostOfGoodsSold)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Gross Profit */}
                {Object.keys(reportData.profitLoss.costOfGoodsSold).length > 0 && (
                  <div className="border-t-2 pt-4">
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="text-lg font-bold">Gross Profit</TableCell>
                          <TableCell className="text-right text-lg font-bold">
                            {formatCurrency(reportData.profitLoss.grossProfit)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Operating Expenses Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Operating Expenses</h3>
                  <Table>
                    <TableBody>
                      {Object.entries(reportData.profitLoss.operatingExpenses).map(([category, amount]) => (
                        <TableRow key={category}>
                          <TableCell>{category}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">Total Operating Expenses</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(reportData.profitLoss.totalOperatingExpenses)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Operating Income */}
                <div className="border-t-2 pt-4">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-lg font-bold">Operating Income</TableCell>
                        <TableCell className="text-right text-lg font-bold">
                          {formatCurrency(reportData.profitLoss.operatingIncome)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Other Income Section */}
                {Object.keys(reportData.profitLoss.otherIncome).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Other Income</h3>
                    <Table>
                      <TableBody>
                        {Object.entries(reportData.profitLoss.otherIncome).map(([category, amount]) => (
                          <TableRow key={category}>
                            <TableCell>{category}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2">
                          <TableCell className="font-semibold">Total Other Income</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(reportData.profitLoss.totalOtherIncome)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Other Expenses Section */}
                {Object.keys(reportData.profitLoss.otherExpenses).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Other Expenses</h3>
                    <Table>
                      <TableBody>
                        {Object.entries(reportData.profitLoss.otherExpenses).map(([category, amount]) => (
                          <TableRow key={category}>
                            <TableCell>{category}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2">
                          <TableCell className="font-semibold">Total Other Expenses</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(reportData.profitLoss.totalOtherExpenses)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Net Income */}
                <div className="border-t-2 pt-4">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-xl font-bold">Net Income</TableCell>
                        <TableCell className="text-right text-xl font-bold">
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
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Balance Sheet
                  </CardTitle>
                  <CardDescription>
                    As of {formatDate(dateTo)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExportBalanceSheetPDF} 
                    disabled={pdfGenerating}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {pdfGenerating ? 'Generating...' : 'Download PDF'}
                  </Button>
                  {isFullYear() && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                      Full Year
                    </div>
                  )}
                  {isFullMonth() && !isFullYear() && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                      Full Month
                    </div>
                  )}
                  {!isFullYear() && !isFullMonth() && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                      Custom Range
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-8">
                {/* Assets Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Assets</h3>
                  <Table>
                    <TableBody>
                      {Object.entries(reportData.balanceSheet.assets).map(([category, amount]) => (
                        <TableRow key={category}>
                          <TableCell>{category}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">Total Assets</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(reportData.balanceSheet.totalAssets)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Liabilities Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Liabilities</h3>
                  <Table>
                    <TableBody>
                      {Object.entries(reportData.balanceSheet.liabilities).map(([category, amount]) => (
                        <TableRow key={category}>
                          <TableCell>{category}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">Total Liabilities</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(reportData.balanceSheet.totalLiabilities)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Equity Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Owner&apos;s Equity</h3>
                  <Table>
                    <TableBody>
                      {Object.entries(reportData.balanceSheet.equity).map(([category, amount]) => (
                        <TableRow key={category}>
                          <TableCell>{category}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">Total Equity</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(reportData.balanceSheet.totalEquity)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Accounting Equation Verification */}
              <div className="mt-8 pt-4 border-t-2">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-lg font-bold">Total Liabilities & Equity</TableCell>
                      <TableCell className="text-right text-lg font-bold">
                        {formatCurrency(reportData.balanceSheet.totalLiabilities + reportData.balanceSheet.totalEquity)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-flow">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Cash Flow Statement
                  </CardTitle>
                  <CardDescription>
                    {formatDate(dateFrom)} - {formatDate(dateTo)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExportCashFlowPDF} 
                    disabled={pdfGenerating}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {pdfGenerating ? 'Generating...' : 'Download PDF'}
                  </Button>
                  {isFullYear() && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                      Full Year
                    </div>
                  )}
                  {isFullMonth() && !isFullYear() && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                      Full Month
                    </div>
                  )}
                  {!isFullYear() && !isFullMonth() && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                      Custom Range
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* Operating Activities Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Operating Activities</h3>
                  <Table>
                    <TableBody>
                      {Object.entries(reportData.cashFlow.operatingActivities).map(([category, amount]) => (
                        <TableRow key={category}>
                          <TableCell>{category}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">Total Operating Activities</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(reportData.cashFlow.totalOperatingActivities)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Investing Activities Section */}
                {Object.keys(reportData.cashFlow.investingActivities).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Investing Activities</h3>
                    <Table>
                      <TableBody>
                        {Object.entries(reportData.cashFlow.investingActivities).map(([category, amount]) => (
                          <TableRow key={category}>
                            <TableCell>{category}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2">
                          <TableCell className="font-semibold">Total Investing Activities</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(reportData.cashFlow.totalInvestingActivities)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Financing Activities Section */}
                {Object.keys(reportData.cashFlow.financingActivities).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Financing Activities</h3>
                    <Table>
                      <TableBody>
                        {Object.entries(reportData.cashFlow.financingActivities).map(([category, amount]) => (
                          <TableRow key={category}>
                            <TableCell>{category}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2">
                          <TableCell className="font-semibold">Total Financing Activities</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(reportData.cashFlow.totalFinancingActivities)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Net Cash Flow */}
                <div className="border-t-2 pt-4">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-xl font-bold">Net Cash Flow</TableCell>
                        <TableCell className="text-right text-xl font-bold">
                          {formatCurrency(reportData.cashFlow.netCashFlow)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>



        {showMoreReports && (
          <>
            <TabsContent value="general-ledger">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        General Ledger
                      </CardTitle>
                      <CardDescription>
                        {formatDate(dateFrom)} - {formatDate(dateTo)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleExportGeneralLedgerPDF} 
                        disabled={pdfGenerating}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {pdfGenerating ? 'Generating...' : 'Download PDF'}
                      </Button>
                      {isFullYear() && (
                        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                          Full Year
                        </div>
                      )}
                      {isFullMonth() && !isFullYear() && (
                        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                          Full Month
                        </div>
                      )}
                      {!isFullYear() && !isFullMonth() && (
                        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                          Custom Range
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {Object.entries(reportData.generalLedger.accounts).map(([account, data]) => (
                      <div key={account} className="border rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-3">{account}</h3>
                        <Table>
                          <TableBody>
                            <TableRow>
                              <TableCell className="font-medium">Debits</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(data.debits)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Credits</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(data.credits)}
                              </TableCell>
                            </TableRow>
                            <TableRow className="border-t-2">
                              <TableCell className="font-bold">Balance</TableCell>
                              <TableCell className={`text-right font-bold ${data.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(data.balance)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                    
                    <div className="border-t-2 pt-4">
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-bold">Total Debits</TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(reportData.generalLedger.totalDebits)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-bold">Total Credits</TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(reportData.generalLedger.totalCredits)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trial-balance">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Trial Balance
                      </CardTitle>
                      <CardDescription>
                        As of {formatDate(dateTo)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleExportTrialBalancePDF} 
                        disabled={pdfGenerating}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {pdfGenerating ? 'Generating...' : 'Download PDF'}
                      </Button>
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        reportData.trialBalance.isBalanced 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        <span className={`w-2 h-2 rounded-full mr-1 ${
                          reportData.trialBalance.isBalanced ? 'bg-green-500' : 'bg-red-500'
                        }`}></span>
                        {reportData.trialBalance.isBalanced ? 'Balanced' : 'Not Balanced'}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debits</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(reportData.trialBalance.accounts).map(([account, data]) => (
                        <TableRow key={account}>
                          <TableCell className="font-medium">{account}</TableCell>
                          <TableCell className="text-right">
                            {data.balance > 0 ? formatCurrency(data.balance) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {data.balance < 0 ? formatCurrency(Math.abs(data.balance)) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell className="font-bold">Totals</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(reportData.trialBalance.totalDebits)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(reportData.trialBalance.totalCredits)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  
                  <div className="mt-4 p-4 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        reportData.trialBalance.isBalanced ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span className="font-medium">
                        {reportData.trialBalance.isBalanced 
                          ? '✓ Trial Balance is balanced - Debits equal Credits' 
                          : '✗ Trial Balance is not balanced - Debits do not equal Credits'
                        }
                      </span>
                    </div>
                    {!reportData.trialBalance.isBalanced && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Difference: {formatCurrency(Math.abs(reportData.trialBalance.totalDebits - reportData.trialBalance.totalCredits))}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}