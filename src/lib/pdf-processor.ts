export interface PDFParseResult {
  text: string
  numPages: number
  info?: Record<string, unknown>
}

// Helper function to load pdf-parse dynamically
async function loadPdfParse() {
  try {
    // Try different import methods for pdf-parse
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pdfParse: any
    
    try {
      // Method 1: Direct require (works in Node.js)
      pdfParse = eval('require')('pdf-parse')
    } catch {
      try {
        // Method 2: Dynamic import
        const pdfModule = await import('pdf-parse')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfParse = (pdfModule as any).default || pdfModule
      } catch {
        throw new Error('Could not load pdf-parse module')
      }
    }
    
    return pdfParse
  } catch (error) {
    throw new Error(`Failed to load PDF parser: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = await loadPdfParse()
    const data = await pdfParse(buffer)

    if (!data.text || data.text.trim().length === 0) {
      throw new Error('No text content found in PDF')
    }

    // Clean up the extracted text
    const cleanText = data.text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page breaks and form feeds
      .replace(/[\f\r]/g, '')
      // Normalize line breaks
      .replace(/\n\s*\n/g, '\n')
      // Trim whitespace
      .trim()

    return cleanText
  } catch (error) {
    console.error('Error extracting text from PDF:', error)
    throw new Error(
      `Failed to extract text from PDF: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

export async function extractPDFInfo(buffer: Buffer): Promise<PDFParseResult> {
  try {
    const pdfParse = await loadPdfParse()
    const data = await pdfParse(buffer)

    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
    }
  } catch (error) {
    console.error('Error parsing PDF:', error)
    throw new Error(
      `Failed to parse PDF: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

export function validatePDFText(text: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!text || text.trim().length === 0) {
    errors.push('PDF contains no readable text')
    return { isValid: false, errors }
  }

  if (text.length < 50) {
    errors.push('PDF text is too short to contain meaningful transaction data')
    return { isValid: false, errors }
  }

  // Check for common bank statement indicators
  const bankIndicators = [
    'statement',
    'account',
    'balance',
    'transaction',
    'date',
    'amount',
    'deposit',
    'withdrawal',
    'payment',
    'transfer',
    'debit',
    'credit',
  ]

  const lowerText = text.toLowerCase()
  const foundIndicators = bankIndicators.filter(indicator =>
    lowerText.includes(indicator)
  )

  if (foundIndicators.length < 3) {
    errors.push('PDF does not appear to contain bank statement data')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
