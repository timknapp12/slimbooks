// Smart categorization based on description keywords
export const autoCategorizeTranaction = (description: string, type: 'income' | 'expense' | 'asset' | 'liability' | 'equity'): string => {
  const desc = description.toLowerCase()
  
  if (type === 'income') {
    if (desc.includes('salary') || desc.includes('payroll') || desc.includes('wage')) return 'Service Revenue'
    if (desc.includes('interest') || desc.includes('dividend')) return 'Interest Income'
    if (desc.includes('refund') || desc.includes('return')) return 'Refunds'
    if (desc.includes('rent') || desc.includes('rental')) return 'Rental Income'
    if (desc.includes('consulting') || desc.includes('freelance')) return 'Consulting Income'
    return 'Other Income'
  } else if (type === 'expense') {
    if (desc.includes('office') || desc.includes('supplies') || desc.includes('stationery')) return 'Office Supplies'
    if (desc.includes('travel') || desc.includes('flight') || desc.includes('hotel') || desc.includes('uber') || desc.includes('taxi')) return 'Travel'
    if (desc.includes('restaurant') || desc.includes('food') || desc.includes('lunch') || desc.includes('dinner') || desc.includes('coffee')) return 'Meals & Entertainment'
    if (desc.includes('software') || desc.includes('subscription') || desc.includes('saas') || desc.includes('app')) return 'Software & Subscriptions'
    if (desc.includes('marketing') || desc.includes('advertising') || desc.includes('ads')) return 'Marketing'
    if (desc.includes('utility') || desc.includes('electric') || desc.includes('gas') || desc.includes('water') || desc.includes('internet')) return 'Utilities'
    if (desc.includes('rent') || desc.includes('lease')) return 'Rent'
    if (desc.includes('insurance')) return 'Insurance'
    if (desc.includes('legal') || desc.includes('lawyer') || desc.includes('attorney') || desc.includes('accounting')) return 'Legal & Accounting'
    if (desc.includes('bank') || desc.includes('fee') || desc.includes('charge')) return 'Bank Fees'
    if (desc.includes('equipment') || desc.includes('computer') || desc.includes('laptop') || desc.includes('hardware')) return 'Equipment'
    return 'Other Expenses'
  } else if (type === 'asset') {
    if (desc.includes('cash') || desc.includes('bank') || desc.includes('checking') || desc.includes('savings')) return 'Cash & Bank Accounts'
    if (desc.includes('receivable') || desc.includes('invoice') || desc.includes('customer')) return 'Accounts Receivable'
    if (desc.includes('inventory') || desc.includes('stock') || desc.includes('product')) return 'Inventory'
    if (desc.includes('prepaid') || desc.includes('advance')) return 'Prepaid Expenses'
    if (desc.includes('equipment') || desc.includes('furniture') || desc.includes('computer')) return 'Equipment & Furniture'
    if (desc.includes('vehicle') || desc.includes('car') || desc.includes('truck')) return 'Vehicles'
    return 'Other Assets'
  } else if (type === 'liability') {
    if (desc.includes('payable') || desc.includes('vendor') || desc.includes('supplier')) return 'Accounts Payable'
    if (desc.includes('credit') || desc.includes('card')) return 'Credit Cards'
    if (desc.includes('loan') || desc.includes('mortgage') || desc.includes('debt')) return 'Loans Payable'
    if (desc.includes('accrued') || desc.includes('unpaid') || desc.includes('owed')) return 'Accrued Expenses'
    if (desc.includes('tax') || desc.includes('irs') || desc.includes('withholding')) return 'Taxes Payable'
    return 'Other Liabilities'
  } else {
    // Equity type categorization (includes transfers)
    if (desc.includes('capital') || desc.includes('investment') || desc.includes('contribution')) return 'Owner\'s Capital'
    if (desc.includes('draw') || desc.includes('withdrawal') || desc.includes('distribution')) return 'Owner\'s Draws'
    if (desc.includes('retained') || desc.includes('earnings') || desc.includes('profit')) return 'Retained Earnings'
    if (desc.includes('stock') || desc.includes('share') || desc.includes('equity')) return 'Common Stock'
    if (desc.includes('loan') || desc.includes('borrow') || desc.includes('repay')) return 'Loan Transaction'
    if (desc.includes('transfer') || desc.includes('move') || desc.includes('between')) return 'Internal Transfer'
    if (desc.includes('investment') || desc.includes('stock') || desc.includes('bond') || desc.includes('crypto')) return 'Investment Transaction'
    return 'Other Equity'
  }
}

export const expenseCategories = [
  'Office Supplies',
  'Travel',
  'Meals & Entertainment',
  'Professional Services',
  'Software & Subscriptions',
  'Marketing',
  'Utilities',
  'Rent',
  'Insurance',
  'Equipment',
  'Legal & Accounting',
  'Bank Fees',
  'Other Expenses'
]

export const incomeCategories = [
  'Sales Revenue',
  'Service Revenue',
  'Consulting Income',
  'Interest Income',
  'Investment Income',
  'Rental Income',
  'Refunds',
  'Other Income'
]



export const assetCategories = [
  'Cash & Bank Accounts',
  'Accounts Receivable',
  'Inventory',
  'Prepaid Expenses',
  'Equipment & Furniture',
  'Vehicles',
  'Other Assets'
]

export const liabilityCategories = [
  'Accounts Payable',
  'Credit Cards',
  'Loans Payable',
  'Accrued Expenses',
  'Taxes Payable',
  'Other Liabilities'
]

export const equityCategories = [
  'Owner\'s Capital',
  'Owner\'s Draws',
  'Retained Earnings',
  'Common Stock',
  'Owner\'s Draw',
  'Owner\'s Contribution',
  'Loan Transaction',
  'Internal Transfer',
  'Investment Transaction',
  'Other Transfer',
  'Other Equity'
]

export const allCategories = [...expenseCategories, ...incomeCategories, ...assetCategories, ...liabilityCategories, ...equityCategories]