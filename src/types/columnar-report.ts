export type ColumnDisplayMode = 'total' | 'monthly' | 'quarterly'

export interface PeriodDefinition {
  key: string // 'jan', 'feb', 'q1', etc.
  label: string // 'Jan', 'Feb', 'Q1 2024', etc.
  fromDate: string // YYYY-MM-DD
  toDate: string // YYYY-MM-DD
}

export interface ColumnarLineItem {
  accountNumber: string
  accountName: string
  periodAmounts: Record<string, number> // { jan: 1000, feb: 1200, ... }
  total: number
}

export interface ColumnarProfitLoss {
  periods: PeriodDefinition[]
  revenue: ColumnarLineItem[]
  costOfGoodsSold: ColumnarLineItem[]
  operatingExpenses: ColumnarLineItem[]
  otherIncome: ColumnarLineItem[]
  otherExpenses: ColumnarLineItem[]
  // Period totals for each subtotal row
  periodTotals: {
    totalRevenue: Record<string, number>
    totalCOGS: Record<string, number>
    grossProfit: Record<string, number>
    totalOperatingExpenses: Record<string, number>
    operatingIncome: Record<string, number>
    totalOtherIncome: Record<string, number>
    totalOtherExpenses: Record<string, number>
    netIncome: Record<string, number>
  }
  // Grand totals (sum across all periods)
  grandTotals: {
    totalRevenue: number
    totalCOGS: number
    grossProfit: number
    totalOperatingExpenses: number
    operatingIncome: number
    totalOtherIncome: number
    totalOtherExpenses: number
    netIncome: number
  }
}
