import { PeriodDefinition } from '@/types/columnar-report'
import {
  getFirstDayOfSpecificMonth,
  getLastDayOfSpecificMonth,
} from './date-utils'

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const MONTH_KEYS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
]

/**
 * Generate monthly period definitions for a given year
 */
export function generateMonthlyPeriods(year: number): PeriodDefinition[] {
  return MONTH_KEYS.map((key, index) => ({
    key,
    label: MONTH_LABELS[index],
    fromDate: getFirstDayOfSpecificMonth(year, index),
    toDate: getLastDayOfSpecificMonth(year, index),
  }))
}

/**
 * Generate quarterly period definitions for a given year
 */
export function generateQuarterlyPeriods(year: number): PeriodDefinition[] {
  return [
    {
      key: 'q1',
      label: 'Q1',
      fromDate: getFirstDayOfSpecificMonth(year, 0), // Jan 1
      toDate: getLastDayOfSpecificMonth(year, 2), // Mar 31
    },
    {
      key: 'q2',
      label: 'Q2',
      fromDate: getFirstDayOfSpecificMonth(year, 3), // Apr 1
      toDate: getLastDayOfSpecificMonth(year, 5), // Jun 30
    },
    {
      key: 'q3',
      label: 'Q3',
      fromDate: getFirstDayOfSpecificMonth(year, 6), // Jul 1
      toDate: getLastDayOfSpecificMonth(year, 8), // Sep 30
    },
    {
      key: 'q4',
      label: 'Q4',
      fromDate: getFirstDayOfSpecificMonth(year, 9), // Oct 1
      toDate: getLastDayOfSpecificMonth(year, 11), // Dec 31
    },
  ]
}

/**
 * Find which period a date belongs to
 * Returns the period key or null if not in any period
 */
export function findPeriodForDate(
  date: string,
  periods: PeriodDefinition[]
): string | null {
  for (const period of periods) {
    if (date >= period.fromDate && date <= period.toDate) {
      return period.key
    }
  }
  return null
}

/**
 * Initialize empty period amounts record from periods array
 */
export function initializePeriodAmounts(
  periods: PeriodDefinition[]
): Record<string, number> {
  const amounts: Record<string, number> = {}
  for (const period of periods) {
    amounts[period.key] = 0
  }
  return amounts
}
