import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { formatDateForPDF } from '@/lib/date-utils'

export interface ReportData {
  profitLoss: {
    revenue: Array<{ accountNumber: string; accountName: string; amount: number }>
    costOfGoodsSold: Array<{ accountNumber: string; accountName: string; amount: number }>
    operatingExpenses: Array<{ accountNumber: string; accountName: string; amount: number }>
    otherIncome: Array<{ accountNumber: string; accountName: string; amount: number }>
    otherExpenses: Array<{ accountNumber: string; accountName: string; amount: number }>
    totalRevenue: number
    totalCostOfGoodsSold: number
    totalOperatingExpenses: number
    totalOtherIncome: number
    totalOtherExpenses: number
    grossProfit: number
    operatingIncome: number
    netIncome: number
  }
  balanceSheet: {
    assets: Array<{ accountNumber: string; accountName: string; amount: number }>
    liabilities: Array<{ accountNumber: string; accountName: string; amount: number }>
    equity: Array<{ accountNumber: string; accountName: string; amount: number }>
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
  }
  cashFlow: {
    operatingActivities: Array<{ accountNumber: string; accountName: string; amount: number }>
    investingActivities: Array<{ accountNumber: string; accountName: string; amount: number }>
    financingActivities: Array<{ accountNumber: string; accountName: string; amount: number }>
    totalOperatingActivities: number
    totalInvestingActivities: number
    totalFinancingActivities: number
    netCashFlow: number
  }
  generalLedger: {
    accounts: Array<{ accountNumber: string; accountName: string; debits: number; credits: number; balance: number }>
    totalDebits: number
    totalCredits: number
  }
  trialBalance: {
    accounts: Array<{ accountNumber: string; accountName: string; debits: number; credits: number; balance: number }>
    totalDebits: number
    totalCredits: number
    isBalanced: boolean
  }
}

export interface PDFReportOptions {
  companyName?: string
  dateFrom: string
  dateTo: string
  accountingMethod: 'cash' | 'accrual'
  reportData: ReportData
  reportType?: 'profit-loss' | 'balance-sheet' | 'cash-flow' | 'general-ledger' | 'trial-balance' | 'all'
}

export async function generateFinancialReportPDF(options: PDFReportOptions): Promise<Uint8Array> {
  const { companyName = 'Your Company', dateFrom, dateTo, accountingMethod, reportData, reportType = 'all' } = options

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // US Letter size
  const { width, height } = page.getSize()

  // Get the standard font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let yPosition = height - 50

  // Helper function to add text
  const addText = (text: string, x: number, y: number, fontSize: number = 12, isBold: boolean = false) => {
    const currentFont = isBold ? boldFont : font
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font: currentFont,
      color: rgb(0, 0, 0),
    })
  }

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Header
  const reportTitle = reportType === 'profit-loss' ? 'PROFIT & LOSS STATEMENT' :
                     reportType === 'balance-sheet' ? 'BALANCE SHEET' :
                     reportType === 'cash-flow' ? 'CASH FLOW STATEMENT' :
                     'FINANCIAL REPORT'
  
  addText(reportTitle, width / 2 - 60, yPosition, 18, true)
  yPosition -= 30

  addText(companyName, width / 2 - 50, yPosition, 14, true)
  yPosition -= 25

  if (reportType === 'balance-sheet') {
    addText(`As of ${formatDateForPDF(dateTo)}`, 50, yPosition)
  } else {
    addText(`Period: ${formatDateForPDF(dateFrom)} - ${formatDateForPDF(dateTo)}`, 50, yPosition)
  }
  yPosition -= 20

  addText(`Accounting Method: ${accountingMethod.charAt(0).toUpperCase() + accountingMethod.slice(1)} Basis`, 50, yPosition)
  yPosition -= 40

  // Generate content based on report type
  if (reportType === 'profit-loss' || reportType === 'all') {
    // Revenue section
    addText('Revenue:', 50, yPosition, 14, true)
    yPosition -= 20

    reportData.profitLoss.revenue.forEach((item) => {
      addText(`${item.accountNumber} - ${item.accountName}`, 70, yPosition)
      addText(formatCurrency(item.amount), width - 150, yPosition)
      yPosition -= 15
    })

    addText('Total Revenue:', 50, yPosition, 12, true)
    addText(formatCurrency(reportData.profitLoss.totalRevenue), width - 150, yPosition, 12, true)
    yPosition -= 30

    // Cost of Goods Sold section
    if (reportData.profitLoss.costOfGoodsSold.length > 0) {
      addText('Cost of Goods Sold:', 50, yPosition, 14, true)
      yPosition -= 20

      reportData.profitLoss.costOfGoodsSold.forEach((item) => {
        addText(`${item.accountNumber} - ${item.accountName}`, 70, yPosition)
        addText(formatCurrency(item.amount), width - 150, yPosition)
        yPosition -= 15
      })

      addText('Total Cost of Goods Sold:', 50, yPosition, 12, true)
      addText(formatCurrency(reportData.profitLoss.totalCostOfGoodsSold), width - 150, yPosition, 12, true)
      yPosition -= 30

      // Gross Profit
      addText('Gross Profit:', 50, yPosition, 12, true)
      addText(formatCurrency(reportData.profitLoss.grossProfit), width - 150, yPosition, 12, true)
      yPosition -= 30
    }

    // Operating Expenses section
    addText('Operating Expenses:', 50, yPosition, 14, true)
    yPosition -= 20

    reportData.profitLoss.operatingExpenses.forEach((item) => {
      addText(`${item.accountNumber} - ${item.accountName}`, 70, yPosition)
      addText(formatCurrency(item.amount), width - 150, yPosition)
      yPosition -= 15
    })

    addText('Total Operating Expenses:', 50, yPosition, 12, true)
    addText(formatCurrency(reportData.profitLoss.totalOperatingExpenses), width - 150, yPosition, 12, true)
    yPosition -= 30

    // Operating Income
    addText('Operating Income:', 50, yPosition, 12, true)
    addText(formatCurrency(reportData.profitLoss.operatingIncome), width - 150, yPosition, 12, true)
    yPosition -= 30

    // Other Income section
    if (reportData.profitLoss.otherIncome.length > 0) {
      addText('Other Income:', 50, yPosition, 14, true)
      yPosition -= 20

      reportData.profitLoss.otherIncome.forEach((item) => {
        addText(`${item.accountNumber} - ${item.accountName}`, 70, yPosition)
        addText(formatCurrency(item.amount), width - 150, yPosition)
        yPosition -= 15
      })

      addText('Total Other Income:', 50, yPosition, 12, true)
      addText(formatCurrency(reportData.profitLoss.totalOtherIncome), width - 150, yPosition, 12, true)
      yPosition -= 30
    }

    // Other Expenses section
    if (reportData.profitLoss.otherExpenses.length > 0) {
      addText('Other Expenses:', 50, yPosition, 14, true)
      yPosition -= 20

      reportData.profitLoss.otherExpenses.forEach((item) => {
        addText(`${item.accountNumber} - ${item.accountName}`, 70, yPosition)
        addText(formatCurrency(item.amount), width - 150, yPosition)
        yPosition -= 15
      })

      addText('Total Other Expenses:', 50, yPosition, 12, true)
      addText(formatCurrency(reportData.profitLoss.totalOtherExpenses), width - 150, yPosition, 12, true)
      yPosition -= 30
    }

    // Net Income
    addText('Net Income:', 50, yPosition, 14, true)
    addText(formatCurrency(reportData.profitLoss.netIncome), width - 150, yPosition, 14, true)
    yPosition -= 40
  }

  if (reportType === 'balance-sheet' || reportType === 'all') {
    // Assets
    addText('Assets:', 50, yPosition, 14, true)
    yPosition -= 20

    reportData.balanceSheet.assets.forEach((item) => {
      addText(`${item.accountNumber} - ${item.accountName}`, 70, yPosition)
      addText(formatCurrency(item.amount), width - 150, yPosition)
      yPosition -= 15
    })

    addText('Total Assets:', 50, yPosition, 12, true)
    addText(formatCurrency(reportData.balanceSheet.totalAssets), width - 150, yPosition, 12, true)
    yPosition -= 25

    // Liabilities
    addText('Liabilities:', 50, yPosition, 14, true)
    yPosition -= 20

    reportData.balanceSheet.liabilities.forEach((item) => {
      addText(`${item.accountNumber} - ${item.accountName}`, 70, yPosition)
      addText(formatCurrency(item.amount), width - 150, yPosition)
      yPosition -= 15
    })

    addText('Total Liabilities:', 50, yPosition, 12, true)
    addText(formatCurrency(reportData.balanceSheet.totalLiabilities), width - 150, yPosition, 12, true)
    yPosition -= 25

    // Equity
    addText("Owner's Equity:", 50, yPosition, 14, true)
    yPosition -= 20

    reportData.balanceSheet.equity.forEach((item) => {
      addText(`${item.accountNumber} - ${item.accountName}`, 70, yPosition)
      addText(formatCurrency(item.amount), width - 150, yPosition)
      yPosition -= 15
    })

    addText('Total Equity:', 50, yPosition, 12, true)
    addText(formatCurrency(reportData.balanceSheet.totalEquity), width - 150, yPosition, 12, true)
    yPosition -= 25

    // Total Liabilities & Equity
    addText('Total Liabilities & Equity:', 50, yPosition, 12, true)
    addText(formatCurrency(reportData.balanceSheet.totalLiabilities + reportData.balanceSheet.totalEquity), width - 150, yPosition, 12, true)
    yPosition -= 40
  }

  if (reportType === 'cash-flow' || reportType === 'all') {
    // Operating Activities
    addText('Operating Activities:', 50, yPosition, 14, true)
    yPosition -= 20

    reportData.cashFlow.operatingActivities.forEach((item) => {
      addText(`${item.accountNumber} - ${item.accountName}`, 70, yPosition)
      addText(formatCurrency(item.amount), width - 150, yPosition)
      yPosition -= 15
    })

    addText('Total Operating Activities:', 50, yPosition, 12, true)
    addText(formatCurrency(reportData.cashFlow.totalOperatingActivities), width - 150, yPosition, 12, true)
    yPosition -= 25

    // Investing Activities
    if (reportData.cashFlow.investingActivities.length > 0) {
      addText('Investing Activities:', 50, yPosition, 14, true)
      yPosition -= 20

      reportData.cashFlow.investingActivities.forEach((item) => {
        addText(`${item.accountNumber} - ${item.accountName}`, 70, yPosition)
        addText(formatCurrency(item.amount), width - 150, yPosition)
        yPosition -= 15
      })

      addText('Total Investing Activities:', 50, yPosition, 12, true)
      addText(formatCurrency(reportData.cashFlow.totalInvestingActivities), width - 150, yPosition, 12, true)
      yPosition -= 25
    }

    // Financing Activities
    if (reportData.cashFlow.financingActivities.length > 0) {
      addText('Financing Activities:', 50, yPosition, 14, true)
      yPosition -= 20

      reportData.cashFlow.financingActivities.forEach((item) => {
        addText(`${item.accountNumber} - ${item.accountName}`, 70, yPosition)
        addText(formatCurrency(item.amount), width - 150, yPosition)
        yPosition -= 15
      })

      addText('Total Financing Activities:', 50, yPosition, 12, true)
      addText(formatCurrency(reportData.cashFlow.totalFinancingActivities), width - 150, yPosition, 12, true)
      yPosition -= 25
    }

    // Net Cash Flow
    addText('Net Cash Flow:', 50, yPosition, 14, true)
    addText(formatCurrency(reportData.cashFlow.netCashFlow), width - 150, yPosition, 14, true)
    yPosition -= 40
  }

  if (reportType === 'general-ledger' || reportType === 'all') {
    addText('General Ledger:', 50, yPosition, 16, true)
    yPosition -= 25

    Object.entries(reportData.generalLedger.accounts).forEach(([account, data]) => {
      addText(account, 50, yPosition, 12, true)
      yPosition -= 15
      
      addText(`Debits: ${formatCurrency(data.debits)}`, 70, yPosition)
      addText(`Credits: ${formatCurrency(data.credits)}`, width - 200, yPosition)
      yPosition -= 15
      
      addText(`Balance: ${formatCurrency(data.balance)}`, 70, yPosition)
      yPosition -= 20
    })

    addText('Total Debits:', 50, yPosition, 12, true)
    addText(formatCurrency(reportData.generalLedger.totalDebits), width - 150, yPosition, 12, true)
    yPosition -= 15

    addText('Total Credits:', 50, yPosition, 12, true)
    addText(formatCurrency(reportData.generalLedger.totalCredits), width - 150, yPosition, 12, true)
    yPosition -= 40
  }

  if (reportType === 'trial-balance' || reportType === 'all') {
    addText('Trial Balance:', 50, yPosition, 16, true)
    yPosition -= 25

    Object.entries(reportData.trialBalance.accounts).forEach(([account, data]) => {
      addText(account, 50, yPosition)
      if (data.balance > 0) {
        addText(formatCurrency(data.balance), width - 150, yPosition)
        addText('', width - 50, yPosition)
      } else {
        addText('', width - 150, yPosition)
        addText(formatCurrency(Math.abs(data.balance)), width - 50, yPosition)
      }
      yPosition -= 15
    })

    addText('Total Debits:', 50, yPosition, 12, true)
    addText(formatCurrency(reportData.trialBalance.totalDebits), width - 150, yPosition, 12, true)
    yPosition -= 15

    addText('Total Credits:', 50, yPosition, 12, true)
    addText(formatCurrency(reportData.trialBalance.totalCredits), width - 50, yPosition, 12, true)
    yPosition -= 15

    addText(`Balanced: ${reportData.trialBalance.isBalanced ? 'Yes' : 'No'}`, 50, yPosition, 12, true)
    yPosition -= 40
  }

  // Footer
  const footerY = 50
  const now = new Date()
  const currentDate = now.toISOString().split('T')[0]
  const currentTime = now.toLocaleTimeString('en-US', { 
    timeZone: 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  addText(`Generated on ${formatDateForPDF(currentDate)} at ${currentTime} UTC`, 50, footerY, 10)
  addText('SlimBooks Financial Management System', width - 200, footerY, 10)

  // Save the PDF
  return await pdfDoc.save()
}

export async function downloadPDF(pdfBytes: Uint8Array, filename: string) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
} 