/**
 * GAAP Compliance Validator
 * 
 * This module provides functions to validate that financial reports follow
 * Generally Accepted Accounting Principles (GAAP) and maintain proper
 * double-entry bookkeeping standards.
 */

import { ReportData } from './report-generator'

export interface GaapValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface ValidationResults {
  fundamentalEquation: GaapValidationResult
  trialBalance: GaapValidationResult
  profitLoss: GaapValidationResult
  balanceSheet: GaapValidationResult
  cashFlow: GaapValidationResult
  generalLedger: GaapValidationResult
  accountClassification: GaapValidationResult
  statementRelationships: GaapValidationResult
  presentation: GaapValidationResult
  mathematicalAccuracy: GaapValidationResult
  dataIntegrity: GaapValidationResult
  overall: GaapValidationResult
}

/**
 * Validates the fundamental accounting equation: Assets = Liabilities + Equity
 */
export function validateFundamentalEquation(reportData: ReportData): GaapValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const tolerance = 0.01

  const { balanceSheet, trialBalance } = reportData
  
  // Check Assets = Liabilities + Equity
  const difference = Math.abs(balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity))
  if (difference > tolerance) {
    errors.push(`Fundamental accounting equation not balanced. Assets: $${balanceSheet.totalAssets.toFixed(2)}, Liabilities + Equity: $${(balanceSheet.totalLiabilities + balanceSheet.totalEquity).toFixed(2)}, Difference: $${difference.toFixed(2)}`)
  }

  // Check trial balance
  const trialDifference = Math.abs(trialBalance.totalDebits - trialBalance.totalCredits)
  if (trialDifference > tolerance) {
    errors.push(`Trial balance not balanced. Debits: $${trialBalance.totalDebits.toFixed(2)}, Credits: $${trialBalance.totalCredits.toFixed(2)}, Difference: $${trialDifference.toFixed(2)}`)
  }

  if (balanceSheet.totalAssets <= 0) {
    errors.push('Total assets must be positive')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates Profit & Loss Statement GAAP compliance
 */
export function validateProfitLoss(reportData: ReportData): GaapValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { profitLoss } = reportData

  // Validate revenue categorization
  if (profitLoss.totalRevenue < 0) {
    errors.push('Total revenue cannot be negative')
  }

  profitLoss.revenue.forEach(account => {
    if (!account.accountNumber.match(/^4\d{3}$/)) {
      errors.push(`Revenue account ${account.accountName} has invalid account number ${account.accountNumber}. Should be in 4000-4999 range.`)
    }
    if (account.amount <= 0) {
      warnings.push(`Revenue account ${account.accountName} has non-positive amount: $${account.amount}`)
    }
  })

  // Validate COGS categorization
  if (profitLoss.totalCostOfGoodsSold < 0) {
    errors.push('Total Cost of Goods Sold cannot be negative')
  }

  profitLoss.costOfGoodsSold.forEach(account => {
    if (!account.accountNumber.match(/^5\d{3}$/)) {
      errors.push(`COGS account ${account.accountName} has invalid account number ${account.accountNumber}. Should be in 5000-5999 range.`)
    }
  })

  // Validate calculations
  const expectedGrossProfit = profitLoss.totalRevenue - profitLoss.totalCostOfGoodsSold
  if (Math.abs(profitLoss.grossProfit - expectedGrossProfit) > 0.01) {
    errors.push(`Gross profit calculation error. Expected: $${expectedGrossProfit.toFixed(2)}, Actual: $${profitLoss.grossProfit.toFixed(2)}`)
  }

  const expectedOperatingIncome = profitLoss.grossProfit - profitLoss.totalOperatingExpenses
  if (Math.abs(profitLoss.operatingIncome - expectedOperatingIncome) > 0.01) {
    errors.push(`Operating income calculation error. Expected: $${expectedOperatingIncome.toFixed(2)}, Actual: $${profitLoss.operatingIncome.toFixed(2)}`)
  }

  const expectedNetIncome = profitLoss.operatingIncome + profitLoss.totalOtherIncome - profitLoss.totalOtherExpenses
  if (Math.abs(profitLoss.netIncome - expectedNetIncome) > 0.01) {
    errors.push(`Net income calculation error. Expected: $${expectedNetIncome.toFixed(2)}, Actual: $${profitLoss.netIncome.toFixed(2)}`)
  }

  // Validate operating expenses
  profitLoss.operatingExpenses.forEach(account => {
    const accountNumber = parseInt(account.accountNumber)
    if (accountNumber < 6000) {
      warnings.push(`Operating expense account ${account.accountName} (${account.accountNumber}) should typically be in 6000+ range`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates Balance Sheet GAAP compliance
 */
export function validateBalanceSheet(reportData: ReportData): GaapValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { balanceSheet } = reportData

  // Validate asset categorization and ordering
  let previousAccountNumber = '0000'
  balanceSheet.assets.forEach(account => {
    if (!account.accountNumber.match(/^1\d{3}$/)) {
      errors.push(`Asset account ${account.accountName} has invalid account number ${account.accountNumber}. Should be in 1000-1999 range.`)
    }
    
    if (account.accountNumber < previousAccountNumber) {
      errors.push(`Assets not properly ordered by account number. ${account.accountName} (${account.accountNumber}) comes after ${previousAccountNumber}`)
    }
    previousAccountNumber = account.accountNumber

    // Check for proper asset balances (should be positive except for contra accounts)
    if (account.amount < 0 && !account.accountName.toLowerCase().includes('accumulated')) {
      warnings.push(`Asset account ${account.accountName} has negative balance: $${account.amount}`)
    }
  })

  // Validate liability categorization and ordering
  previousAccountNumber = '0000'
  balanceSheet.liabilities.forEach(account => {
    if (!account.accountNumber.match(/^2\d{3}$/)) {
      errors.push(`Liability account ${account.accountName} has invalid account number ${account.accountNumber}. Should be in 2000-2999 range.`)
    }
    
    if (account.accountNumber < previousAccountNumber) {
      errors.push(`Liabilities not properly ordered by account number. ${account.accountName} (${account.accountNumber}) comes after ${previousAccountNumber}`)
    }
    previousAccountNumber = account.accountNumber

    if (account.amount <= 0) {
      warnings.push(`Liability account ${account.accountName} has non-positive amount: $${account.amount}`)
    }
  })

  // Validate equity categorization
  balanceSheet.equity.forEach(account => {
    if (!account.accountNumber.match(/^3\d{3}$/)) {
      errors.push(`Equity account ${account.accountName} has invalid account number ${account.accountNumber}. Should be in 3000-3999 range.`)
    }
  })

  // Check for retained earnings
  const retainedEarnings = balanceSheet.equity.find(account => account.accountName === 'Retained Earnings')
  if (!retainedEarnings) {
    warnings.push('Balance sheet should include Retained Earnings account')
  } else {
    // Retained earnings should match net income (for current period)
    const netIncome = reportData.profitLoss.netIncome
    if (Math.abs(retainedEarnings.amount - netIncome) > 0.01) {
      warnings.push(`Retained Earnings ($${retainedEarnings.amount.toFixed(2)}) should match Net Income ($${netIncome.toFixed(2)}) for current period`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates Cash Flow Statement GAAP compliance
 */
export function validateCashFlow(reportData: ReportData): GaapValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { cashFlow, profitLoss } = reportData

  // Check for net income in operating activities
  const netIncomeEntry = cashFlow.operatingActivities.find(activity => activity.accountName === 'Net Income')
  if (!netIncomeEntry) {
    warnings.push('Cash flow statement should start with Net Income in operating activities')
  } else {
    if (Math.abs(netIncomeEntry.amount - profitLoss.netIncome) > 0.01) {
      errors.push(`Net Income in cash flow ($${netIncomeEntry.amount.toFixed(2)}) does not match P&L Net Income ($${profitLoss.netIncome.toFixed(2)})`)
    }
  }

  // Validate net cash flow calculation
  const expectedNetCashFlow = cashFlow.totalOperatingActivities + cashFlow.totalInvestingActivities + cashFlow.totalFinancingActivities
  if (Math.abs(cashFlow.netCashFlow - expectedNetCashFlow) > 0.01) {
    errors.push(`Net cash flow calculation error. Expected: $${expectedNetCashFlow.toFixed(2)}, Actual: $${cashFlow.netCashFlow.toFixed(2)}`)
  }

  // Check for proper categorization
  cashFlow.investingActivities.forEach(activity => {
    // Fixed asset purchases should typically be negative (cash outflows)
    if (activity.accountName.toLowerCase().includes('equipment') && activity.amount > 0) {
      warnings.push(`Equipment purchase should typically be a cash outflow (negative amount): ${activity.accountName}`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates General Ledger double-entry compliance
 */
export function validateGeneralLedger(reportData: ReportData): GaapValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { generalLedger } = reportData

  // Check double-entry principle
  const tolerance = 0.01
  const difference = Math.abs(generalLedger.totalDebits - generalLedger.totalCredits)
  if (difference > tolerance) {
    errors.push(`General ledger not balanced. Total Debits: $${generalLedger.totalDebits.toFixed(2)}, Total Credits: $${generalLedger.totalCredits.toFixed(2)}, Difference: $${difference.toFixed(2)}`)
  }

  // Check account ordering
  let previousAccountNumber = '0000'
  generalLedger.accounts.forEach(account => {
    if (account.accountNumber < previousAccountNumber) {
      errors.push(`General ledger accounts not properly ordered. ${account.accountName} (${account.accountNumber}) comes after ${previousAccountNumber}`)
    }
    previousAccountNumber = account.accountNumber

    // Validate account balance calculation
    const expectedBalance = account.debits - account.credits
    if (Math.abs(account.balance - expectedBalance) > 0.01) {
      errors.push(`Account balance calculation error for ${account.accountName}. Expected: $${expectedBalance.toFixed(2)}, Actual: $${account.balance.toFixed(2)}`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates account classification according to GAAP
 */
export function validateAccountClassification(reportData: ReportData): GaapValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { trialBalance } = reportData

  trialBalance.accounts.forEach(account => {
    const accountNumber = parseInt(account.accountNumber)
    
    // Validate account number ranges
    if (accountNumber >= 1000 && accountNumber < 2000) {
      // Assets should typically have debit balances (positive)
      if (account.balance < 0 && !account.accountName.toLowerCase().includes('accumulated')) {
        warnings.push(`Asset account ${account.accountName} has credit balance: $${account.balance.toFixed(2)}`)
      }
    } else if (accountNumber >= 2000 && accountNumber < 3000) {
      // Liabilities should have credit balances (negative in our system)
      if (account.balance > 0) {
        warnings.push(`Liability account ${account.accountName} has debit balance: $${account.balance.toFixed(2)}`)
      }
    } else if (accountNumber >= 3000 && accountNumber < 4000) {
      // Equity accounts (except draws) should have credit balances
      if (account.balance > 0 && !account.accountName.toLowerCase().includes('draws')) {
        warnings.push(`Equity account ${account.accountName} has debit balance: $${account.balance.toFixed(2)}`)
      }
    } else if (accountNumber >= 4000 && accountNumber < 5000) {
      // Revenue should have credit balances (negative in our system)
      if (account.balance > 0) {
        warnings.push(`Revenue account ${account.accountName} has debit balance: $${account.balance.toFixed(2)}`)
      }
    } else if (accountNumber >= 5000) {
      // Expenses should have debit balances (positive)
      if (account.balance < 0) {
        warnings.push(`Expense account ${account.accountName} has credit balance: $${account.balance.toFixed(2)}`)
      }
    } else {
      errors.push(`Account ${account.accountName} has invalid account number: ${account.accountNumber}`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates relationships between financial statements
 */
export function validateStatementRelationships(reportData: ReportData): GaapValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { profitLoss, balanceSheet, cashFlow } = reportData

  // Net income should appear consistently across statements
  const retainedEarnings = balanceSheet.equity.find(account => account.accountName === 'Retained Earnings')
  if (retainedEarnings && Math.abs(retainedEarnings.amount - profitLoss.netIncome) > 0.01) {
    warnings.push(`Retained Earnings ($${retainedEarnings.amount.toFixed(2)}) should equal Net Income ($${profitLoss.netIncome.toFixed(2)}) for current period`)
  }

  const netIncomeInCashFlow = cashFlow.operatingActivities.find(activity => activity.accountName === 'Net Income')
  if (netIncomeInCashFlow && Math.abs(netIncomeInCashFlow.amount - profitLoss.netIncome) > 0.01) {
    errors.push(`Net Income in Cash Flow ($${netIncomeInCashFlow.amount.toFixed(2)}) does not match P&L Net Income ($${profitLoss.netIncome.toFixed(2)})`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates GAAP presentation requirements
 */
export function validatePresentation(reportData: ReportData): GaapValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { balanceSheet, trialBalance } = reportData

  // Check asset ordering (current assets before fixed assets)
  let foundFixedAsset = false
  balanceSheet.assets.forEach(asset => {
    const accountNumber = parseInt(asset.accountNumber)
    if (accountNumber >= 1400) {
      foundFixedAsset = true
    } else if (foundFixedAsset && accountNumber < 1400) {
      warnings.push('Current assets should be presented before fixed assets')
    }
  })

  // Check for required accounts
  const accountNames = trialBalance.accounts.map(account => account.accountName)
  const requiredAccounts = ['Cash', 'Accounts Receivable', 'Accounts Payable']
  
  requiredAccounts.forEach(requiredAccount => {
    if (!accountNames.includes(requiredAccount)) {
      warnings.push(`Missing standard account: ${requiredAccount}`)
    }
  })

  // Validate account names
  trialBalance.accounts.forEach(account => {
    if (!account.accountName || account.accountName.trim().length === 0) {
      errors.push('Account names cannot be empty')
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates mathematical accuracy and precision
 */
export function validateMathematicalAccuracy(reportData: ReportData): GaapValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const checkPrecision = (amount: number, description: string) => {
    if (isNaN(amount) || !isFinite(amount)) {
      errors.push(`${description} contains invalid number: ${amount}`)
      return
    }
    
    const rounded = Math.round(amount * 100) / 100
    if (Math.abs(amount - rounded) > 0.001) {
      warnings.push(`${description} has excessive precision: ${amount}. Should be rounded to 2 decimal places.`)
    }
  }

  // Check all monetary amounts
  const { profitLoss, balanceSheet, cashFlow } = reportData
  
  checkPrecision(profitLoss.totalRevenue, 'Total Revenue')
  checkPrecision(profitLoss.grossProfit, 'Gross Profit')
  checkPrecision(profitLoss.netIncome, 'Net Income')
  checkPrecision(balanceSheet.totalAssets, 'Total Assets')
  checkPrecision(balanceSheet.totalLiabilities, 'Total Liabilities')
  checkPrecision(balanceSheet.totalEquity, 'Total Equity')
  checkPrecision(cashFlow.netCashFlow, 'Net Cash Flow')

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates data integrity across reports
 */
export function validateDataIntegrity(reportData: ReportData): GaapValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { trialBalance, generalLedger } = reportData

  // Check for duplicate accounts
  const trialBalanceNames = trialBalance.accounts.map(account => account.accountName)
  const uniqueTrialBalanceNames = [...new Set(trialBalanceNames)]
  if (trialBalanceNames.length !== uniqueTrialBalanceNames.length) {
    errors.push('Duplicate accounts found in trial balance')
  }

  const generalLedgerNames = generalLedger.accounts.map(account => account.accountName)
  const uniqueGeneralLedgerNames = [...new Set(generalLedgerNames)]
  if (generalLedgerNames.length !== uniqueGeneralLedgerNames.length) {
    errors.push('Duplicate accounts found in general ledger')
  }

  // Check consistency between trial balance and general ledger
  trialBalance.accounts.forEach(trialAccount => {
    const generalAccount = generalLedger.accounts.find(account => 
      account.accountName === trialAccount.accountName
    )
    
    if (generalAccount) {
      if (generalAccount.accountNumber !== trialAccount.accountNumber) {
        errors.push(`Account number mismatch for ${trialAccount.accountName}: Trial Balance (${trialAccount.accountNumber}) vs General Ledger (${generalAccount.accountNumber})`)
      }
      
      if (Math.abs(generalAccount.balance - trialAccount.balance) > 0.01) {
        errors.push(`Balance mismatch for ${trialAccount.accountName}: Trial Balance ($${trialAccount.balance.toFixed(2)}) vs General Ledger ($${generalAccount.balance.toFixed(2)})`)
      }
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Performs comprehensive GAAP validation on financial reports
 */
export function validateGaapCompliance(reportData: ReportData): ValidationResults {
  const fundamentalEquation = validateFundamentalEquation(reportData)
  const trialBalance = validateGeneralLedger(reportData) // Using general ledger validation for trial balance
  const profitLoss = validateProfitLoss(reportData)
  const balanceSheet = validateBalanceSheet(reportData)
  const cashFlow = validateCashFlow(reportData)
  const generalLedger = validateGeneralLedger(reportData)
  const accountClassification = validateAccountClassification(reportData)
  const statementRelationships = validateStatementRelationships(reportData)
  const presentation = validatePresentation(reportData)
  const mathematicalAccuracy = validateMathematicalAccuracy(reportData)
  const dataIntegrity = validateDataIntegrity(reportData)

  // Compile overall results
  const allValidations = [
    fundamentalEquation,
    trialBalance,
    profitLoss,
    balanceSheet,
    cashFlow,
    generalLedger,
    accountClassification,
    statementRelationships,
    presentation,
    mathematicalAccuracy,
    dataIntegrity
  ]

  const allErrors = allValidations.flatMap(v => v.errors)
  const allWarnings = allValidations.flatMap(v => v.warnings)

  const overall: GaapValidationResult = {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  }

  return {
    fundamentalEquation,
    trialBalance,
    profitLoss,
    balanceSheet,
    cashFlow,
    generalLedger,
    accountClassification,
    statementRelationships,
    presentation,
    mathematicalAccuracy,
    dataIntegrity,
    overall
  }
}

/**
 * Generates a human-readable GAAP compliance report
 */
export function generateComplianceReport(validationResults: ValidationResults): string {
  const { overall } = validationResults
  
  let report = '# GAAP Compliance Report\n\n'
  
  if (overall.isValid) {
    report += '✅ **PASSED**: All financial reports are GAAP compliant.\n\n'
  } else {
    report += '❌ **FAILED**: Financial reports have GAAP compliance issues.\n\n'
  }
  
  report += `## Summary\n`
  report += `- Total Errors: ${overall.errors.length}\n`
  report += `- Total Warnings: ${overall.warnings.length}\n\n`
  
  if (overall.errors.length > 0) {
    report += '## Critical Errors\n'
    overall.errors.forEach((error, index) => {
      report += `${index + 1}. ${error}\n`
    })
    report += '\n'
  }
  
  if (overall.warnings.length > 0) {
    report += '## Warnings\n'
    overall.warnings.forEach((warning, index) => {
      report += `${index + 1}. ${warning}\n`
    })
    report += '\n'
  }
  
  // Detailed section results
  report += '## Detailed Results\n\n'
  
  const sections = [
    { name: 'Fundamental Accounting Equation', result: validationResults.fundamentalEquation },
    { name: 'Trial Balance', result: validationResults.trialBalance },
    { name: 'Profit & Loss Statement', result: validationResults.profitLoss },
    { name: 'Balance Sheet', result: validationResults.balanceSheet },
    { name: 'Cash Flow Statement', result: validationResults.cashFlow },
    { name: 'General Ledger', result: validationResults.generalLedger },
    { name: 'Account Classification', result: validationResults.accountClassification },
    { name: 'Statement Relationships', result: validationResults.statementRelationships },
    { name: 'Presentation Requirements', result: validationResults.presentation },
    { name: 'Mathematical Accuracy', result: validationResults.mathematicalAccuracy },
    { name: 'Data Integrity', result: validationResults.dataIntegrity }
  ]
  
  sections.forEach(section => {
    const status = section.result.isValid ? '✅ PASS' : '❌ FAIL'
    report += `### ${section.name}: ${status}\n`
    
    if (section.result.errors.length > 0) {
      report += 'Errors:\n'
      section.result.errors.forEach(error => {
        report += `- ${error}\n`
      })
    }
    
    if (section.result.warnings.length > 0) {
      report += 'Warnings:\n'
      section.result.warnings.forEach(warning => {
        report += `- ${warning}\n`
      })
    }
    
    report += '\n'
  })
  
  return report
}