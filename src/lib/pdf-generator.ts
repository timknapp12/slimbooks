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

  // Define margins and layout constants
  const leftMargin = 60
  const rightMargin = 60
  const centerX = width / 2

  // Get the standard font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let yPosition = height - 60

  // Helper function to add text with proper centering
  const addText = (text: string, x: number, y: number, fontSize: number = 12, isBold: boolean = false, centered: boolean = false) => {
    const currentFont = isBold ? boldFont : font
    let xPos = x
    
    if (centered) {
      const textWidth = currentFont.widthOfTextAtSize(text, fontSize)
      xPos = centerX - (textWidth / 2)
    }
    
    page.drawText(text, {
      x: xPos,
      y,
      size: fontSize,
      font: currentFont,
      color: rgb(0, 0, 0),
    })
  }

  // Helper function to add a horizontal line
  const addLine = (y: number, startX: number = leftMargin, endX: number = width - rightMargin) => {
    page.drawLine({
      start: { x: startX, y },
      end: { x: endX, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    })
  }

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Header section with proper centering
  const reportTitle = reportType === 'profit-loss' ? 'PROFIT & LOSS STATEMENT' :
                     reportType === 'balance-sheet' ? 'BALANCE SHEET' :
                     reportType === 'cash-flow' ? 'CASH FLOW STATEMENT' :
                     reportType === 'general-ledger' ? 'GENERAL LEDGER' :
                     reportType === 'trial-balance' ? 'TRIAL BALANCE' :
                     'FINANCIAL REPORT'
  
  addText(reportTitle, 0, yPosition, 20, true, true)
  yPosition -= 35

  addText(companyName, 0, yPosition, 16, true, true)
  yPosition -= 30

  const dateText = reportType === 'balance-sheet' 
    ? `As of ${formatDateForPDF(dateTo)}`
    : `Period: ${formatDateForPDF(dateFrom)} - ${formatDateForPDF(dateTo)}`
  
  addText(dateText, 0, yPosition, 12, false, true)
  yPosition -= 20

  addText(`Accounting Method: ${accountingMethod.charAt(0).toUpperCase() + accountingMethod.slice(1)} Basis`, 0, yPosition, 12, false, true)
  yPosition -= 30

  // Add separator line
  addLine(yPosition)
  yPosition -= 30

  // Helper function to add a section with proper formatting
  const addSection = (title: string, items: Array<{accountNumber: string; accountName: string; amount: number}>, totalLabel: string, totalAmount: number) => {
    addText(title, leftMargin, yPosition, 14, true)
    yPosition -= 25

    items.forEach((item) => {
      addText(`${item.accountNumber} - ${item.accountName}`, leftMargin + 20, yPosition, 11)
      addText(formatCurrency(item.amount), width - rightMargin - 120, yPosition, 11)
      yPosition -= 16
    })

    // Add subtotal line
    addLine(yPosition + 5, leftMargin, width - rightMargin)
    yPosition -= 10

    addText(totalLabel, leftMargin + 20, yPosition, 12, true)
    addText(formatCurrency(totalAmount), width - rightMargin - 120, yPosition, 12, true)
    yPosition -= 25
  }

  // Generate content based on report type
  if (reportType === 'profit-loss' || reportType === 'all') {
    // Revenue section
    addSection('REVENUE', reportData.profitLoss.revenue, 'Total Revenue', reportData.profitLoss.totalRevenue)
    yPosition -= 10

    // Cost of Goods Sold section
    if (reportData.profitLoss.costOfGoodsSold.length > 0) {
      addSection('COST OF GOODS SOLD', reportData.profitLoss.costOfGoodsSold, 'Total Cost of Goods Sold', reportData.profitLoss.totalCostOfGoodsSold)

      // Gross Profit with emphasis
      addLine(yPosition, leftMargin, width - rightMargin)
      yPosition -= 15
      addText('GROSS PROFIT:', leftMargin + 20, yPosition, 13, true)
      addText(formatCurrency(reportData.profitLoss.grossProfit), width - rightMargin - 120, yPosition, 13, true)
      yPosition -= 30
    }

    // Operating Expenses section
    addSection('OPERATING EXPENSES', reportData.profitLoss.operatingExpenses, 'Total Operating Expenses', reportData.profitLoss.totalOperatingExpenses)

    // Operating Income with emphasis
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 15
    addText('OPERATING INCOME:', leftMargin + 20, yPosition, 13, true)
    addText(formatCurrency(reportData.profitLoss.operatingIncome), width - rightMargin - 120, yPosition, 13, true)
    yPosition -= 30

    // Other Income section
    if (reportData.profitLoss.otherIncome.length > 0) {
      addSection('OTHER INCOME', reportData.profitLoss.otherIncome, 'Total Other Income', reportData.profitLoss.totalOtherIncome)
    }

    // Other Expenses section
    if (reportData.profitLoss.otherExpenses.length > 0) {
      addSection('OTHER EXPENSES', reportData.profitLoss.otherExpenses, 'Total Other Expenses', reportData.profitLoss.totalOtherExpenses)
    }

    // Net Income with double line and emphasis
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 20
    addText('NET INCOME:', leftMargin + 20, yPosition, 16, true)
    addText(formatCurrency(reportData.profitLoss.netIncome), width - rightMargin - 120, yPosition, 16, true)
    addLine(yPosition - 5, leftMargin, width - rightMargin)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 40
  }

  if (reportType === 'balance-sheet' || reportType === 'all') {
    // Assets
    addSection('ASSETS', reportData.balanceSheet.assets, 'Total Assets', reportData.balanceSheet.totalAssets)

    // Liabilities
    addSection('LIABILITIES', reportData.balanceSheet.liabilities, 'Total Liabilities', reportData.balanceSheet.totalLiabilities)

    // Equity
    addSection("OWNER'S EQUITY", reportData.balanceSheet.equity, 'Total Equity', reportData.balanceSheet.totalEquity)

    // Total Liabilities & Equity with emphasis
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 20
    addText('TOTAL LIABILITIES & EQUITY:', leftMargin + 20, yPosition, 13, true)
    addText(formatCurrency(reportData.balanceSheet.totalLiabilities + reportData.balanceSheet.totalEquity), width - rightMargin - 120, yPosition, 13, true)
    addLine(yPosition - 5, leftMargin, width - rightMargin)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 40
  }

  if (reportType === 'cash-flow' || reportType === 'all') {
    // Operating Activities
    addSection('OPERATING ACTIVITIES', reportData.cashFlow.operatingActivities, 'Total Operating Activities', reportData.cashFlow.totalOperatingActivities)

    // Investing Activities
    if (reportData.cashFlow.investingActivities.length > 0) {
      addSection('INVESTING ACTIVITIES', reportData.cashFlow.investingActivities, 'Total Investing Activities', reportData.cashFlow.totalInvestingActivities)
    }

    // Financing Activities
    if (reportData.cashFlow.financingActivities.length > 0) {
      addSection('FINANCING ACTIVITIES', reportData.cashFlow.financingActivities, 'Total Financing Activities', reportData.cashFlow.totalFinancingActivities)
    }

    // Net Cash Flow with emphasis
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 20
    addText('NET CASH FLOW:', leftMargin + 20, yPosition, 16, true)
    addText(formatCurrency(reportData.cashFlow.netCashFlow), width - rightMargin - 120, yPosition, 16, true)
    addLine(yPosition - 5, leftMargin, width - rightMargin)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 40
  }

  if (reportType === 'general-ledger' || reportType === 'all') {
    addText('GENERAL LEDGER', 0, yPosition, 16, true, true)
    yPosition -= 30

    // Table headers
    addText('Account', leftMargin, yPosition, 12, true)
    addText('Debits', leftMargin + 200, yPosition, 12, true)
    addText('Credits', leftMargin + 300, yPosition, 12, true)
    addText('Balance', leftMargin + 400, yPosition, 12, true)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 20

    reportData.generalLedger.accounts.forEach((account) => {
      addText(`${account.accountNumber} - ${account.accountName}`, leftMargin, yPosition, 11)
      addText(formatCurrency(account.debits), leftMargin + 200, yPosition, 11)
      addText(formatCurrency(account.credits), leftMargin + 300, yPosition, 11)
      addText(formatCurrency(account.balance), leftMargin + 400, yPosition, 11)
      yPosition -= 16
    })

    // Totals section
    addLine(yPosition + 5, leftMargin, width - rightMargin)
    yPosition -= 15
    addText('TOTALS:', leftMargin, yPosition, 12, true)
    addText(formatCurrency(reportData.generalLedger.totalDebits), leftMargin + 200, yPosition, 12, true)
    addText(formatCurrency(reportData.generalLedger.totalCredits), leftMargin + 300, yPosition, 12, true)
    yPosition -= 40
  }

  if (reportType === 'trial-balance' || reportType === 'all') {
    addText('TRIAL BALANCE', 0, yPosition, 16, true, true)
    yPosition -= 30

    // Table headers
    addText('Account', leftMargin, yPosition, 12, true)
    addText('Debits', leftMargin + 250, yPosition, 12, true)
    addText('Credits', leftMargin + 350, yPosition, 12, true)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 20

    reportData.trialBalance.accounts.forEach((account) => {
      addText(`${account.accountNumber} - ${account.accountName}`, leftMargin, yPosition, 11)
      if (account.balance > 0) {
        addText(formatCurrency(account.balance), leftMargin + 250, yPosition, 11)
      } else {
        addText(formatCurrency(Math.abs(account.balance)), leftMargin + 350, yPosition, 11)
      }
      yPosition -= 16
    })

    // Totals section
    addLine(yPosition + 5, leftMargin, width - rightMargin)
    yPosition -= 15
    addText('TOTALS:', leftMargin, yPosition, 12, true)
    addText(formatCurrency(reportData.trialBalance.totalDebits), leftMargin + 250, yPosition, 12, true)
    addText(formatCurrency(reportData.trialBalance.totalCredits), leftMargin + 350, yPosition, 12, true)
    yPosition -= 20

    addText(`Status: ${reportData.trialBalance.isBalanced ? 'BALANCED' : 'NOT BALANCED'}`, leftMargin, yPosition, 12, true)
    yPosition -= 40
  }

  // Footer with separator
  const footerY = 60
  addLine(footerY + 20, leftMargin, width - rightMargin)
  
  const now = new Date()
  const currentDate = now.toISOString().split('T')[0]
  const currentTime = now.toLocaleTimeString('en-US', { 
    timeZone: 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  
  addText(`Generated on ${formatDateForPDF(currentDate)} at ${currentTime} UTC`, leftMargin, footerY, 10)
  addText('SlimBooks Financial Management System', width - rightMargin - 180, footerY, 10)

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