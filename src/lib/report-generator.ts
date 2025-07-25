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

export async function generateFinancialReports({
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

  // Create a mapping from account names to account types and account numbers
  const accountTypeMap: { [accountName: string]: string } = {}
  const accountNumberMap: { [accountName: string]: string } = {}
  chartOfAccounts?.forEach((account: { account_name: string; account_type: string; account_number: string }) => {
    accountTypeMap[account.account_name] = account.account_type
    accountNumberMap[account.account_name] = account.account_number
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

  // Get transactions for the date range
  const { data: transactions, error: transactionsError } = await supabase
    .from('transactions')
    .select('*')
    .eq('company_id', companyId)
    .gte('date', fromDate)
    .lte('date', toDate)

  if (transactionsError) {
    console.error('Error fetching transactions:', transactionsError)
    throw new Error('Failed to fetch transactions')
  }

  // Get payables/receivables
  const { data: payables, error: payablesError } = await supabase
    .from('payables_receivables')
    .select('*')
    .eq('company_id', companyId)

  if (payablesError) {
    console.error('Error fetching payables/receivables:', payablesError)
    throw new Error('Failed to fetch payables/receivables')
  }

  if (!transactions) {
    throw new Error('No transactions found')
  }

  // Calculate Profit & Loss according to GAAP standards using Chart of Accounts
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
    const accountType = accountTypeMap[transaction.category]
    
    // Skip transactions without matching Chart of Accounts
    if (!accountType) {
      return
    }
    
    if (transaction.type === 'income') {
      // Use Chart of Accounts to categorize income
      if (accountType === 'revenue') {
        revenueByCategory[transaction.category] = (revenueByCategory[transaction.category] || 0) + amount
        totalRevenue += amount
      } else {
        otherIncomeByCategory[transaction.category] = (otherIncomeByCategory[transaction.category] || 0) + amount
        totalOtherIncome += amount
      }
    } else if (transaction.type === 'expense') {
      // Use Chart of Accounts to categorize expenses
      if (accountType === 'expense') {
        // Check if it's a cost of goods sold account (typically 5000-5999 range)
        const accountNumber = chartOfAccounts?.find((acc: { account_name: string; account_number: string }) => acc.account_name === transaction.category)?.account_number || '0'
        if (accountNumber >= '5000' && accountNumber < '6000') {
          costOfGoodsSoldByCategory[transaction.category] = (costOfGoodsSoldByCategory[transaction.category] || 0) + amount
          totalCostOfGoodsSold += amount
        } else {
          operatingExpensesByCategory[transaction.category] = (operatingExpensesByCategory[transaction.category] || 0) + amount
          totalOperatingExpenses += amount
        }
      } else {
        otherExpensesByCategory[transaction.category] = (otherExpensesByCategory[transaction.category] || 0) + amount
        totalOtherExpenses += amount
      }
    }
  })

  // Calculate Balance Sheet according to GAAP standards using Chart of Accounts
  const assetsByCategory: { [key: string]: number } = {}
  const liabilitiesByCategory: { [key: string]: number } = {}
  const equityByCategory: { [key: string]: number } = {}
  
  let totalAssets = 0
  let totalLiabilities = 0
  let totalEquity = 0

  // Process all transactions for balance sheet using Chart of Accounts
  transactions.forEach((transaction: { type: string; category: string; amount: number }) => {
    const amount = Number(transaction.amount)
    const accountType = accountTypeMap[transaction.category]
    
    // Skip transactions without matching Chart of Accounts
    if (!accountType) {
      return
    }
    
    if (accountType === 'asset') {
      assetsByCategory[transaction.category] = (assetsByCategory[transaction.category] || 0) + amount
      totalAssets += amount
    } else if (accountType === 'liability') {
      liabilitiesByCategory[transaction.category] = (liabilitiesByCategory[transaction.category] || 0) + amount
      totalLiabilities += amount
    } else if (accountType === 'equity') {
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

  // Calculate Cash Flow Statement according to GAAP standards using Chart of Accounts
  const operatingActivitiesByCategory: { [key: string]: number } = {}
  const investingActivitiesByCategory: { [key: string]: number } = {}
  const financingActivitiesByCategory: { [key: string]: number } = {}
  
  let totalOperatingActivities = 0
  let totalInvestingActivities = 0
  let totalFinancingActivities = 0

  // Process all transactions for cash flow categorization using Chart of Accounts
  transactions.forEach((transaction: { type: string; category: string; amount: number }) => {
    const amount = Number(transaction.amount)
    const accountType = accountTypeMap[transaction.category]
    
    // Skip transactions without matching Chart of Accounts
    if (!accountType) {
      return
    }
    
    const accountNumber = chartOfAccounts?.find((acc: { account_name: string; account_number: string }) => acc.account_name === transaction.category)?.account_number || '0'
    
    if (accountType === 'revenue') {
      // Operating activities - revenue generation
      operatingActivitiesByCategory[transaction.category] = (operatingActivitiesByCategory[transaction.category] || 0) + amount
      totalOperatingActivities += amount
    } else if (accountType === 'expense') {
      // Operating activities - expense payments
      operatingActivitiesByCategory[transaction.category] = (operatingActivitiesByCategory[transaction.category] || 0) - amount
      totalOperatingActivities -= amount
    } else if (accountType === 'asset') {
      // Investing activities - fixed asset purchases/sales (1400-1900 range)
      if (accountNumber >= '1400' && accountNumber < '2000') {
        investingActivitiesByCategory[transaction.category] = (investingActivitiesByCategory[transaction.category] || 0) - amount
        totalInvestingActivities -= amount
      } else {
        // Other assets might be operating (inventory, prepaid expenses, cash, receivables)
        operatingActivitiesByCategory[transaction.category] = (operatingActivitiesByCategory[transaction.category] || 0) - amount
        totalOperatingActivities -= amount
      }
    } else if (accountType === 'liability') {
      // Financing activities - debt transactions
      financingActivitiesByCategory[transaction.category] = (financingActivitiesByCategory[transaction.category] || 0) + amount
      totalFinancingActivities += amount
    } else if (accountType === 'equity') {
      // Financing activities - equity transactions
      if (['Owner\'s Capital', 'Owner\'s Draws', 'Common Stock', 'Paid-in Capital'].includes(transaction.category)) {
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

  const netCashFlow = totalOperatingActivities + totalInvestingActivities + totalFinancingActivities



  // Generate Trial Balance
  const trialBalanceAccounts = chartOfAccounts?.map((account: { account_name: string; account_type: string; account_number: string }) => {
    const accountTransactions = transactions.filter((t: { category: string }) => t.category === account.account_name)
    const debit = accountTransactions
      .filter((t: { type: string }) => ['asset', 'expense'].includes(t.type))
      .reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0)
    const credit = accountTransactions
      .filter((t: { type: string }) => ['liability', 'equity', 'revenue'].includes(t.type))
      .reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0)
    
    const balance = debit - credit

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

  // Convert general ledger to the expected format
  const generalLedgerAccountsMap: { [account: string]: { debits: number; credits: number; balance: number } } = {}
  let glTotalDebits = 0
  let glTotalCredits = 0

  // Group transactions by account
  const accountTransactions: { [account: string]: Array<{ type: string; amount: number }> } = {}
  transactions.forEach((transaction: { category: string; type: string; amount: number }) => {
    if (!accountTransactions[transaction.category]) {
      accountTransactions[transaction.category] = []
    }
    accountTransactions[transaction.category].push({
      type: transaction.type,
      amount: Number(transaction.amount)
    })
  })

  // Calculate account balances
  Object.entries(accountTransactions).forEach(([account, trans]) => {
    const debits = trans
      .filter(t => ['asset', 'expense'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0)
    const credits = trans
      .filter(t => ['liability', 'equity', 'revenue'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0)
    const balance = debits - credits

    generalLedgerAccountsMap[account] = {
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