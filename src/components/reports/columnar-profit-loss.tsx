'use client'

import { ColumnarProfitLoss, ColumnarLineItem } from '@/types/columnar-report'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface ColumnarProfitLossProps {
  data: ColumnarProfitLoss
  companyName?: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

interface SectionRowProps {
  item: ColumnarLineItem
  periods: { key: string }[]
  indent?: boolean
}

function SectionRow({ item, periods, indent = true }: SectionRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        className={cn(
          'sticky left-0 bg-white dark:bg-gray-950 whitespace-nowrap',
          indent && 'pl-8'
        )}
      >
        <span className="text-gray-500 text-xs mr-2 font-mono">
          {item.accountNumber}
        </span>
        {item.accountName}
      </TableCell>
      {periods.map(period => (
        <TableCell key={period.key} className="text-right whitespace-nowrap">
          {item.periodAmounts[period.key] !== 0
            ? formatCurrency(item.periodAmounts[period.key])
            : '-'}
        </TableCell>
      ))}
      <TableCell className="text-right font-medium whitespace-nowrap">
        {formatCurrency(item.total)}
      </TableCell>
    </TableRow>
  )
}

interface SubtotalRowProps {
  label: string
  periodAmounts: Record<string, number>
  total: number
  periods: { key: string }[]
  isBold?: boolean
  isHighlighted?: boolean
  showTopBorder?: boolean
  className?: string
}

function SubtotalRow({
  label,
  periodAmounts,
  total,
  periods,
  isBold = false,
  isHighlighted = false,
  showTopBorder = true,
  className,
}: SubtotalRowProps) {
  const isPositive = total >= 0
  const colorClass = isHighlighted
    ? isPositive
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400'
    : ''

  return (
    <TableRow
      className={cn(
        'hover:bg-transparent',
        showTopBorder && 'border-t-2 border-gray-300 dark:border-gray-700',
        className
      )}
    >
      <TableCell
        className={cn(
          'sticky left-0 bg-white dark:bg-gray-950 whitespace-nowrap',
          isBold && 'font-bold',
          colorClass
        )}
      >
        {label}
      </TableCell>
      {periods.map(period => (
        <TableCell
          key={period.key}
          className={cn(
            'text-right whitespace-nowrap',
            isBold && 'font-bold',
            colorClass
          )}
        >
          {formatCurrency(periodAmounts[period.key])}
        </TableCell>
      ))}
      <TableCell
        className={cn(
          'text-right whitespace-nowrap',
          isBold ? 'font-bold' : 'font-medium',
          colorClass
        )}
      >
        {formatCurrency(total)}
      </TableCell>
    </TableRow>
  )
}

interface SectionHeaderProps {
  label: string
  colSpan: number
}

function SectionHeader({ label, colSpan }: SectionHeaderProps) {
  return (
    <TableRow className="hover:bg-transparent bg-gray-50 dark:bg-gray-900">
      <TableCell
        colSpan={colSpan}
        className="sticky left-0 bg-gray-50 dark:bg-gray-900 font-semibold text-sm uppercase tracking-wide text-gray-600 dark:text-gray-400"
      >
        {label}
      </TableCell>
    </TableRow>
  )
}

export function ColumnarProfitLossTable({
  data,
  companyName,
}: ColumnarProfitLossProps) {
  const { periods, periodTotals, grandTotals } = data
  const colSpan = periods.length + 2 // account name + periods + total

  return (
    <div className="space-y-4">
      {companyName && (
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold">{companyName}</h2>
          <p className="text-muted-foreground">Profit & Loss Statement</p>
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-white dark:bg-gray-950 min-w-[200px]">
                Account
              </TableHead>
              {periods.map(period => (
                <TableHead
                  key={period.key}
                  className="text-right min-w-[100px] whitespace-nowrap"
                >
                  {period.label}
                </TableHead>
              ))}
              <TableHead className="text-right min-w-[120px] font-bold">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Revenue Section */}
            {data.revenue.length > 0 && (
              <>
                <SectionHeader label="Revenue" colSpan={colSpan} />
                {data.revenue.map(item => (
                  <SectionRow
                    key={item.accountNumber}
                    item={item}
                    periods={periods}
                  />
                ))}
                <SubtotalRow
                  label="Total Revenue"
                  periodAmounts={periodTotals.totalRevenue}
                  total={grandTotals.totalRevenue}
                  periods={periods}
                  isBold
                />
              </>
            )}

            {/* Cost of Goods Sold Section */}
            {data.costOfGoodsSold.length > 0 && (
              <>
                <SectionHeader label="Cost of Goods Sold" colSpan={colSpan} />
                {data.costOfGoodsSold.map(item => (
                  <SectionRow
                    key={item.accountNumber}
                    item={item}
                    periods={periods}
                  />
                ))}
                <SubtotalRow
                  label="Total Cost of Goods Sold"
                  periodAmounts={periodTotals.totalCOGS}
                  total={grandTotals.totalCOGS}
                  periods={periods}
                  isBold
                />
              </>
            )}

            {/* Gross Profit */}
            <SubtotalRow
              label="Gross Profit"
              periodAmounts={periodTotals.grossProfit}
              total={grandTotals.grossProfit}
              periods={periods}
              isBold
              isHighlighted
              className="bg-gray-100 dark:bg-gray-800"
            />

            {/* Operating Expenses Section */}
            {data.operatingExpenses.length > 0 && (
              <>
                <SectionHeader label="Operating Expenses" colSpan={colSpan} />
                {data.operatingExpenses.map(item => (
                  <SectionRow
                    key={item.accountNumber}
                    item={item}
                    periods={periods}
                  />
                ))}
                <SubtotalRow
                  label="Total Operating Expenses"
                  periodAmounts={periodTotals.totalOperatingExpenses}
                  total={grandTotals.totalOperatingExpenses}
                  periods={periods}
                  isBold
                />
              </>
            )}

            {/* Operating Income */}
            <SubtotalRow
              label="Operating Income"
              periodAmounts={periodTotals.operatingIncome}
              total={grandTotals.operatingIncome}
              periods={periods}
              isBold
              isHighlighted
              className="bg-gray-100 dark:bg-gray-800"
            />

            {/* Other Income Section */}
            {data.otherIncome.length > 0 && (
              <>
                <SectionHeader label="Other Income" colSpan={colSpan} />
                {data.otherIncome.map(item => (
                  <SectionRow
                    key={item.accountNumber}
                    item={item}
                    periods={periods}
                  />
                ))}
                <SubtotalRow
                  label="Total Other Income"
                  periodAmounts={periodTotals.totalOtherIncome}
                  total={grandTotals.totalOtherIncome}
                  periods={periods}
                />
              </>
            )}

            {/* Other Expenses Section */}
            {data.otherExpenses.length > 0 && (
              <>
                <SectionHeader label="Other Expenses" colSpan={colSpan} />
                {data.otherExpenses.map(item => (
                  <SectionRow
                    key={item.accountNumber}
                    item={item}
                    periods={periods}
                  />
                ))}
                <SubtotalRow
                  label="Total Other Expenses"
                  periodAmounts={periodTotals.totalOtherExpenses}
                  total={grandTotals.totalOtherExpenses}
                  periods={periods}
                />
              </>
            )}

            {/* Net Income */}
            <SubtotalRow
              label="Net Income"
              periodAmounts={periodTotals.netIncome}
              total={grandTotals.netIncome}
              periods={periods}
              isBold
              isHighlighted
              className="bg-gray-200 dark:bg-gray-700 text-lg"
            />
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
