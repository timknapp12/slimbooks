/**
 * Smart text segmentation utility for processing large PDFs in chunks
 */

export interface TextChunk {
  id: string
  content: string
  startLine: number
  endLine: number
  estimatedTokens: number
  chunkType: 'header' | 'transactions' | 'footer' | 'mixed'
}

export interface ChunkingResult {
  chunks: TextChunk[]
  totalEstimatedTokens: number
  chunkingStrategy: string
  metadata: {
    totalLines: number
    averageChunkSize: number
    largestChunkTokens: number
  }
}

// Rough token estimation (1 token ≈ 4 characters for English text)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Detect if a line contains transaction data
function isTransactionLine(line: string): boolean {
  const transactionPatterns = [
    /\d{1,2}\/\d{1,2}\/\d{2,4}/, // Date patterns
    /\d{4}-\d{2}-\d{2}/, // ISO date patterns
    /\$\d+\.\d{2}/, // Money amounts
    /[-+]?\$?\d{1,3}(?:,\d{3})*\.\d{2}/, // Currency amounts
    /\b(debit|credit|deposit|withdrawal|payment|transfer|fee)\b/i,
    /\b(pending|posted|cleared)\b/i,
    /\b\d+\.\d{2}\b/, // Decimal amounts without currency symbol
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i // Month names
  ]
  
  return transactionPatterns.some(pattern => pattern.test(line))
}

// Detect if a line is likely a header/footer
function isHeaderFooterLine(line: string): boolean {
  const headerFooterPatterns = [
    /^(page \d+|statement|account|customer|address|phone|email)/i,
    /^(continued|subtotal|total|balance|summary)/i,
    /^\s*$/,  // Empty lines
    /^[-=_\s]+$/, // Separator lines
    /^(bank|credit union|financial)/i
  ]
  
  return headerFooterPatterns.some(pattern => pattern.test(line))
}

// Find natural break points in the text
function findBreakPoints(lines: string[]): number[] {
  const breakPoints: number[] = [0] // Always start at beginning
  
  for (let i = 1; i < lines.length - 1; i++) {
    const currentLine = lines[i].trim()
    const nextLine = lines[i + 1]?.trim() || ''
    
    // Break at page boundaries
    if (currentLine.match(/^page \d+/i) || currentLine.match(/^statement page/i)) {
      breakPoints.push(i)
      continue
    }
    
    // Break at date boundaries (new month/year)
    const currentDate = currentLine.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
    const nextDate = nextLine.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
    
    if (currentDate && nextDate) {
      const currentMonth = parseInt(currentDate[1])
      const currentYear = parseInt(currentDate[3])
      const nextMonth = parseInt(nextDate[1])
      const nextYear = parseInt(nextDate[3])
      
      // Break when month or year changes
      if (currentMonth !== nextMonth || currentYear !== nextYear) {
        breakPoints.push(i + 1)
        continue
      }
    }
    
    // Break at section headers
    if (currentLine.match(/^(transaction|activity|summary|account activity)/i)) {
      breakPoints.push(i)
      continue
    }
    
    // Break after long gaps of non-transaction lines
    let nonTransactionCount = 0
    for (let j = i; j < Math.min(i + 5, lines.length); j++) {
      if (!isTransactionLine(lines[j]) && !isHeaderFooterLine(lines[j])) {
        nonTransactionCount++
      }
    }
    if (nonTransactionCount >= 3) {
      breakPoints.push(i)
    }
  }
  
  breakPoints.push(lines.length) // Always end at the end
  return [...new Set(breakPoints)].sort((a, b) => a - b) // Remove duplicates and sort
}

// Determine chunk type based on content
function determineChunkType(lines: string[]): TextChunk['chunkType'] {
  let transactionLines = 0
  let headerFooterLines = 0
  
  for (const line of lines) {
    if (isTransactionLine(line)) {
      transactionLines++
    } else if (isHeaderFooterLine(line)) {
      headerFooterLines++
    }
  }
  
  const totalLines = lines.length
  const transactionRatio = transactionLines / totalLines
  const headerFooterRatio = headerFooterLines / totalLines
  
  // Be more lenient with transaction detection
  if (transactionRatio > 0.4) return 'transactions'
  if (headerFooterRatio > 0.8) return 'header'
  if (transactionRatio > 0.1) return 'mixed' // Lower threshold for mixed content
  return 'footer'
}

/**
 * Split large PDF text into manageable chunks for AI processing
 */
export function chunkPDFText(
  text: string, 
  maxTokensPerChunk: number = 15000 // Conservative limit for Claude Haiku
): ChunkingResult {
  const lines = text.split('\n')
  const totalLines = lines.length
  const totalEstimatedTokens = estimateTokens(text)
  
  // If text is small enough, return as single chunk
  if (totalEstimatedTokens <= maxTokensPerChunk) {
    return {
      chunks: [{
        id: 'chunk-1',
        content: text,
        startLine: 0,
        endLine: totalLines,
        estimatedTokens: totalEstimatedTokens,
        chunkType: determineChunkType(lines)
      }],
      totalEstimatedTokens,
      chunkingStrategy: 'single-chunk',
      metadata: {
        totalLines,
        averageChunkSize: totalEstimatedTokens,
        largestChunkTokens: totalEstimatedTokens
      }
    }
  }
  
  // Find natural break points
  const breakPoints = findBreakPoints(lines)
  const chunks: TextChunk[] = []
  
  // Create initial chunks based on break points
  for (let i = 0; i < breakPoints.length - 1; i++) {
    const startLine = breakPoints[i]
    const endLine = breakPoints[i + 1]
    const chunkLines = lines.slice(startLine, endLine)
    const chunkContent = chunkLines.join('\n')
    const estimatedTokens = estimateTokens(chunkContent)
    
    chunks.push({
      id: `chunk-${i + 1}`,
      content: chunkContent,
      startLine,
      endLine,
      estimatedTokens,
      chunkType: determineChunkType(chunkLines)
    })
  }
  
  // Merge small chunks and split large ones
  const optimizedChunks: TextChunk[] = []
  let currentChunk: TextChunk | null = null
  
  for (const chunk of chunks) {
    // If chunk is too large, split it further
    if (chunk.estimatedTokens > maxTokensPerChunk) {
      const subChunks = splitLargeChunk(chunk, maxTokensPerChunk)
      optimizedChunks.push(...subChunks)
      currentChunk = null
      continue
    }
    
    // If no current chunk or combining would exceed limit, start new chunk
    if (!currentChunk || 
        (currentChunk.estimatedTokens + chunk.estimatedTokens > maxTokensPerChunk)) {
      if (currentChunk) {
        optimizedChunks.push(currentChunk)
      }
      currentChunk = { ...chunk }
    } else {
      // Merge with current chunk
      currentChunk.content += '\n' + chunk.content
      currentChunk.endLine = chunk.endLine
      currentChunk.estimatedTokens += chunk.estimatedTokens
      currentChunk.chunkType = currentChunk.chunkType === chunk.chunkType ? 
        currentChunk.chunkType : 'mixed'
    }
  }
  
  // Add the last chunk
  if (currentChunk) {
    optimizedChunks.push(currentChunk)
  }
  
  // Re-assign chunk IDs
  optimizedChunks.forEach((chunk, index) => {
    chunk.id = `chunk-${index + 1}`
  })
  
  const averageChunkSize = optimizedChunks.reduce((sum, chunk) => sum + chunk.estimatedTokens, 0) / optimizedChunks.length
  const largestChunkTokens = Math.max(...optimizedChunks.map(chunk => chunk.estimatedTokens))
  
  return {
    chunks: optimizedChunks,
    totalEstimatedTokens,
    chunkingStrategy: 'smart-segmentation',
    metadata: {
      totalLines,
      averageChunkSize: Math.round(averageChunkSize),
      largestChunkTokens
    }
  }
}

// Split a chunk that's too large into smaller pieces
function splitLargeChunk(chunk: TextChunk, maxTokens: number): TextChunk[] {
  const lines = chunk.content.split('\n')
  const subChunks: TextChunk[] = []
  
  let currentLines: string[] = []
  let currentTokens = 0
  let chunkIndex = 1
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineTokens = estimateTokens(line)
    
    if (currentTokens + lineTokens > maxTokens && currentLines.length > 0) {
      // Create sub-chunk
      const subChunkContent = currentLines.join('\n')
      subChunks.push({
        id: `${chunk.id}-${chunkIndex}`,
        content: subChunkContent,
        startLine: chunk.startLine + i - currentLines.length,
        endLine: chunk.startLine + i,
        estimatedTokens: currentTokens,
        chunkType: determineChunkType(currentLines)
      })
      
      currentLines = [line]
      currentTokens = lineTokens
      chunkIndex++
    } else {
      currentLines.push(line)
      currentTokens += lineTokens
    }
  }
  
  // Add remaining lines as final sub-chunk
  if (currentLines.length > 0) {
    const subChunkContent = currentLines.join('\n')
    subChunks.push({
      id: `${chunk.id}-${chunkIndex}`,
      content: subChunkContent,
      startLine: chunk.endLine - currentLines.length,
      endLine: chunk.endLine,
      estimatedTokens: currentTokens,
      chunkType: determineChunkType(currentLines)
    })
  }
  
  return subChunks
}

/**
 * Filter chunks to only process those likely to contain transactions
 */
export function filterTransactionChunks(chunks: TextChunk[]): TextChunk[] {
  return chunks.filter(chunk => 
    chunk.chunkType === 'transactions' || 
    chunk.chunkType === 'mixed'
  )
}

/**
 * Get processing summary for user display
 */
export function getProcessingSummary(chunkingResult: ChunkingResult): string {
  const { chunks, metadata } = chunkingResult
  const transactionChunks = filterTransactionChunks(chunks)
  
  return `Found ${chunks.length} sections (${transactionChunks.length} contain transactions). ` +
         `Average section size: ${metadata.averageChunkSize} tokens. ` +
         `Processing ${transactionChunks.length} sections for transactions.`
}