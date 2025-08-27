'use client'

import { useEffect, useState, useCallback } from 'react'

export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHeader,
  TableHead,
} from '@/components/ui/table'
import { Download } from 'lucide-react'
import { generateFinancialReportPDF, downloadPDF } from '@/lib/pdf-generator'
import {
  generateFinancialReportsDoubleEntry,
  type ReportData,
} from '@/lib/report-generator-double-entry'
import {
  formatDate,
  getCurrentYear,
  getCurrentMonth,
  getFirstDayOfYear,
  getLastDayOfYear,
  getFirstDayOfSpecificMonth,
  getLastDayOfSpecificMonth,
  getYearOptions,
} from '@/lib/date-utils'
import { useCompany } from '@/contexts/CompanyContext'

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData>({
    profitLoss: {
      revenue: [],
      costOfGoodsSold: [],
      operatingExpenses: [],
      otherIncome: [],
      otherExpenses: [],
      totalRevenue: 0,
      totalCostOfGoodsSold: 0,
      totalOperatingExpenses: 0,
      totalOtherIncome: 0,
      totalOtherExpenses: 0,
      grossProfit: 0,
      operatingIncome: 0,
      netIncome: 0,
    },
    balanceSheet: {
      assets: [],
      liabilities: [],
      equity: [],
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
    },
    cashFlow: {
      operatingActivities: [],
      investingActivities: [],
      financingActivities: [],
      totalOperatingActivities: 0,
      totalInvestingActivities: 0,
      totalFinancingActivities: 0,
      netCashFlow: 0,
    },
    generalLedger: {
      accounts: [],
      totalDebits: 0,
      totalCredits: 0,
    },
    trialBalance: {
      accounts: [],
      totalDebits: 0,
      totalCredits: 0,
      isBalanced: true,
    },
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

      const reportData = await generateFinancialReportsDoubleEntry({
        supabase,
        companyId: currentCompany.id,
        fromDate: dateFrom,
        toDate: dateTo,
      })

      // Set the report data
      setReportData(reportData)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id]) // Only depend on company ID, not fetchReportData

  useEffect(() => {
    updateDatesForYear(selectedYear)
  }, [selectedYear]) // Include selectedYear in dependencies

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
    return (
      fromDate.getUTCFullYear() === toDate.getUTCFullYear() &&
      fromDate.getUTCMonth() === 0 &&
      fromDate.getUTCDate() === 1 &&
      toDate.getUTCMonth() === 11 &&
      toDate.getUTCDate() === 31
    )
  }

  const isFullMonth = () => {
    // Parse dates consistently using UTC to avoid timezone issues
    const fromDate = new Date(dateFrom + 'T00:00:00.000Z')
    const toDate = new Date(dateTo + 'T00:00:00.000Z')

    // Check if it's a full month (1st to last day of same month)
    if (
      fromDate.getUTCFullYear() !== toDate.getUTCFullYear() ||
      fromDate.getUTCMonth() !== toDate.getUTCMonth()
    ) {
      return false
    }

    // Check if fromDate is the 1st of the month
    if (fromDate.getUTCDate() !== 1) {
      return false
    }

    // Check if toDate is the last day of the month
    const lastDayOfMonth = new Date(
      Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + 1, 0)
    )
    return toDate.getUTCDate() === lastDayOfMonth.getUTCDate()
  }

  const handleExportProfitLossPDF = async () => {
    try {
      setPdfGenerating(true)
      const pdfBytes = await generateFinancialReportPDF({
        companyName: currentCompany?.name || 'Your Company',
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
        companyName: currentCompany?.name || 'Your Company',
        dateFrom,
        dateTo,
        accountingMethod,
        reportData,
        reportType: 'balance-sheet',
      })

      const filename = `balance-sheet-report-${dateFrom}-to-${dateTo}.pdf`
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
        companyName: currentCompany?.name || 'Your Company',
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
        companyName: currentCompany?.name || 'Your Company',
        dateFrom,
        dateTo,
        accountingMethod,
        reportData,
        reportType: 'general-ledger',
      })

      const filename = `general-ledger-report-${dateFrom}-to-${dateTo}.pdf`
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
        companyName: currentCompany?.name || 'Your Company',
        dateFrom,
        dateTo,
        accountingMethod,
        reportData,
        reportType: 'trial-balance',
      })

      const filename = `trial-balance-report-${dateFrom}-to-${dateTo}.pdf`
      await downloadPDF(pdfBytes, filename)
    } catch (error) {
      console.error('Error generating Trial Balance PDF:', error)
    } finally {
      setPdfGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <p>Loading reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Financial Reports</h1>
        <p className="text-gray-600">
          Generate and view your financial reports
        </p>
      </div>

      {/* Report Dates Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Report Dates</CardTitle>
          <CardDescription>
            Select the date range for your reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="year">Year</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={value => handleYearChange(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getYearOptions().map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isFullYear() && (
                <div className="mt-1">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Full Year Selected
                  </span>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="month">Month</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={value => handleMonthChange(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">January</SelectItem>
                  <SelectItem value="2">February</SelectItem>
                  <SelectItem value="3">March</SelectItem>
                  <SelectItem value="4">April</SelectItem>
                  <SelectItem value="5">May</SelectItem>
                  <SelectItem value="6">June</SelectItem>
                  <SelectItem value="7">July</SelectItem>
                  <SelectItem value="8">August</SelectItem>
                  <SelectItem value="9">September</SelectItem>
                  <SelectItem value="10">October</SelectItem>
                  <SelectItem value="11">November</SelectItem>
                  <SelectItem value="12">December</SelectItem>
                </SelectContent>
              </Select>
              {isFullMonth() && (
                <div className="mt-1">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Full Month Selected
                  </span>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className={
                  isFullYear() || isFullMonth()
                    ? 'font-bold border-gray-300'
                    : 'border-gray-300'
                }
              />
            </div>
            <div>
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className={
                  isFullYear() || isFullMonth()
                    ? 'font-bold border-gray-300'
                    : 'border-gray-300'
                }
              />
            </div>
          </div>
          {!isFullYear() && !isFullMonth() && (
            <div className="mt-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Custom Range
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Tabs defaultValue="profit-loss" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
        </TabsList>

        {/* Profit & Loss Statement */}
        <TabsContent value="profit-loss">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Profit & Loss Statement</CardTitle>
                  <CardDescription>
                    {formatDate(dateFrom)} - {formatDate(dateTo)}
                  </CardDescription>
                </div>
                <Button
                  onClick={handleExportProfitLossPDF}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={pdfGenerating}
                >
                  <Download className="h-4 w-4" />
                  {pdfGenerating ? 'Generating...' : 'Download PDF'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Revenue */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Revenue</h3>
                  {reportData.profitLoss.revenue.map(item => (
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
                      <span>Total Revenue</span>
                      <span>
                        {formatCurrency(reportData.profitLoss.totalRevenue)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cost of Goods Sold */}
                {reportData.profitLoss.costOfGoodsSold.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Cost of Goods Sold
                    </h3>
                    {reportData.profitLoss.costOfGoodsSold.map(item => (
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
                        <span>Total Cost of Goods Sold</span>
                        <span>
                          {formatCurrency(
                            reportData.profitLoss.totalCostOfGoodsSold
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Gross Profit */}
                <div className="border-t pt-4">
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Gross Profit</span>
                    <span>
                      {formatCurrency(reportData.profitLoss.grossProfit)}
                    </span>
                  </div>
                </div>

                {/* Operating Expenses */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Operating Expenses
                  </h3>
                  {reportData.profitLoss.operatingExpenses.map(item => (
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
                      <span>Total Operating Expenses</span>
                      <span>
                        {formatCurrency(
                          reportData.profitLoss.totalOperatingExpenses
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Operating Income */}
                <div className="border-t pt-4">
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Operating Income</span>
                    <span>
                      {formatCurrency(reportData.profitLoss.operatingIncome)}
                    </span>
                  </div>
                </div>

                {/* Other Income */}
                {reportData.profitLoss.otherIncome.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Other Income</h3>
                    {reportData.profitLoss.otherIncome.map(item => (
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
                        <span>Total Other Income</span>
                        <span>
                          {formatCurrency(
                            reportData.profitLoss.totalOtherIncome
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Other Expenses */}
                {reportData.profitLoss.otherExpenses.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Other Expenses
                    </h3>
                    {reportData.profitLoss.otherExpenses.map(item => (
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
                        <span>Total Other Expenses</span>
                        <span>
                          {formatCurrency(
                            reportData.profitLoss.totalOtherExpenses
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Net Income */}
                <div className="border-t-2 pt-4">
                  <div className="flex justify-between font-bold text-xl">
                    <span>Net Income</span>
                    <span
                      className={
                        reportData.profitLoss.netIncome >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {formatCurrency(reportData.profitLoss.netIncome)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Balance Sheet</CardTitle>
                  <CardDescription>As of {formatDate(dateTo)}</CardDescription>
                </div>
                <Button
                  onClick={handleExportBalanceSheetPDF}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={pdfGenerating}
                >
                  <Download className="h-4 w-4" />
                  {pdfGenerating ? 'Generating...' : 'Download PDF'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Assets */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Assets</h3>
                  {reportData.balanceSheet.assets.map(item => (
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
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total Assets</span>
                      <span>
                        {formatCurrency(reportData.balanceSheet.totalAssets)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Liabilities & Equity */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Liabilities</h3>
                  {reportData.balanceSheet.liabilities.map(item => (
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
                          reportData.balanceSheet.totalLiabilities
                        )}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-4 mt-6">Equity</h3>
                  {reportData.balanceSheet.equity.map(item => (
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
                        {formatCurrency(reportData.balanceSheet.totalEquity)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t-2 pt-4 mt-4">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Liabilities + Equity</span>
                      <span>
                        {formatCurrency(
                          reportData.balanceSheet.totalLiabilities +
                            reportData.balanceSheet.totalEquity
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow Statement */}
        <TabsContent value="cash-flow">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cash Flow Statement</CardTitle>
                  <CardDescription>
                    {formatDate(dateFrom)} - {formatDate(dateTo)}
                  </CardDescription>
                </div>
                <Button
                  onClick={handleExportCashFlowPDF}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={pdfGenerating}
                >
                  <Download className="h-4 w-4" />
                  {pdfGenerating ? 'Generating...' : 'Download PDF'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Operating Activities */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Operating Activities
                  </h3>
                  {reportData.cashFlow.operatingActivities.map(item => (
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
                        className={`font-medium ${
                          item.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Net Cash from Operating Activities</span>
                      <span
                        className={
                          reportData.cashFlow.totalOperatingActivities >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }
                      >
                        {formatCurrency(
                          reportData.cashFlow.totalOperatingActivities
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Investing Activities */}
                {reportData.cashFlow.investingActivities.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Investing Activities
                    </h3>
                    {reportData.cashFlow.investingActivities.map(item => (
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
                          className={`font-medium ${
                            item.amount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Net Cash from Investing Activities</span>
                        <span
                          className={
                            reportData.cashFlow.totalInvestingActivities >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {formatCurrency(
                            reportData.cashFlow.totalInvestingActivities
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Financing Activities */}
                {reportData.cashFlow.financingActivities.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Financing Activities
                    </h3>
                    {reportData.cashFlow.financingActivities.map(item => (
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
                          className={`font-medium ${
                            item.amount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Net Cash from Financing Activities</span>
                        <span
                          className={
                            reportData.cashFlow.totalFinancingActivities >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {formatCurrency(
                            reportData.cashFlow.totalFinancingActivities
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Net Cash Flow */}
                <div className="border-t-2 pt-4">
                  <div className="flex justify-between font-bold text-xl">
                    <span>Net Cash Flow</span>
                    <span
                      className={
                        reportData.cashFlow.netCashFlow >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {formatCurrency(reportData.cashFlow.netCashFlow)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* More Reports Section */}
      <div className="mt-8">
        <Button
          onClick={() => setShowMoreReports(!showMoreReports)}
          variant="outline"
          className="w-full"
        >
          {showMoreReports ? 'Less Reports' : 'More Reports'}
        </Button>
      </div>

      {showMoreReports && (
        <div className="mt-6 space-y-6">
          {/* General Ledger */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>General Ledger</CardTitle>
                  <CardDescription>
                    {formatDate(dateFrom)} - {formatDate(dateTo)}
                  </CardDescription>
                </div>
                <Button
                  onClick={handleExportGeneralLedgerPDF}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={pdfGenerating}
                >
                  <Download className="h-4 w-4" />
                  {pdfGenerating ? 'Generating...' : 'Download PDF'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debits</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(reportData.generalLedger.accounts).map(
                    ([account, data]) => (
                      <TableRow key={account}>
                        <TableCell className="font-medium">{account}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(data.debits)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(data.credits)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(data.balance)}
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between font-semibold">
                  <span>Total Debits</span>
                  <span>
                    {formatCurrency(reportData.generalLedger.totalDebits)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total Credits</span>
                  <span>
                    {formatCurrency(reportData.generalLedger.totalCredits)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trial Balance */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Trial Balance</CardTitle>
                  <CardDescription>As of {formatDate(dateTo)}</CardDescription>
                </div>
                <Button
                  onClick={handleExportTrialBalancePDF}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={pdfGenerating}
                >
                  <Download className="h-4 w-4" />
                  {pdfGenerating ? 'Generating...' : 'Download PDF'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debits</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(reportData.trialBalance.accounts).map(
                    ([account, data]) => (
                      <TableRow key={account}>
                        <TableCell className="font-medium">{account}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(data.debits)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(data.credits)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(data.balance)}
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between font-semibold">
                  <span>Total Debits</span>
                  <span>
                    {formatCurrency(reportData.trialBalance.totalDebits)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total Credits</span>
                  <span>
                    {formatCurrency(reportData.trialBalance.totalCredits)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold mt-2">
                  <span>Balanced</span>
                  <span
                    className={
                      reportData.trialBalance.isBalanced
                        ? 'text-green-600'
                        : 'text-red-600'
                    }
                  >
                    {reportData.trialBalance.isBalanced ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
