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
      return 'bg-green-500/20 text-green-700 dark:text-green-400'
    case 'expense':
      return 'bg-red-500/20 text-red-700 dark:text-red-400'
    case 'asset':
      return 'bg-purple-500/20 text-purple-700 dark:text-purple-400'
    case 'liability':
      return 'bg-orange-500/20 text-orange-700 dark:text-orange-400'
    default:
      return 'bg-gray-500/20 text-gray-700 dark:text-gray-400'
  }
}

export const getAmountColor = (type: string) => {
  return type === 'income' || type === 'asset'
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'
}

export const getAmountSign = (type: string) => {
  return type === 'income' || type === 'asset' ? '+' : '-'
}
