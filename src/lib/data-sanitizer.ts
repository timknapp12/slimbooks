/**
 * Data sanitization utility to remove personal and sensitive information
 * from bank statement text before sending to AI APIs
 */

export interface SanitizationResult {
  sanitizedText: string
  removedItems: {
    names: string[]
    accountNumbers: string[]
    addresses: string[]
    phoneNumbers: string[]
    emails: string[]
    ssns: string[]
    routingNumbers: string[]
  }
}

/**
 * Sanitizes bank statement text by removing or masking personal information
 */
export function sanitizeBankStatementText(text: string): SanitizationResult {
  let sanitizedText = text
  const removedItems = {
    names: [] as string[],
    accountNumbers: [] as string[],
    addresses: [] as string[],
    phoneNumbers: [] as string[],
    emails: [] as string[],
    ssns: [] as string[],
    routingNumbers: [] as string[]
  }

  // Remove account numbers (only when clearly labeled or in specific formats)
  const accountNumberPatterns = [
    /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/g, // 16-digit with separators (credit card format)
    /Account\s*(?:Number|#|No\.?)[\s:]*(\d{8,17})/gi, // Labeled account numbers
    /Acct\s*(?:Number|#|No\.?)[\s:]*(\d{8,17})/gi, // Labeled account numbers
    /(?:Account|Acct)[\s:]+(\d{4}[-\s]*\d{4}[-\s]*\d{4,8})/gi // Account with separators
  ]

  accountNumberPatterns.forEach(pattern => {
    const matches = sanitizedText.match(pattern)
    if (matches) {
      matches.forEach(match => {
        if (!removedItems.accountNumbers.includes(match)) {
          removedItems.accountNumbers.push(match)
        }
      })
      sanitizedText = sanitizedText.replace(pattern, '[ACCOUNT_NUMBER]')
    }
  })

  // Remove routing numbers (9-digit bank routing numbers)
  const routingPattern = /\b\d{9}\b/g
  const routingMatches = sanitizedText.match(routingPattern)
  if (routingMatches) {
    routingMatches.forEach(match => {
      // Only consider 9-digit numbers that look like routing numbers
      if (match.startsWith('0') || match.startsWith('1') || match.startsWith('2') || match.startsWith('3')) {
        if (!removedItems.routingNumbers.includes(match)) {
          removedItems.routingNumbers.push(match)
        }
        sanitizedText = sanitizedText.replace(new RegExp(`\\b${match}\\b`, 'g'), '[ROUTING_NUMBER]')
      }
    })
  }

  // Remove Social Security Numbers
  const ssnPatterns = [
    /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    /SSN[\s:]*(\d{3}[-\s]?\d{2}[-\s]?\d{4})/gi
  ]

  ssnPatterns.forEach(pattern => {
    const matches = sanitizedText.match(pattern)
    if (matches) {
      matches.forEach(match => {
        if (!removedItems.ssns.includes(match)) {
          removedItems.ssns.push(match)
        }
      })
      sanitizedText = sanitizedText.replace(pattern, '[SSN]')
    }
  })

  // Remove email addresses
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  const emailMatches = sanitizedText.match(emailPattern)
  if (emailMatches) {
    emailMatches.forEach(email => {
      if (!removedItems.emails.includes(email)) {
        removedItems.emails.push(email)
      }
    })
    sanitizedText = sanitizedText.replace(emailPattern, '[EMAIL]')
  }

  // Remove phone numbers
  const phonePatterns = [
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g,
    /\+1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g
  ]

  phonePatterns.forEach(pattern => {
    const matches = sanitizedText.match(pattern)
    if (matches) {
      matches.forEach(phone => {
        if (!removedItems.phoneNumbers.includes(phone)) {
          removedItems.phoneNumbers.push(phone)
        }
      })
      sanitizedText = sanitizedText.replace(pattern, '[PHONE]')
    }
  })

  // Remove addresses (basic pattern matching)
  const addressPatterns = [
    /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Circle|Cir|Court|Ct|Place|Pl)\b/gi,
    /\b\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?\b/gi
  ]

  addressPatterns.forEach(pattern => {
    const matches = sanitizedText.match(pattern)
    if (matches) {
      matches.forEach(address => {
        if (!removedItems.addresses.includes(address)) {
          removedItems.addresses.push(address)
        }
      })
      sanitizedText = sanitizedText.replace(pattern, '[ADDRESS]')
    }
  })

  // Remove common personal names (this is basic - could be enhanced with name databases)
  const namePatterns = [
    /(?:Account\s+Holder|Customer|Name)[\s:]+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    /^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/gm // Names on their own line
  ]

  namePatterns.forEach(pattern => {
    const matches = sanitizedText.match(pattern)
    if (matches) {
      matches.forEach(match => {
        // Extract just the name part if it's a labeled field
        const nameMatch = match.match(/([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/)
        if (nameMatch && nameMatch[1]) {
          const name = nameMatch[1]
          if (!removedItems.names.includes(name)) {
            removedItems.names.push(name)
          }
          sanitizedText = sanitizedText.replace(new RegExp(`\\b${name}\\b`, 'g'), '[CUSTOMER_NAME]')
        }
      })
    }
  })

  // Remove specific bank statement headers that might contain personal info
  const headerPatterns = [
    /Statement\s+for[\s:]+[^\n]+/gi,
    /Account\s+Summary\s+for[\s:]+[^\n]+/gi,
    /Customer\s+Information[\s:]+[^\n]+/gi
  ]

  headerPatterns.forEach(pattern => {
    sanitizedText = sanitizedText.replace(pattern, '[STATEMENT_HEADER]')
  })

  // Remove ZIP codes (only when clearly in address context)
  sanitizedText = sanitizedText.replace(/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g, '[STATE_ZIP]')

  // Clean up multiple consecutive whitespace
  sanitizedText = sanitizedText.replace(/\s+/g, ' ').trim()

  return {
    sanitizedText,
    removedItems
  }
}

/**
 * Validates that sensitive data has been properly removed
 */
export function validateSanitization(text: string): {
  isClean: boolean
  warnings: string[]
} {
  const warnings: string[] = []

  // Check for potential account numbers
  if (/\b\d{8,17}\b/.test(text)) {
    warnings.push('Potential account numbers detected')
  }

  // Check for potential SSNs
  if (/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/.test(text)) {
    warnings.push('Potential SSN detected')
  }

  // Check for email patterns
  if (/@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/.test(text)) {
    warnings.push('Potential email address detected')
  }

  // Check for phone patterns
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text)) {
    warnings.push('Potential phone number detected')
  }

  return {
    isClean: warnings.length === 0,
    warnings
  }
}