/**
 * Progressive processing utility for handling PDF chunks with progress tracking
 */

import { parseTransactionsWithAI } from './ai-parser'
import { sanitizeBankStatementText } from './data-sanitizer'
import { TextChunk, filterTransactionChunks } from './pdf-chunker'

export interface ProcessingProgress {
  currentChunk: number
  totalChunks: number
  currentChunkId: string
  status: 'processing' | 'completed' | 'error' | 'retrying'
  message: string
  percentage: number
  processedTransactions: number
  errors: ProcessingError[]
}

export interface ProcessingError {
  chunkId: string
  error: string
  retryCount: number
  timestamp: Date
}

interface Transaction {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
}

export interface ProcessingResult {
  transactions: Transaction[]
  progress: ProcessingProgress
  summary: {
    totalChunks: number
    successfulChunks: number
    failedChunks: number
    totalTransactions: number
    processingTimeMs: number
  }
  isComplete: boolean
  hasErrors: boolean
}

export interface ProgressCallback {
  (progress: ProcessingProgress): void
}

/**
 * Process PDF chunks progressively with real-time progress updates
 */
export async function processChunksProgressively(
  chunks: TextChunk[],
  availableCategories: { income: string[], expense: string[] },
  onProgress: ProgressCallback,
  maxRetries: number = 2
): Promise<ProcessingResult> {
  const startTime = Date.now()
  const transactionChunks = filterTransactionChunks(chunks)
  const allTransactions: Transaction[] = []
  const errors: ProcessingError[] = []
  let successfulChunks = 0
  
  // Initialize progress
  const initialProgress: ProcessingProgress = {
    currentChunk: 0,
    totalChunks: transactionChunks.length,
    currentChunkId: '',
    status: 'processing',
    message: 'Starting PDF processing...',
    percentage: 0,
    processedTransactions: 0,
    errors: []
  }
  
  onProgress(initialProgress)
  
  // Process each chunk
  for (let i = 0; i < transactionChunks.length; i++) {
    const chunk = transactionChunks[i]
    const chunkNumber = i + 1
    
    // Update progress for current chunk
    const progress: ProcessingProgress = {
      currentChunk: chunkNumber,
      totalChunks: transactionChunks.length,
      currentChunkId: chunk.id,
      status: 'processing',
      message: `Processing section ${chunkNumber} of ${transactionChunks.length}...`,
      percentage: Math.round((i / transactionChunks.length) * 100),
      processedTransactions: allTransactions.length,
      errors: [...errors]
    }
    
    onProgress(progress)
    
    // Process chunk with retry logic
    const chunkResult = await processChunkWithRetry(
      chunk,
      availableCategories,
      maxRetries,
      (retryCount) => {
        const retryProgress: ProcessingProgress = {
          ...progress,
          status: 'retrying',
          message: `Retrying section ${chunkNumber} (attempt ${retryCount + 1}/${maxRetries + 1})...`
        }
        onProgress(retryProgress)
      }
    )
    
    if (chunkResult.success) {
      allTransactions.push(...chunkResult.transactions)
      successfulChunks++
      
      // Update progress with success
      const successProgress: ProcessingProgress = {
        ...progress,
        status: 'completed',
        message: `Completed section ${chunkNumber} - found ${chunkResult.transactions.length} transactions`,
        processedTransactions: allTransactions.length
      }
      onProgress(successProgress)
    } else {
      // Add error
      const error: ProcessingError = {
        chunkId: chunk.id,
        error: chunkResult.error || 'Unknown error',
        retryCount: chunkResult.retryCount,
        timestamp: new Date()
      }
      errors.push(error)
      
      // Update progress with error
      const errorProgress: ProcessingProgress = {
        ...progress,
        status: 'error',
        message: `Failed to process section ${chunkNumber}: ${chunkResult.error}`,
        errors: [...errors]
      }
      onProgress(errorProgress)
    }
    
    // Small delay to prevent overwhelming the AI API
    if (i < transactionChunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  // Final progress update
  const endTime = Date.now()
  const processingTimeMs = endTime - startTime
  const failedChunks = transactionChunks.length - successfulChunks
  
  const finalProgress: ProcessingProgress = {
    currentChunk: transactionChunks.length,
    totalChunks: transactionChunks.length,
    currentChunkId: '',
    status: errors.length > 0 ? 'error' : 'completed',
    message: errors.length > 0 
      ? `Completed with ${errors.length} errors - found ${allTransactions.length} transactions`
      : `Successfully processed all sections - found ${allTransactions.length} transactions`,
    percentage: 100,
    processedTransactions: allTransactions.length,
    errors: [...errors]
  }
  
  onProgress(finalProgress)
  
  return {
    transactions: allTransactions,
    progress: finalProgress,
    summary: {
      totalChunks: transactionChunks.length,
      successfulChunks,
      failedChunks,
      totalTransactions: allTransactions.length,
      processingTimeMs
    },
    isComplete: true,
    hasErrors: errors.length > 0
  }
}

/**
 * Process a single chunk with retry logic
 */
async function processChunkWithRetry(
  chunk: TextChunk,
  availableCategories: { income: string[], expense: string[] },
  maxRetries: number,
  onRetry: (retryCount: number) => void
): Promise<{
  success: boolean
  transactions: Transaction[]
  error?: string
  retryCount: number
}> {
  let lastError: string = ''
  
  for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
    try {
      if (retryCount > 0) {
        onRetry(retryCount)
        // Exponential backoff for retries
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
      }
      
      // Sanitize chunk content
      const sanitizationResult = sanitizeBankStatementText(chunk.content)
      const sanitizedText = sanitizationResult.sanitizedText
      
      // Skip chunks with very little content
      if (sanitizedText.trim().length < 50) {
        return {
          success: true,
          transactions: [],
          retryCount
        }
      }
      
      // Process with AI
      const transactions = await parseTransactionsWithAI(sanitizedText, availableCategories)
      
      return {
        success: true,
        transactions: transactions || [],
        retryCount
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'
      
      // If this is the last retry, return failure
      if (retryCount === maxRetries) {
        break
      }
    }
  }
  
  return {
    success: false,
    transactions: [],
    error: lastError,
    retryCount: maxRetries
  }
}

/**
 * Deduplicate transactions across chunks (in case of overlapping content)
 */
export function deduplicateTransactions(transactions: Transaction[]): Transaction[] {
  const seen = new Set<string>()
  const deduplicated: Transaction[] = []
  
  for (const transaction of transactions) {
    // Create a unique key based on date, amount, and description
    const key = `${transaction.date}-${transaction.amount}-${transaction.description?.substring(0, 50)}`
    
    if (!seen.has(key)) {
      seen.add(key)
      deduplicated.push(transaction)
    }
  }
  
  return deduplicated
}

/**
 * Sort transactions by date (oldest first)
 */
export function sortTransactionsByDate(transactions: Transaction[]): Transaction[] {
  return transactions.sort((a, b) => {
    const dateA = new Date(a.date)
    const dateB = new Date(b.date)
    return dateA.getTime() - dateB.getTime()
  })
}

/**
 * Get processing statistics for user display
 */
export function getProcessingStats(result: ProcessingResult): string {
  const { summary } = result
  const timeInSeconds = Math.round(summary.processingTimeMs / 1000)
  
  let stats = `Processed ${summary.totalTransactions} transactions in ${timeInSeconds}s`
  
  if (summary.failedChunks > 0) {
    stats += ` (${summary.failedChunks} sections failed)`
  }
  
  return stats
}