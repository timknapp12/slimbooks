import { SupabaseClient } from '@supabase/supabase-js'



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



export interface GenerateReportsParams {
  supabase: SupabaseClient
  companyId: string
  fromDate: string
  toDate: string
}



export async function generateFinancialReportsDoubleEntry({
  supabase,
  companyId,
  fromDate,
  toDate
}: GenerateReportsParams): Promise<ReportData> {
  // Get Chart of Accounts for the current company
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
  const accountIdMap: { [accountName: string]: string } = {}
  
  chartOfAccounts?.forEach((account: { id: string; account_name: string; account_type: string; account_number: string }) => {
    accountTypeMap[account.account_name] = account.account_type
    accountNumberMap[account.account_name] = account.account_number
    accountIdMap[account.account_name] = account.id
  })

  // Helper function to convert category objects to ordered arrays
  const convertToOrderedArray = (categoryObject: { [key: string]: number }): Array<{ accountNumber: string; accountName: string; amount: number }> => {
    return Object.entries(categoryObject)
      .map(([accountName, amount]) => ({
        accountNumber: accountNumberMap[accountName] || '9999',
        accountName,
        amount
      }))
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
  }

  // Get journal entries for the PERIOD (Profit & Loss) - only transactions within date range
  const { data: periodJournalEntries, error: periodJournalError } = await supabase
    .from('journal_entries')
    .select(`
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
    `)
    .eq('company_id', companyId)
    .gte('date', fromDate)
    .lte('date', toDate)
    .eq('is_reversed', false)
    .order('date')

  if (periodJournalError) {
    console.error('Error fetching period journal entries:', periodJournalError)
    throw new Error('Failed to fetch period journal entries')
  }

  // Get journal entries for BALANCE SHEET - all transactions up to the end date (cumulative)
  const { data: balanceSheetJournalEntries, error: balanceSheetJournalError } = await supabase
    .from('journal_entries')
    .select(`
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
    `)
    .eq('company_id', companyId)
    .lte('date', toDate)
    .eq('is_reversed', false)
    .order('date')

  if (balanceSheetJournalError) {
    console.error('Error fetching balance sheet journal entries:', balanceSheetJournalError)
    throw new Error('Failed to fetch balance sheet journal entries')
  }

  // Get payables/receivables for balance sheet
  const { data: payables, error: payablesError } = await supabase
    .from('payables_receivables')
    .select('*')
    .eq('company_id', companyId)

  if (payablesError) {
    console.error('Error fetching payables/receivables:', payablesError)
    throw new Error('Failed to fetch payables/receivables')
  }

  if (!periodJournalEntries || !balanceSheetJournalEntries) {
    throw new Error('No journal entries found')
  }

  // Calculate PERIOD activity for Profit & Loss (only transactions within date range)
  const periodActivity: { [accountName: string]: number } = {}
  const periodDebits: { [accountName: string]: number } = {}
  const periodCredits: { [accountName: string]: number } = {}

  // Process period journal entries for P&L
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  periodJournalEntries.forEach((journalEntry: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    journalEntry.transaction_entries.forEach((entry: any) => {
      const accountName = entry.chart_of_accounts.account_name
      const accountType = entry.chart_of_accounts.account_type
      const debitAmount = Number(entry.debit_amount) || 0
      const creditAmount = Number(entry.credit_amount) || 0

      // Initialize account tracking
      if (!periodActivity[accountName]) {
        periodActivity[accountName] = 0
        periodDebits[accountName] = 0
        periodCredits[accountName] = 0
      }

      // Accumulate period activity
      periodDebits[accountName] += debitAmount
      periodCredits[accountName] += creditAmount

      // For P&L, we want the net effect of the period
      if (accountType === 'revenue') {
        // Revenue: Credit increases revenue (positive)
        periodActivity[accountName] += creditAmount - debitAmount
      } else if (accountType === 'expense') {
        // Expense: Debit increases expense (positive)
        periodActivity[accountName] += debitAmount - creditAmount
      }
    })
  })

  // Calculate BALANCE SHEET balances (cumulative up to end date)
  const balanceSheetBalances: { [accountName: string]: number } = {}
  const balanceSheetDebits: { [accountName: string]: number } = {}
  const balanceSheetCredits: { [accountName: string]: number } = {}

  // Process balance sheet journal entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  balanceSheetJournalEntries.forEach((journalEntry: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    journalEntry.transaction_entries.forEach((entry: any) => {
      const accountName = entry.chart_of_accounts.account_name
      const accountType = entry.chart_of_accounts.account_type
      const debitAmount = Number(entry.debit_amount) || 0
      const creditAmount = Number(entry.credit_amount) || 0

      // Initialize account tracking
      if (!balanceSheetBalances[accountName]) {
        balanceSheetBalances[accountName] = 0
        balanceSheetDebits[accountName] = 0
        balanceSheetCredits[accountName] = 0
      }

      // Accumulate debits and credits
      balanceSheetDebits[accountName] += debitAmount
      balanceSheetCredits[accountName] += creditAmount

      // Calculate balance based on account type
      if (accountType === 'asset' || accountType === 'expense') {
        // Assets and expenses: Debit increases, Credit decreases
        balanceSheetBalances[accountName] += debitAmount - creditAmount
      } else {
        // Liabilities, equity, and revenue: Credit increases, Debit decreases
        balanceSheetBalances[accountName] += creditAmount - debitAmount
      }
    })
  })

  // Calculate Profit & Loss according to GAAP standards (using PERIOD activity)
  const revenueByCategory: { [key: string]: number } = {}
  const costOfGoodsSoldByCategory: { [key: string]: number } = {}
  const operatingExpensesByCategory: { [key: string]: number } = {}
  const otherIncomeByCategory: { [key: string]: number } = {}
  const otherExpensesByCategory: { [key: string]: number } = {}
  
  let totalRevenue = 0
  let totalCostOfGoodsSold = 0
  let totalOperatingExpenses = 0
  const totalOtherIncome = 0
  const totalOtherExpenses = 0

  // Process revenue and expense accounts from PERIOD activity
  Object.entries(periodActivity).forEach(([accountName, activity]) => {
    const accountType = accountTypeMap[accountName]
    const accountNumber = accountNumberMap[accountName]
    
    if (accountType === 'revenue' && activity > 0) {
      revenueByCategory[accountName] = activity
      totalRevenue += activity
    } else if (accountType === 'expense' && activity > 0) {
      // Check if it's a cost of goods sold account (typically 5000-5999 range)
      if (accountNumber >= '5000' && accountNumber < '6000') {
        costOfGoodsSoldByCategory[accountName] = activity
        totalCostOfGoodsSold += activity
      } else {
        operatingExpensesByCategory[accountName] = activity
        totalOperatingExpenses += activity
      }
    }
  })

  // Calculate Balance Sheet according to GAAP standards (using CUMULATIVE balances)
  const assetsByCategory: { [key: string]: number } = {}
  const liabilitiesByCategory: { [key: string]: number } = {}
  const equityByCategory: { [key: string]: number } = {}
  
  let totalAssets = 0
  let totalLiabilities = 0
  let totalEquity = 0

  // Process balance sheet accounts from CUMULATIVE balances
  Object.entries(balanceSheetBalances).forEach(([accountName, balance]) => {
    const accountType = accountTypeMap[accountName]
    
    if (accountType === 'asset' && balance > 0) {
      assetsByCategory[accountName] = balance
      totalAssets += balance
    } else if (accountType === 'liability' && balance > 0) {
      liabilitiesByCategory[accountName] = balance
      totalLiabilities += balance
    } else if (accountType === 'equity' && balance > 0) {
      equityByCategory[accountName] = balance
      totalEquity += balance
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
  
  // Add net income to retained earnings in equity (cumulative)
  if (netIncome !== 0) {
    equityByCategory['Retained Earnings'] = (equityByCategory['Retained Earnings'] || 0) + netIncome
    totalEquity += netIncome
  }

  // Calculate Cash Flow Statement according to GAAP standards
  // Start with net income and adjust for non-cash items and changes in working capital
  const operatingActivitiesByCategory: { [key: string]: number } = {}
  const investingActivitiesByCategory: { [key: string]: number } = {}
  const financingActivitiesByCategory: { [key: string]: number } = {}
  
  let totalOperatingActivities = netIncome // Start with net income
  let totalInvestingActivities = 0
  let totalFinancingActivities = 0

  // Add net income as starting point for operating activities
  if (netIncome !== 0) {
    operatingActivitiesByCategory['Net Income'] = netIncome
  }

  // Calculate changes in working capital accounts (current period vs previous period)
  // For simplicity, we'll use the period activity for cash flow
  Object.entries(periodActivity).forEach(([accountName, activity]) => {
    const accountType = accountTypeMap[accountName]
    const accountNumber = accountNumberMap[accountName]
    
    if (accountType === 'asset') {
      // Changes in current assets (excluding cash)
      if (accountName !== 'Cash' && accountNumber >= '1000' && accountNumber < '2000') {
        operatingActivitiesByCategory[`Change in ${accountName}`] = -activity
        totalOperatingActivities -= activity
      } else if (accountNumber >= '1400' && accountNumber < '2000') {
        // Fixed assets - investing activities
        investingActivitiesByCategory[accountName] = -activity
        totalInvestingActivities -= activity
      }
    } else if (accountType === 'liability') {
      // Changes in current liabilities
      if (accountNumber >= '2000' && accountNumber < '3000') {
        operatingActivitiesByCategory[`Change in ${accountName}`] = activity
        totalOperatingActivities += activity
      } else {
        // Long-term liabilities - financing activities
        financingActivitiesByCategory[accountName] = activity
        totalFinancingActivities += activity
      }
    } else if (accountType === 'equity') {
      // Equity transactions - financing activities
      if (['Owner\'s Capital', 'Owner\'s Draws', 'Common Stock', 'Paid-in Capital'].includes(accountName)) {
        financingActivitiesByCategory[accountName] = activity
        totalFinancingActivities += activity
      }
    }
  })

  const netCashFlow = totalOperatingActivities + totalInvestingActivities + totalFinancingActivities

  // Generate Trial Balance (using balance sheet balances)
  const trialBalanceAccounts = chartOfAccounts?.map((account: { account_name: string; account_type: string; account_number: string }) => {
    const debit = balanceSheetDebits[account.account_name] || 0
    const credit = balanceSheetCredits[account.account_name] || 0
    const balance = balanceSheetBalances[account.account_name] || 0

    return {
      accountName: account.account_name,
      accountType: account.account_type,
      debit,
      credit,
      balance
    }
  }) || []

  // Convert trial balance to the expected format
  const trialBalanceAccountsMap: { [account: string]: { debits: number; credits: number; balance: number } } = {}
  let totalDebits = 0
  let totalCredits = 0

  trialBalanceAccounts.forEach(account => {
    trialBalanceAccountsMap[account.accountName] = {
      debits: account.debit,
      credits: account.credit,
      balance: account.balance
    }
    totalDebits += account.debit
    totalCredits += account.credit
  })

  // Generate General Ledger (using balance sheet data)
  const generalLedgerAccountsMap: { [account: string]: { debits: number; credits: number; balance: number } } = {}
  let glTotalDebits = 0
  let glTotalCredits = 0

  // Use the balance sheet data for general ledger
  Object.entries(balanceSheetBalances).forEach(([accountName, balance]) => {
    const debits = balanceSheetDebits[accountName] || 0
    const credits = balanceSheetCredits[accountName] || 0

    generalLedgerAccountsMap[accountName] = {
      debits,
      credits,
      balance
    }
    glTotalDebits += debits
    glTotalCredits += credits
  })

  return {
    profitLoss: {
      revenue: convertToOrderedArray(revenueByCategory),
      costOfGoodsSold: convertToOrderedArray(costOfGoodsSoldByCategory),
      operatingExpenses: convertToOrderedArray(operatingExpensesByCategory),
      otherIncome: convertToOrderedArray(otherIncomeByCategory),
      otherExpenses: convertToOrderedArray(otherExpensesByCategory),
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
      assets: convertToOrderedArray(assetsByCategory),
      liabilities: convertToOrderedArray(liabilitiesByCategory),
      equity: convertToOrderedArray(equityByCategory),
      totalAssets,
      totalLiabilities,
      totalEquity
    },
    cashFlow: {
      operatingActivities: convertToOrderedArray(operatingActivitiesByCategory),
      investingActivities: convertToOrderedArray(investingActivitiesByCategory),
      financingActivities: convertToOrderedArray(financingActivitiesByCategory),
      totalOperatingActivities,
      totalInvestingActivities,
      totalFinancingActivities,
      netCashFlow
    },
    generalLedger: {
      accounts: Object.entries(generalLedgerAccountsMap)
        .map(([accountName, data]) => ({
          accountNumber: accountNumberMap[accountName] || '9999',
          accountName,
          ...data
        }))
        .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)),
      totalDebits: glTotalDebits,
      totalCredits: glTotalCredits
    },
    trialBalance: {
      accounts: Object.entries(trialBalanceAccountsMap)
        .map(([accountName, data]) => ({
          accountNumber: accountNumberMap[accountName] || '9999',
          accountName,
          ...data
        }))
        .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)),
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01
    }
  }
} 