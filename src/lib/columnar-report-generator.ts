import { SupabaseClient } from '@supabase/supabase-js'
import {
  ColumnarProfitLoss,
  ColumnarLineItem,
  PeriodDefinition,
  ColumnDisplayMode,
} from '@/types/columnar-report'
import {
  generateMonthlyPeriods,
  generateQuarterlyPeriods,
  findPeriodForDate,
  initializePeriodAmounts,
} from './period-utils'
import { getFirstDayOfYear, getLastDayOfYear } from './date-utils'

export interface GenerateColumnarProfitLossParams {
  supabase: SupabaseClient
  companyId: string
  year: number
  columnMode: Exclude<ColumnDisplayMode, 'total'>
}

export async function generateColumnarProfitLoss({
  supabase,
  companyId,
  year,
  columnMode,
}: GenerateColumnarProfitLossParams): Promise<ColumnarProfitLoss> {
  // Generate periods based on mode
  const periods =
    columnMode === 'monthly'
      ? generateMonthlyPeriods(year)
      : generateQuarterlyPeriods(year)

  // Get date range for the full year
  const fromDate = getFirstDayOfYear(year)
  const toDate = getLastDayOfYear(year)

  // Get Chart of Accounts for the company
  const { data: chartOfAccounts, error: coaError } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('account_number')

  if (coaError) {
    console.error('Error fetching Chart of Accounts:', coaError)
    throw new Error('Failed to fetch Chart of Accounts')
  }

  // Create mappings for account information
  const accountTypeMap: { [accountName: string]: string } = {}
  const accountNumberMap: { [accountName: string]: string } = {}

  chartOfAccounts?.forEach(
    (account: {
      id: string
      account_name: string
      account_type: string
      account_number: string
    }) => {
      accountTypeMap[account.account_name] = account.account_type
      accountNumberMap[account.account_name] = account.account_number
    }
  )

  // Fetch ALL journal entries for the year in one query
  const { data: journalEntries, error: journalError } = await supabase
    .from('journal_entries')
    .select(
      `
      id,
      date,
      description,
      source,
      is_reversed,
      transaction_entries (
        id,
        debit_amount,
        credit_amount,
        description,
        chart_of_accounts (
          account_name,
          account_type,
          account_number
        )
      )
    `
    )
    .eq('company_id', companyId)
    .gte('date', fromDate)
    .lte('date', toDate)
    .eq('is_reversed', false)
    .order('date')

  if (journalError) {
    console.error('Error fetching journal entries:', journalError)
    throw new Error('Failed to fetch journal entries')
  }

  // Initialize data structures for bucketing by period
  // Map: accountName -> periodKey -> amount
  const periodActivity: { [accountName: string]: { [periodKey: string]: number } } = {}

  // Process journal entries and bucket by period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  journalEntries?.forEach((journalEntry: any) => {
    const entryDate = journalEntry.date
    const periodKey = findPeriodForDate(entryDate, periods)

    if (!periodKey) return // Date doesn't fall in any period (shouldn't happen)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    journalEntry.transaction_entries.forEach((entry: any) => {
      const accountName = entry.chart_of_accounts.account_name
      const accountType = entry.chart_of_accounts.account_type
      const debitAmount = Number(entry.debit_amount) || 0
      const creditAmount = Number(entry.credit_amount) || 0

      // Initialize account tracking if needed
      if (!periodActivity[accountName]) {
        periodActivity[accountName] = initializePeriodAmounts(periods)
      }

      // Calculate period activity based on account type
      if (accountType === 'revenue') {
        // Revenue: Credit increases revenue (positive)
        periodActivity[accountName][periodKey] += creditAmount - debitAmount
      } else if (accountType === 'expense') {
        // Expense: Debit increases expense (positive)
        periodActivity[accountName][periodKey] += debitAmount - creditAmount
      }
    })
  })

  // Categorize accounts and build columnar line items
  const revenueItems: ColumnarLineItem[] = []
  const cogsItems: ColumnarLineItem[] = []
  const operatingExpenseItems: ColumnarLineItem[] = []
  const otherIncomeItems: ColumnarLineItem[] = []
  const otherExpenseItems: ColumnarLineItem[] = []

  // Process each account with activity
  Object.entries(periodActivity).forEach(([accountName, periodAmounts]) => {
    const accountType = accountTypeMap[accountName]
    const accountNumber = accountNumberMap[accountName] || '9999'

    // Calculate total across all periods
    const total = Object.values(periodAmounts).reduce((sum, amt) => sum + amt, 0)

    // Skip accounts with no activity
    if (total === 0 && Object.values(periodAmounts).every(v => v === 0)) {
      return
    }

    const lineItem: ColumnarLineItem = {
      accountNumber,
      accountName,
      periodAmounts,
      total,
    }

    if (accountType === 'revenue') {
      if (total > 0 || Object.values(periodAmounts).some(v => v !== 0)) {
        revenueItems.push(lineItem)
      }
    } else if (accountType === 'expense') {
      // COGS: 5000-5999, Operating Expenses: 6000+
      if (accountNumber >= '5000' && accountNumber < '6000') {
        if (total > 0 || Object.values(periodAmounts).some(v => v !== 0)) {
          cogsItems.push(lineItem)
        }
      } else {
        if (total > 0 || Object.values(periodAmounts).some(v => v !== 0)) {
          operatingExpenseItems.push(lineItem)
        }
      }
    }
  })

  // Sort by account number
  const sortByAccountNumber = (a: ColumnarLineItem, b: ColumnarLineItem) =>
    a.accountNumber.localeCompare(b.accountNumber)

  revenueItems.sort(sortByAccountNumber)
  cogsItems.sort(sortByAccountNumber)
  operatingExpenseItems.sort(sortByAccountNumber)
  otherIncomeItems.sort(sortByAccountNumber)
  otherExpenseItems.sort(sortByAccountNumber)

  // Calculate period totals
  const sumPeriodAmounts = (items: ColumnarLineItem[]): Record<string, number> => {
    const totals: Record<string, number> = initializePeriodAmounts(periods)
    items.forEach(item => {
      Object.entries(item.periodAmounts).forEach(([key, value]) => {
        totals[key] += value
      })
    })
    return totals
  }

  const totalRevenuePeriods = sumPeriodAmounts(revenueItems)
  const totalCOGSPeriods = sumPeriodAmounts(cogsItems)
  const totalOperatingExpensesPeriods = sumPeriodAmounts(operatingExpenseItems)
  const totalOtherIncomePeriods = sumPeriodAmounts(otherIncomeItems)
  const totalOtherExpensesPeriods = sumPeriodAmounts(otherExpenseItems)

  // Calculate derived period totals
  const grossProfitPeriods: Record<string, number> = {}
  const operatingIncomePeriods: Record<string, number> = {}
  const netIncomePeriods: Record<string, number> = {}

  periods.forEach(period => {
    const key = period.key
    grossProfitPeriods[key] = totalRevenuePeriods[key] - totalCOGSPeriods[key]
    operatingIncomePeriods[key] = grossProfitPeriods[key] - totalOperatingExpensesPeriods[key]
    netIncomePeriods[key] =
      operatingIncomePeriods[key] + totalOtherIncomePeriods[key] - totalOtherExpensesPeriods[key]
  })

  // Calculate grand totals
  const sumGrandTotal = (items: ColumnarLineItem[]): number =>
    items.reduce((sum, item) => sum + item.total, 0)

  const totalRevenue = sumGrandTotal(revenueItems)
  const totalCOGS = sumGrandTotal(cogsItems)
  const totalOperatingExpenses = sumGrandTotal(operatingExpenseItems)
  const totalOtherIncome = sumGrandTotal(otherIncomeItems)
  const totalOtherExpenses = sumGrandTotal(otherExpenseItems)
  const grossProfit = totalRevenue - totalCOGS
  const operatingIncome = grossProfit - totalOperatingExpenses
  const netIncome = operatingIncome + totalOtherIncome - totalOtherExpenses

  return {
    periods,
    revenue: revenueItems,
    costOfGoodsSold: cogsItems,
    operatingExpenses: operatingExpenseItems,
    otherIncome: otherIncomeItems,
    otherExpenses: otherExpenseItems,
    periodTotals: {
      totalRevenue: totalRevenuePeriods,
      totalCOGS: totalCOGSPeriods,
      grossProfit: grossProfitPeriods,
      totalOperatingExpenses: totalOperatingExpensesPeriods,
      operatingIncome: operatingIncomePeriods,
      totalOtherIncome: totalOtherIncomePeriods,
      totalOtherExpenses: totalOtherExpensesPeriods,
      netIncome: netIncomePeriods,
    },
    grandTotals: {
      totalRevenue,
      totalCOGS,
      grossProfit,
      totalOperatingExpenses,
      operatingIncome,
      totalOtherIncome,
      totalOtherExpenses,
      netIncome,
    },
  }
}
