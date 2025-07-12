// Smart categorization based on description keywords
export const autoCategorizeTranaction = (description: string, type: 'income' | 'expense' | 'transfer'): string => {
  const desc = description.toLowerCase()
  
  if (type === 'income') {
    if (desc.includes('salary') || desc.includes('payroll') || desc.includes('wage')) return 'Service Revenue'
    if (desc.includes('interest') || desc.includes('dividend')) return 'Interest Income'
    if (desc.includes('refund') || desc.includes('return')) return 'Refunds'
    if (desc.includes('rent') || desc.includes('rental')) return 'Rental Income'
    if (desc.includes('consulting') || desc.includes('freelance')) return 'Consulting Income'
    return 'Other Income'
  } else {
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

export const allCategories = [...expenseCategories, ...incomeCategories]