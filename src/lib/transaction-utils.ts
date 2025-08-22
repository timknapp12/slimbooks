import type { ChartOfAccount } from '@/types/transaction'

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export const getCategoriesByType = (
  type: string,
  chartOfAccounts: ChartOfAccount[]
) => {
  const typeMapping: { [key: string]: string } = {
    income: 'revenue',
    expense: 'expense',
    asset: 'asset',
    liability: 'liability',
    equity: 'equity',
  }

  const accountType = typeMapping[type] || type
  return chartOfAccounts
    .filter(account => account.account_type === accountType)
    .map(account => account.account_name)
}

export const getAllCategories = (chartOfAccounts: ChartOfAccount[]) => {
  return chartOfAccounts.map(account => account.account_name)
}

export const getTransactionTypeColor = (type: string) => {
  switch (type) {
    case 'income':
      return 'bg-green-100 text-green-800'
    case 'expense':
      return 'bg-red-100 text-red-800'
    case 'asset':
      return 'bg-purple-100 text-purple-800'
    case 'liability':
      return 'bg-orange-100 text-orange-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export const getAmountColor = (type: string) => {
  return type === 'income' || type === 'asset'
    ? 'text-green-600'
    : 'text-red-600'
}

export const getAmountSign = (type: string) => {
  return type === 'income' || type === 'asset' ? '+' : '-'
}
