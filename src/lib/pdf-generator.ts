import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { formatDateForPDF } from '@/lib/date-utils'
import { ColumnarProfitLoss, ColumnarLineItem } from '@/types/columnar-report'

export interface ReportData {
  profitLoss: {
    revenue: Array<{
      accountNumber: string
      accountName: string
      amount: number
    }>
    costOfGoodsSold: Array<{
      accountNumber: string
      accountName: string
      amount: number
    }>
    operatingExpenses: Array<{
      accountNumber: string
      accountName: string
      amount: number
    }>
    otherIncome: Array<{
      accountNumber: string
      accountName: string
      amount: number
    }>
    otherExpenses: Array<{
      accountNumber: string
      accountName: string
      amount: number
    }>
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
    assets: Array<{
      accountNumber: string
      accountName: string
      amount: number
    }>
    liabilities: Array<{
      accountNumber: string
      accountName: string
      amount: number
    }>
    equity: Array<{
      accountNumber: string
      accountName: string
      amount: number
    }>
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
  }
  cashFlow: {
    operatingActivities: Array<{
      accountNumber: string
      accountName: string
      amount: number
    }>
    investingActivities: Array<{
      accountNumber: string
      accountName: string
      amount: number
    }>
    financingActivities: Array<{
      accountNumber: string
      accountName: string
      amount: number
    }>
    totalOperatingActivities: number
    totalInvestingActivities: number
    totalFinancingActivities: number
    netCashFlow: number
  }
  generalLedger: {
    accounts: Array<{
      accountNumber: string
      accountName: string
      debits: number
      credits: number
      balance: number
    }>
    totalDebits: number
    totalCredits: number
  }
  trialBalance: {
    accounts: Array<{
      accountNumber: string
      accountName: string
      debits: number
      credits: number
      balance: number
    }>
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
  reportType?:
    | 'profit-loss'
    | 'balance-sheet'
    | 'cash-flow'
    | 'general-ledger'
    | 'trial-balance'
    | 'all'
}

export async function generateFinancialReportPDF(
  options: PDFReportOptions
): Promise<Uint8Array> {
  const {
    companyName = 'Your Company',
    dateFrom,
    dateTo,
    accountingMethod,
    reportData,
    reportType = 'all',
  } = options

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
  const addText = (
    text: string,
    x: number,
    y: number,
    fontSize: number = 12,
    isBold: boolean = false,
    centered: boolean = false
  ) => {
    const currentFont = isBold ? boldFont : font
    let xPos = x

    if (centered) {
      const textWidth = currentFont.widthOfTextAtSize(text, fontSize)
      xPos = centerX - textWidth / 2
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
  const addLine = (
    y: number,
    startX: number = leftMargin,
    endX: number = width - rightMargin
  ) => {
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
  const reportTitle =
    reportType === 'profit-loss'
      ? 'PROFIT & LOSS STATEMENT'
      : reportType === 'balance-sheet'
      ? 'BALANCE SHEET'
      : reportType === 'cash-flow'
      ? 'CASH FLOW STATEMENT'
      : reportType === 'general-ledger'
      ? 'GENERAL LEDGER'
      : reportType === 'trial-balance'
      ? 'TRIAL BALANCE'
      : 'FINANCIAL REPORT'

  addText(reportTitle, 0, yPosition, 20, true, true)
  yPosition -= 35

  addText(companyName, 0, yPosition, 16, true, true)
  yPosition -= 30

  const dateText =
    reportType === 'balance-sheet'
      ? `As of ${formatDateForPDF(dateTo)}`
      : `Period: ${formatDateForPDF(dateFrom)} - ${formatDateForPDF(dateTo)}`

  addText(dateText, 0, yPosition, 12, false, true)
  yPosition -= 20

  addText(
    `Accounting Method: ${
      accountingMethod.charAt(0).toUpperCase() + accountingMethod.slice(1)
    } Basis`,
    0,
    yPosition,
    12,
    false,
    true
  )
  yPosition -= 30

  // Add separator line
  addLine(yPosition)
  yPosition -= 30

  // Helper function to add a section with proper formatting
  const addSection = (
    title: string,
    items: Array<{
      accountNumber: string
      accountName: string
      amount: number
    }>,
    totalLabel: string,
    totalAmount: number
  ) => {
    addText(title, leftMargin, yPosition, 14, true)
    yPosition -= 25

    items.forEach(item => {
      addText(
        `${item.accountNumber} - ${item.accountName}`,
        leftMargin + 20,
        yPosition,
        11
      )
      addText(
        formatCurrency(item.amount),
        width - rightMargin - 120,
        yPosition,
        11
      )
      yPosition -= 16
    })

    // Add subtotal line
    addLine(yPosition + 5, leftMargin, width - rightMargin)
    yPosition -= 10

    addText(totalLabel, leftMargin + 20, yPosition, 12, true)
    addText(
      formatCurrency(totalAmount),
      width - rightMargin - 120,
      yPosition,
      12,
      true
    )
    yPosition -= 25
  }

  // Generate content based on report type
  if (reportType === 'profit-loss' || reportType === 'all') {
    // Revenue section
    addSection(
      'REVENUE',
      reportData.profitLoss.revenue,
      'Total Revenue',
      reportData.profitLoss.totalRevenue
    )
    yPosition -= 10

    // Cost of Goods Sold section
    if (reportData.profitLoss.costOfGoodsSold.length > 0) {
      addSection(
        'COST OF GOODS SOLD',
        reportData.profitLoss.costOfGoodsSold,
        'Total Cost of Goods Sold',
        reportData.profitLoss.totalCostOfGoodsSold
      )

      // Gross Profit with emphasis
      addLine(yPosition, leftMargin, width - rightMargin)
      yPosition -= 15
      addText('GROSS PROFIT:', leftMargin + 20, yPosition, 13, true)
      addText(
        formatCurrency(reportData.profitLoss.grossProfit),
        width - rightMargin - 120,
        yPosition,
        13,
        true
      )
      yPosition -= 30
    }

    // Operating Expenses section
    addSection(
      'OPERATING EXPENSES',
      reportData.profitLoss.operatingExpenses,
      'Total Operating Expenses',
      reportData.profitLoss.totalOperatingExpenses
    )

    // Operating Income with emphasis
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 15
    addText('OPERATING INCOME:', leftMargin + 20, yPosition, 13, true)
    addText(
      formatCurrency(reportData.profitLoss.operatingIncome),
      width - rightMargin - 120,
      yPosition,
      13,
      true
    )
    yPosition -= 30

    // Other Income section
    if (reportData.profitLoss.otherIncome.length > 0) {
      addSection(
        'OTHER INCOME',
        reportData.profitLoss.otherIncome,
        'Total Other Income',
        reportData.profitLoss.totalOtherIncome
      )
    }

    // Other Expenses section
    if (reportData.profitLoss.otherExpenses.length > 0) {
      addSection(
        'OTHER EXPENSES',
        reportData.profitLoss.otherExpenses,
        'Total Other Expenses',
        reportData.profitLoss.totalOtherExpenses
      )
    }

    // Net Income with double line and emphasis
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 20
    addText('NET INCOME:', leftMargin + 20, yPosition, 16, true)
    addText(
      formatCurrency(reportData.profitLoss.netIncome),
      width - rightMargin - 120,
      yPosition,
      16,
      true
    )
    addLine(yPosition - 5, leftMargin, width - rightMargin)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 40
  }

  if (reportType === 'balance-sheet' || reportType === 'all') {
    // Assets
    addSection(
      'ASSETS',
      reportData.balanceSheet.assets,
      'Total Assets',
      reportData.balanceSheet.totalAssets
    )

    // Liabilities
    addSection(
      'LIABILITIES',
      reportData.balanceSheet.liabilities,
      'Total Liabilities',
      reportData.balanceSheet.totalLiabilities
    )

    // Equity
    addSection(
      "OWNER'S EQUITY",
      reportData.balanceSheet.equity,
      'Total Equity',
      reportData.balanceSheet.totalEquity
    )

    // Total Liabilities & Equity with emphasis
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 20
    addText('TOTAL LIABILITIES & EQUITY:', leftMargin + 20, yPosition, 13, true)
    addText(
      formatCurrency(
        reportData.balanceSheet.totalLiabilities +
          reportData.balanceSheet.totalEquity
      ),
      width - rightMargin - 120,
      yPosition,
      13,
      true
    )
    addLine(yPosition - 5, leftMargin, width - rightMargin)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 40
  }

  if (reportType === 'cash-flow' || reportType === 'all') {
    // Operating Activities
    addSection(
      'OPERATING ACTIVITIES',
      reportData.cashFlow.operatingActivities,
      'Total Operating Activities',
      reportData.cashFlow.totalOperatingActivities
    )

    // Investing Activities
    if (reportData.cashFlow.investingActivities.length > 0) {
      addSection(
        'INVESTING ACTIVITIES',
        reportData.cashFlow.investingActivities,
        'Total Investing Activities',
        reportData.cashFlow.totalInvestingActivities
      )
    }

    // Financing Activities
    if (reportData.cashFlow.financingActivities.length > 0) {
      addSection(
        'FINANCING ACTIVITIES',
        reportData.cashFlow.financingActivities,
        'Total Financing Activities',
        reportData.cashFlow.totalFinancingActivities
      )
    }

    // Net Cash Flow with emphasis
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 5
    addLine(yPosition, leftMargin, width - rightMargin)
    yPosition -= 20
    addText('NET CASH FLOW:', leftMargin + 20, yPosition, 16, true)
    addText(
      formatCurrency(reportData.cashFlow.netCashFlow),
      width - rightMargin - 120,
      yPosition,
      16,
      true
    )
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

    reportData.generalLedger.accounts.forEach(account => {
      addText(
        `${account.accountNumber} - ${account.accountName}`,
        leftMargin,
        yPosition,
        11
      )
      addText(formatCurrency(account.debits), leftMargin + 200, yPosition, 11)
      addText(formatCurrency(account.credits), leftMargin + 300, yPosition, 11)
      addText(formatCurrency(account.balance), leftMargin + 400, yPosition, 11)
      yPosition -= 16
    })

    // Totals section
    addLine(yPosition + 5, leftMargin, width - rightMargin)
    yPosition -= 15
    addText('TOTALS:', leftMargin, yPosition, 12, true)
    addText(
      formatCurrency(reportData.generalLedger.totalDebits),
      leftMargin + 200,
      yPosition,
      12,
      true
    )
    addText(
      formatCurrency(reportData.generalLedger.totalCredits),
      leftMargin + 300,
      yPosition,
      12,
      true
    )
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

    reportData.trialBalance.accounts.forEach(account => {
      addText(
        `${account.accountNumber} - ${account.accountName}`,
        leftMargin,
        yPosition,
        11
      )
      if (account.balance > 0) {
        addText(
          formatCurrency(account.balance),
          leftMargin + 250,
          yPosition,
          11
        )
      } else {
        addText(
          formatCurrency(Math.abs(account.balance)),
          leftMargin + 350,
          yPosition,
          11
        )
      }
      yPosition -= 16
    })

    // Totals section
    addLine(yPosition + 5, leftMargin, width - rightMargin)
    yPosition -= 15
    addText('TOTALS:', leftMargin, yPosition, 12, true)
    addText(
      formatCurrency(reportData.trialBalance.totalDebits),
      leftMargin + 250,
      yPosition,
      12,
      true
    )
    addText(
      formatCurrency(reportData.trialBalance.totalCredits),
      leftMargin + 350,
      yPosition,
      12,
      true
    )
    yPosition -= 20

    addText(
      `Status: ${
        reportData.trialBalance.isBalanced ? 'BALANCED' : 'NOT BALANCED'
      }`,
      leftMargin,
      yPosition,
      12,
      true
    )
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
    second: '2-digit',
  })

  addText(
    `Generated on ${formatDateForPDF(currentDate)} at ${currentTime} UTC`,
    leftMargin,
    footerY,
    10
  )
  addText(
    'SlimBooks Financial Management System',
    width - rightMargin - 180,
    footerY,
    10
  )

  // Save the PDF
  return await pdfDoc.save()
}

export interface ColumnarPDFOptions {
  companyName?: string
  year: number
  columnMode: 'monthly' | 'quarterly'
  accountingMethod: 'cash' | 'accrual'
  columnarData: ColumnarProfitLoss
}

export async function generateColumnarProfitLossPDF(
  options: ColumnarPDFOptions
): Promise<Uint8Array> {
  const {
    companyName = 'Your Company',
    year,
    columnMode,
    accountingMethod,
    columnarData,
  } = options

  // Create a new PDF document in landscape orientation
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([792, 612]) // US Letter landscape
  const { width, height } = page.getSize()

  // Define margins and layout constants
  const leftMargin = 40
  const rightMargin = 40
  const topMargin = 50
  const centerX = width / 2

  // Get fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let yPosition = height - topMargin

  // Calculate column widths dynamically
  const periods = columnarData.periods
  const columnCount = periods.length + 2 // Account name + periods + Total
  const availableWidth = width - leftMargin - rightMargin
  const accountColWidth = 140
  const totalColWidth = 60
  const periodColWidth = Math.floor(
    (availableWidth - accountColWidth - totalColWidth) / periods.length
  )

  // Helper function to format currency (compact for columns)
  const formatCurrency = (amount: number): string => {
    if (amount === 0) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Helper function to add text
  const addText = (
    text: string,
    x: number,
    y: number,
    fontSize: number = 9,
    isBold: boolean = false,
    align: 'left' | 'right' | 'center' = 'left',
    maxWidth?: number
  ) => {
    const currentFont = isBold ? boldFont : font
    let displayText = text

    // Truncate text if it exceeds maxWidth
    if (maxWidth) {
      while (
        currentFont.widthOfTextAtSize(displayText, fontSize) > maxWidth &&
        displayText.length > 3
      ) {
        displayText = displayText.slice(0, -4) + '...'
      }
    }

    const textWidth = currentFont.widthOfTextAtSize(displayText, fontSize)
    let xPos = x

    if (align === 'right') {
      xPos = x - textWidth
    } else if (align === 'center') {
      xPos = x - textWidth / 2
    }

    page.drawText(displayText, {
      x: xPos,
      y,
      size: fontSize,
      font: currentFont,
      color: rgb(0, 0, 0),
    })
  }

  // Helper to add colored text
  const addColoredText = (
    text: string,
    x: number,
    y: number,
    fontSize: number,
    isBold: boolean,
    align: 'left' | 'right',
    isPositive: boolean
  ) => {
    const currentFont = isBold ? boldFont : font
    const textWidth = currentFont.widthOfTextAtSize(text, fontSize)
    const xPos = align === 'right' ? x - textWidth : x

    page.drawText(text, {
      x: xPos,
      y,
      size: fontSize,
      font: currentFont,
      color: isPositive ? rgb(0.1, 0.5, 0.1) : rgb(0.7, 0.1, 0.1),
    })
  }

  // Helper to draw horizontal line
  const addLine = (
    y: number,
    startX: number = leftMargin,
    endX: number = width - rightMargin
  ) => {
    page.drawLine({
      start: { x: startX, y },
      end: { x: endX, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    })
  }

  // Get X position for a column
  const getColX = (colIndex: number): number => {
    if (colIndex === 0) return leftMargin // Account name column
    if (colIndex === columnCount - 1) return width - rightMargin // Total column (right edge)
    return (
      leftMargin +
      accountColWidth +
      (colIndex - 1) * periodColWidth +
      periodColWidth
    ) // Period columns
  }

  // Header
  addText('PROFIT & LOSS STATEMENT', centerX, yPosition, 14, true, 'center')
  yPosition -= 18
  addText(companyName, centerX, yPosition, 12, true, 'center')
  yPosition -= 16
  const periodLabel =
    columnMode === 'monthly' ? 'Monthly Breakdown' : 'Quarterly Breakdown'
  addText(`${periodLabel} - ${year}`, centerX, yPosition, 10, false, 'center')
  yPosition -= 14
  addText(
    `Accounting Method: ${
      accountingMethod.charAt(0).toUpperCase() + accountingMethod.slice(1)
    } Basis`,
    centerX,
    yPosition,
    9,
    false,
    'center'
  )
  yPosition -= 20

  // Column headers
  addLine(yPosition + 5)
  yPosition -= 12
  addText('Account', leftMargin, yPosition, 9, true)
  periods.forEach((period, idx) => {
    addText(period.label, getColX(idx + 1), yPosition, 9, true, 'right')
  })
  addText('Total', getColX(columnCount - 1), yPosition, 9, true, 'right')
  yPosition -= 5
  addLine(yPosition)
  yPosition -= 14

  // Helper to render a section
  const renderSection = (
    title: string,
    items: ColumnarLineItem[],
    totalLabel: string,
    periodTotals: Record<string, number>,
    grandTotal: number
  ) => {
    if (items.length === 0 && grandTotal === 0) return

    // Section header
    addText(title.toUpperCase(), leftMargin, yPosition, 9, true)
    yPosition -= 12

    // Items
    items.forEach(item => {
      const accountLabel = `${item.accountNumber} ${item.accountName}`
      addText(
        accountLabel,
        leftMargin + 10,
        yPosition,
        8,
        false,
        'left',
        accountColWidth - 15
      )
      periods.forEach((period, idx) => {
        addText(
          formatCurrency(item.periodAmounts[period.key]),
          getColX(idx + 1),
          yPosition,
          8,
          false,
          'right'
        )
      })
      addText(
        formatCurrency(item.total),
        getColX(columnCount - 1),
        yPosition,
        8,
        false,
        'right'
      )
      yPosition -= 11
    })

    // Section total
    addLine(yPosition + 4, leftMargin, width - rightMargin)
    yPosition -= 10
    addText(totalLabel, leftMargin + 10, yPosition, 8, true)
    periods.forEach((period, idx) => {
      addText(
        formatCurrency(periodTotals[period.key]),
        getColX(idx + 1),
        yPosition,
        8,
        true,
        'right'
      )
    })
    addText(
      formatCurrency(grandTotal),
      getColX(columnCount - 1),
      yPosition,
      8,
      true,
      'right'
    )
    yPosition -= 16
  }

  // Helper to render a summary row (like Gross Profit, Net Income)
  const renderSummaryRow = (
    label: string,
    periodTotals: Record<string, number>,
    grandTotal: number,
    highlight: boolean = false
  ) => {
    if (highlight) {
      addLine(yPosition + 4)
      yPosition -= 2
      addLine(yPosition + 4)
    }
    yPosition -= 10
    addText(label, leftMargin, yPosition, 9, true)
    periods.forEach((period, idx) => {
      const amount = periodTotals[period.key]
      const text = formatCurrency(amount)
      if (highlight) {
        addColoredText(
          text,
          getColX(idx + 1),
          yPosition,
          9,
          true,
          'right',
          amount >= 0
        )
      } else {
        addText(text, getColX(idx + 1), yPosition, 9, true, 'right')
      }
    })
    const totalText = formatCurrency(grandTotal)
    if (highlight) {
      addColoredText(
        totalText,
        getColX(columnCount - 1),
        yPosition,
        9,
        true,
        'right',
        grandTotal >= 0
      )
    } else {
      addText(totalText, getColX(columnCount - 1), yPosition, 9, true, 'right')
    }
    yPosition -= 16
  }

  // Render sections
  renderSection(
    'Revenue',
    columnarData.revenue,
    'Total Revenue',
    columnarData.periodTotals.totalRevenue,
    columnarData.grandTotals.totalRevenue
  )

  if (columnarData.costOfGoodsSold.length > 0) {
    renderSection(
      'Cost of Goods Sold',
      columnarData.costOfGoodsSold,
      'Total COGS',
      columnarData.periodTotals.totalCOGS,
      columnarData.grandTotals.totalCOGS
    )
  }

  renderSummaryRow(
    'Gross Profit',
    columnarData.periodTotals.grossProfit,
    columnarData.grandTotals.grossProfit,
    true
  )

  renderSection(
    'Operating Expenses',
    columnarData.operatingExpenses,
    'Total Operating Expenses',
    columnarData.periodTotals.totalOperatingExpenses,
    columnarData.grandTotals.totalOperatingExpenses
  )

  renderSummaryRow(
    'Operating Income',
    columnarData.periodTotals.operatingIncome,
    columnarData.grandTotals.operatingIncome,
    true
  )

  if (columnarData.otherIncome.length > 0) {
    renderSection(
      'Other Income',
      columnarData.otherIncome,
      'Total Other Income',
      columnarData.periodTotals.totalOtherIncome,
      columnarData.grandTotals.totalOtherIncome
    )
  }

  if (columnarData.otherExpenses.length > 0) {
    renderSection(
      'Other Expenses',
      columnarData.otherExpenses,
      'Total Other Expenses',
      columnarData.periodTotals.totalOtherExpenses,
      columnarData.grandTotals.totalOtherExpenses
    )
  }

  renderSummaryRow(
    'NET INCOME',
    columnarData.periodTotals.netIncome,
    columnarData.grandTotals.netIncome,
    true
  )

  // Footer
  const footerY = 30
  addLine(footerY + 15, leftMargin, width - rightMargin)

  const now = new Date()
  const currentDate = now.toISOString().split('T')[0]
  const currentTime = now.toLocaleTimeString('en-US', {
    timeZone: 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  addText(
    `Generated on ${formatDateForPDF(currentDate)} at ${currentTime} UTC`,
    leftMargin,
    footerY,
    8
  )
  addText(
    'SlimBooks Financial Management System',
    width - rightMargin,
    footerY,
    8,
    false,
    'right'
  )

  return await pdfDoc.save()
}

export async function downloadPDF(pdfBytes: Uint8Array, filename: string) {
  // Ensure Blob receives an ArrayBuffer (not ArrayBufferLike) with the exact view slice
  const arrayBuffer: ArrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
