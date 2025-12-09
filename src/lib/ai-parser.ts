import Anthropic from '@anthropic-ai/sdk'
import { progressTracker } from './progress-tracker'

export interface ParsedTransaction {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
}

export interface AIParseResult {
  transactions: ParsedTransaction[]
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

async function parseTransactionsInChunks(
  pdfText: string,
  availableCategories?: { income: string[]; expense: string[] },
  progressId?: string
): Promise<ParsedTransaction[]> {
  const chunkSize = 10000 // Conservative chunk size
  const chunks: string[] = []

  // Split text into chunks
  for (let i = 0; i < pdfText.length; i += chunkSize) {
    chunks.push(pdfText.substring(i, i + chunkSize))
  }

  console.log(`Processing ${chunks.length} chunks`)
  if (progressId) {
    progressTracker.updateProgress(
      progressId,
      'chunking',
      10,
      `Split PDF into ${chunks.length} chunks`
    )
  }

  const allTransactions: ParsedTransaction[] = []

  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunkProgress = 10 + (i / chunks.length) * 80 // 10-90% for chunk processing
    console.log(`Processing chunk ${i + 1}/${chunks.length}`)

    if (progressId) {
      progressTracker.updateProgress(
        progressId,
        'processing',
        chunkProgress,
        `Processing part ${i + 1} of ${chunks.length}`
      )
    }

    try {
      const prompt = createTransactionParsingPrompt(
        chunks[i],
        availableCategories
      )

      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const content = response.content[0]
      if (content.type === 'text') {
        const chunkTransactions = parseAIResponse(content.text)
        allTransactions.push(...chunkTransactions)

        if (progressId) {
          progressTracker.updateProgress(
            progressId,
            'processing',
            chunkProgress + 5,
            `Found ${chunkTransactions.length} transactions in chunk ${i + 1}`
          )
        }
      }
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error)
      if (progressId) {
        progressTracker.updateProgress(
          progressId,
          'processing',
          chunkProgress,
          `Error in part ${i + 1}, continuing...`
        )
      }
      // Continue with other chunks
    }
  }

  if (progressId) {
    progressTracker.updateProgress(
      progressId,
      'validating',
      90,
      'Validating transactions...'
    )
  }

  return validateTransactions(allTransactions)
}

export async function parseTransactionsWithAI(
  pdfText: string,
  availableCategories?: { income: string[]; expense: string[] },
  progressId?: string
): Promise<ParsedTransaction[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  }

  try {
    if (progressId) {
      progressTracker.updateProgress(
        progressId,
        'starting',
        5,
        'Preparing to parse PDF...'
      )
    }

    // If the PDF text is very long, we might need to chunk it
    const maxInputLength = 15000 // Conservative limit for input + prompt

    if (pdfText.length > maxInputLength) {
      console.log(
        `PDF text is ${pdfText.length} chars, chunking for processing`
      )
      return await parseTransactionsInChunks(
        pdfText,
        availableCategories,
        progressId
      )
    }

    if (progressId) {
      progressTracker.updateProgress(
        progressId,
        'processing',
        20,
        'Sending to AI for analysis...'
      )
    }

    const prompt = createTransactionParsingPrompt(pdfText, availableCategories)

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000, // Max for Haiku model
      temperature: 0.1, // Low temperature for consistent parsing
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    if (progressId) {
      progressTracker.updateProgress(
        progressId,
        'parsing',
        70,
        'Parsing AI response...'
      )
    }

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API')
    }

    const parsedTransactions = parseAIResponse(content.text)

    if (progressId) {
      progressTracker.updateProgress(
        progressId,
        'validating',
        90,
        'Validating transactions...'
      )
    }

    return validateTransactions(parsedTransactions)
  } catch (error) {
    console.error('Error parsing transactions with AI:', error)
    if (progressId) {
      progressTracker.updateProgress(
        progressId,
        'error',
        0,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
    throw new Error(
      `AI parsing failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

function createTransactionParsingPrompt(
  pdfText: string,
  availableCategories?: { income: string[]; expense: string[] }
): string {
  let categoryInstructions = ''

  if (availableCategories) {
    categoryInstructions = `
AVAILABLE CATEGORIES (use these exact names):
Income categories: ${availableCategories.income.join(', ')}
Expense categories: ${availableCategories.expense.join(', ')}

- category: Must be one of the exact category names listed above`
  } else {
    categoryInstructions = `
- category: Use descriptive category name (e.g., "Office Supplies", "Travel", "Service Revenue")`
  }

  return `Extract bank transactions from this statement and return ONLY valid JSON.

BANK STATEMENT:
${pdfText}

TASK: Extract all transactions as a JSON array. Each transaction needs:
- date: YYYY-MM-DD format
- description: Clean transaction description  
- amount: Number (positive for income, negative for expenses)
- type: "income" or "expense"${categoryInstructions}

CRITICAL: Your response must be ONLY valid JSON - no explanations, no markdown, no other text.

Example format:
[{"date":"2024-01-15","description":"Coffee Shop","amount":-4.50,"type":"expense","category":"Meals & Entertainment"},{"date":"2024-01-16","description":"Salary","amount":2500.00,"type":"income","category":"Service Revenue"}]

If no transactions found, return: []

JSON:`
}

function parseAIResponse(responseText: string): ParsedTransaction[] {
  try {
    // Clean the response text
    const cleanedText = responseText.trim()

    // Debug logging
    console.log('AI Response length:', responseText.length)
    console.log('AI Response first 200 chars:', responseText.substring(0, 200))
    console.log(
      'AI Response last 200 chars:',
      responseText.substring(Math.max(0, responseText.length - 200))
    )

    // First, try to find JSON within the response
    const jsonStart = cleanedText.indexOf('[')
    const jsonEnd = cleanedText.lastIndexOf(']')

    if (jsonStart === -1 || jsonEnd === -1 || jsonStart >= jsonEnd) {
      console.warn(
        'No valid JSON array found in response, returning empty array'
      )
      console.log('jsonStart:', jsonStart, 'jsonEnd:', jsonEnd)
      return []
    }

    const jsonString = cleanedText.substring(jsonStart, jsonEnd + 1)
    console.log('Extracted JSON length:', jsonString.length)
    console.log('Extracted JSON first 100 chars:', jsonString.substring(0, 100))
    console.log(
      'Extracted JSON last 100 chars:',
      jsonString.substring(Math.max(0, jsonString.length - 100))
    )

    // Try to fix common JSON issues before parsing
    const fixedJsonString = fixCommonJsonIssues(jsonString)
    console.log('Fixed JSON length:', fixedJsonString.length)
    console.log(
      'Fixed JSON differs from original:',
      fixedJsonString !== jsonString
    )

    let parsed
    try {
      parsed = JSON.parse(fixedJsonString)
    } catch (parseError) {
      console.error('JSON parse error details:', parseError)
      console.error(
        'Problematic JSON around position 8:',
        fixedJsonString.substring(0, 50)
      )
      console.error('Full JSON string:', fixedJsonString)
      throw parseError
    }

    if (!Array.isArray(parsed)) {
      console.warn('Response is not an array, returning empty array')
      return []
    }

    return parsed as ParsedTransaction[]
  } catch (error) {
    console.error('Error parsing AI response:', error)
    console.error('Raw response length:', responseText.length)
    console.error('Raw response preview:', responseText.substring(0, 500))

    // Try multiple recovery strategies
    const recoveredTransactions = tryRecoveryStrategies(responseText)
    if (recoveredTransactions.length > 0) {
      console.log(
        `Recovered ${recoveredTransactions.length} transactions using fallback parsing`
      )
      return recoveredTransactions
    }

    // If all recovery fails, return empty array instead of throwing
    console.warn('All parsing attempts failed, returning empty array')
    return []
  }
}

function fixCommonJsonIssues(jsonString: string): string {
  let fixed = jsonString

  // First, try to parse as-is to see if it's already valid
  try {
    JSON.parse(fixed)
    return fixed // Already valid, no need to fix
  } catch {
    // Continue with fixes
  }

  // Remove any trailing commas before closing brackets
  fixed = fixed.replace(/,(\s*[\]}])/g, '$1')

  // Remove any control characters that might break JSON
  fixed = fixed.replace(/[\x00-\x1F\x7F]/g, '')

  // Fix incomplete objects at the end - if we have an incomplete object, remove it
  const lastOpenBrace = fixed.lastIndexOf('{')
  const lastCloseBrace = fixed.lastIndexOf('}')

  if (lastOpenBrace > lastCloseBrace) {
    // We have an unclosed object, remove everything from the last complete object
    const secondLastCloseBrace = fixed.lastIndexOf('}', lastCloseBrace - 1)
    if (secondLastCloseBrace !== -1) {
      // Find the comma before the incomplete object
      const commaBeforeIncomplete = fixed.lastIndexOf(',', lastOpenBrace)
      if (commaBeforeIncomplete > secondLastCloseBrace) {
        fixed = fixed.substring(0, commaBeforeIncomplete) + ']'
      }
    }
  }

  // Ensure the JSON ends with a closing bracket
  if (!fixed.trim().endsWith(']')) {
    fixed = fixed.trim() + ']'
  }

  return fixed
}

function tryRecoveryStrategies(responseText: string): ParsedTransaction[] {
  const strategies = [
    // Strategy 1: Find the largest valid JSON array
    () => {
      const jsonMatches = responseText.match(/\[[\s\S]*?\]/g)
      if (jsonMatches) {
        for (const match of jsonMatches.sort((a, b) => b.length - a.length)) {
          try {
            const parsed = JSON.parse(fixCommonJsonIssues(match))
            if (Array.isArray(parsed)) {
              return parsed as ParsedTransaction[]
            }
          } catch {
            continue
          }
        }
      }
      return []
    },

    // Strategy 2: Try to parse individual transaction objects
    () => {
      const objectMatches = responseText.match(/\{[^{}]*\}/g)
      const transactions: ParsedTransaction[] = []

      if (objectMatches) {
        for (const match of objectMatches) {
          try {
            const parsed = JSON.parse(fixCommonJsonIssues(match))
            if (
              parsed.date &&
              parsed.description &&
              parsed.amount !== undefined
            ) {
              transactions.push(parsed as ParsedTransaction)
            }
          } catch {
            continue
          }
        }
      }

      return transactions
    },

    // Strategy 3: Look for incomplete JSON and try to complete it
    () => {
      const jsonStart = responseText.indexOf('[')
      if (jsonStart !== -1) {
        let jsonString = responseText.substring(jsonStart)

        // Try to find where the JSON might have been cut off
        const lastCompleteObject = jsonString.lastIndexOf('}')
        if (lastCompleteObject !== -1) {
          jsonString = jsonString.substring(0, lastCompleteObject + 1) + ']'

          try {
            const parsed = JSON.parse(fixCommonJsonIssues(jsonString))
            if (Array.isArray(parsed)) {
              return parsed as ParsedTransaction[]
            }
          } catch {
            // Try without the last incomplete object
            const secondLastObject = jsonString.lastIndexOf(
              '}',
              lastCompleteObject - 1
            )
            if (secondLastObject !== -1) {
              jsonString = jsonString.substring(0, secondLastObject + 1) + ']'
              try {
                const parsed = JSON.parse(fixCommonJsonIssues(jsonString))
                if (Array.isArray(parsed)) {
                  return parsed as ParsedTransaction[]
                }
              } catch {
                // Continue to next strategy
              }
            }
          }
        }
      }
      return []
    },
  ]

  for (const strategy of strategies) {
    try {
      const result = strategy()
      if (result.length > 0) {
        return result
      }
    } catch (error) {
      console.error('Recovery strategy failed:', error)
      continue
    }
  }

  return []
}

function validateTransactions(
  transactions: ParsedTransaction[]
): ParsedTransaction[] {
  const validTransactions: ParsedTransaction[] = []

  for (const transaction of transactions) {
    try {
      // Validate required fields
      if (
        !transaction.date ||
        !transaction.description ||
        transaction.amount === undefined ||
        !transaction.category
      ) {
        console.warn('Skipping transaction with missing fields:', transaction)
        continue
      }

      // Validate date format
      const date = new Date(transaction.date)
      if (isNaN(date.getTime())) {
        console.warn('Skipping transaction with invalid date:', transaction)
        continue
      }

      // Validate amount
      const amount = parseFloat(String(transaction.amount))
      if (isNaN(amount)) {
        console.warn('Skipping transaction with invalid amount:', transaction)
        continue
      }

      // Validate type matches amount sign
      const expectedType = amount >= 0 ? 'income' : 'expense'
      const actualType = transaction.type || expectedType

      // Clean up the transaction
      const cleanTransaction: ParsedTransaction = {
        date: transaction.date,
        description: transaction.description.trim(),
        amount: amount,
        type: actualType,
        category: transaction.category || 'Other',
      }

      validTransactions.push(cleanTransaction)
    } catch (error) {
      console.warn('Error validating transaction:', transaction, error)
    }
  }

  return validTransactions
}

export function estimateParsingConfidence(
  transactions: ParsedTransaction[],
  originalText: string
): 'high' | 'medium' | 'low' {
  if (transactions.length === 0) {
    return 'low'
  }

  // Check for common bank statement indicators
  const bankIndicators = ['statement', 'account', 'balance', 'transaction']
  const hasIndicators = bankIndicators.some(indicator =>
    originalText.toLowerCase().includes(indicator)
  )

  // Check transaction quality
  const hasValidDates = transactions.every(
    t => !isNaN(new Date(t.date).getTime())
  )
  const hasReasonableAmounts = transactions.every(
    t => Math.abs(t.amount) > 0 && Math.abs(t.amount) < 1000000
  )
  const hasDescriptions = transactions.every(
    t => t.description && t.description.length > 2
  )

  if (
    hasIndicators &&
    hasValidDates &&
    hasReasonableAmounts &&
    hasDescriptions &&
    transactions.length >= 3
  ) {
    return 'high'
  } else if (
    hasValidDates &&
    hasReasonableAmounts &&
    transactions.length >= 1
  ) {
    return 'medium'
  } else {
    return 'low'
  }
}
