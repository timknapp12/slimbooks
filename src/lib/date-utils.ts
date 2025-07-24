/**
 * Centralized date utilities following industry best practices
 * Store dates as DATE in database, format for display in application
 */

// Format date for display (MM/DD/YYYY for US locale)
export const formatDate = (dateString: string): string => {
  // Parse the date string and create a date in the local timezone
  const [year, month, day] = dateString.split('-').map(Number)
  const localDate = new Date(year, month - 1, day) // month is 0-indexed
  return localDate.toLocaleDateString('en-US')
}

// Format date for database storage (YYYY-MM-DD)
export const formatDateForDB = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toISOString().split('T')[0]
}

// Get current date in database format (YYYY-MM-DD) - UTC
export const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0]
}

// Get current date and time for database - UTC
export const getCurrentDateTime = (): string => {
  return new Date().toISOString()
}

// Parse date string to Date object (handles various formats) - UTC
export const parseDate = (dateString: string): Date => {
  // Always parse as UTC to avoid timezone issues
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Date(dateString + 'T00:00:00.000Z')
  }
  // For other formats, try to parse and convert to UTC
  const parsed = new Date(dateString)
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
}

// Get first day of current month
export const getFirstDayOfMonth = (): string => {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
}

// Get last day of current month
export const getLastDayOfMonth = (): string => {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]
}

// Get first day of a specific year
export const getFirstDayOfYear = (year: number): string => {
  return new Date(year, 0, 1).toISOString().split('T')[0]
}

// Get last day of a specific year
export const getLastDayOfYear = (year: number): string => {
  return new Date(year, 11, 31).toISOString().split('T')[0]
}

// Get first day of a specific month
export const getFirstDayOfSpecificMonth = (year: number, month: number): string => {
  return new Date(year, month, 1).toISOString().split('T')[0]
}

// Get last day of a specific month
export const getLastDayOfSpecificMonth = (year: number, month: number): string => {
  return new Date(year, month + 1, 0).toISOString().split('T')[0]
}

// Check if a date is overdue (for payables/receivables) - UTC comparison
export const isOverdue = (dueDate: string, status?: string): boolean => {
  if (status && status !== 'open') return false
  // Compare dates in UTC to avoid timezone issues
  const dueDateUTC = new Date(dueDate + 'T00:00:00.000Z')
  const nowUTC = new Date()
  return dueDateUTC < nowUTC
}

// Get current date in user's timezone for display purposes
export const getCurrentDateForDisplay = (): string => {
  const now = new Date()
  return now.toLocaleDateString('en-US')
}

// Get current time in UTC for consistent timestamps
export const getCurrentTimeUTC = (): string => {
  const now = new Date()
  return now.toLocaleTimeString('en-US', { 
    timeZone: 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Format date for PDF generation (consistent with display format)
export const formatDateForPDF = (dateString: string): string => {
  return new Date(dateString + 'T00:00:00.000Z').toLocaleDateString('en-US')
}

// Get current year
export const getCurrentYear = (): number => {
  return new Date().getFullYear()
}

// Get current month (0-11)
export const getCurrentMonth = (): number => {
  return new Date().getMonth()
}

// Generate array of years (current year + 1 future, 3 past)
export const getYearOptions = (): number[] => {
  const currentYear = getCurrentYear()
  return Array.from({ length: 5 }, (_, i) => currentYear + 1 - i)
} 