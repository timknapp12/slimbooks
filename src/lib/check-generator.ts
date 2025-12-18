import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { formatDate } from '@/lib/date-utils'
import type { CheckPrintData } from '@/types/check'

export interface CheckPrintOptions {
  checks: CheckPrintData[]
  companyName?: string
  companyAddress?: string
}

// Standard check dimensions (3 checks per letter page)
const PAGE_WIDTH = 612 // US Letter width in points
const PAGE_HEIGHT = 792 // US Letter height in points
const CHECK_HEIGHT = 264 // 792 / 3 = 264 points per check (3.67 inches)
const STUB_HEIGHT = 96 // Top portion for record keeping

/**
 * Generates a printable PDF with checks
 * Standard format: 3 checks per page with stub on top of each check
 */
export async function generateChecksPDF(
  options: CheckPrintOptions
): Promise<Uint8Array> {
  const { checks, companyName = 'Your Company', companyAddress = '' } = options

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Draw a single check at the specified Y position
  const drawCheck = (
    page: ReturnType<typeof pdfDoc.addPage>,
    check: CheckPrintData,
    startY: number
  ) => {
    const leftMargin = 36
    const rightMargin = PAGE_WIDTH - 36
    const stubBottom = startY - STUB_HEIGHT
    const checkBottom = startY - CHECK_HEIGHT

    // ==================== STUB SECTION (Top) ====================
    // Stub background (light gray)
    page.drawRectangle({
      x: 0,
      y: stubBottom,
      width: PAGE_WIDTH,
      height: STUB_HEIGHT,
      color: rgb(0.97, 0.97, 0.97),
    })

    // Stub content - Record keeping info
    let stubY = startY - 15

    page.drawText(`Check #${check.check_number}`, {
      x: leftMargin,
      y: stubY,
      size: 10,
      font: boldFont,
      color: rgb(0, 0, 0),
    })

    page.drawText(formatDate(check.date), {
      x: rightMargin - 80,
      y: stubY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    })

    stubY -= 16

    page.drawText(`Pay to: ${check.payee_name}`, {
      x: leftMargin,
      y: stubY,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    })

    page.drawText(formatCurrency(check.amount), {
      x: rightMargin - 80,
      y: stubY,
      size: 10,
      font: boldFont,
      color: rgb(0, 0, 0),
    })

    stubY -= 14

    if (check.memo) {
      page.drawText(`Memo: ${check.memo}`, {
        x: leftMargin,
        y: stubY,
        size: 8,
        font,
        color: rgb(0.3, 0.3, 0.3),
      })
    }

    // Perforated line (dashed line between stub and check)
    const perfY = stubBottom
    for (let x = 0; x < PAGE_WIDTH; x += 8) {
      page.drawLine({
        start: { x, y: perfY },
        end: { x: x + 4, y: perfY },
        thickness: 0.5,
        color: rgb(0.6, 0.6, 0.6),
      })
    }

    // ==================== CHECK BODY SECTION ====================
    let checkY = stubBottom - 20

    // Company name and address (top left)
    page.drawText(companyName, {
      x: leftMargin,
      y: checkY,
      size: 11,
      font: boldFont,
      color: rgb(0, 0, 0),
    })

    if (companyAddress) {
      checkY -= 12
      const addressLines = companyAddress.split('\n')
      addressLines.forEach(line => {
        page.drawText(line, {
          x: leftMargin,
          y: checkY,
          size: 8,
          font,
          color: rgb(0.3, 0.3, 0.3),
        })
        checkY -= 10
      })
    }

    // Check number (top right)
    page.drawText(`${check.check_number}`, {
      x: rightMargin - 60,
      y: stubBottom - 20,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    })

    // Date (top right, below check number)
    page.drawText('DATE', {
      x: rightMargin - 120,
      y: stubBottom - 40,
      size: 8,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })

    page.drawText(formatDate(check.date), {
      x: rightMargin - 120,
      y: stubBottom - 52,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    })

    // Pay to the order of line
    const payToY = stubBottom - 70

    page.drawText('PAY TO THE', {
      x: leftMargin,
      y: payToY,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })

    page.drawText('ORDER OF', {
      x: leftMargin,
      y: payToY - 8,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })

    // Payee name
    page.drawText(check.payee_name, {
      x: leftMargin + 60,
      y: payToY - 4,
      size: 11,
      font: boldFont,
      color: rgb(0, 0, 0),
    })

    // Line under payee name
    page.drawLine({
      start: { x: leftMargin + 60, y: payToY - 10 },
      end: { x: rightMargin - 140, y: payToY - 10 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })

    // Amount box
    const amountBoxX = rightMargin - 130
    const amountBoxY = payToY - 15
    const amountBoxWidth = 100
    const amountBoxHeight = 20

    page.drawRectangle({
      x: amountBoxX,
      y: amountBoxY,
      width: amountBoxWidth,
      height: amountBoxHeight,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    })

    // Dollar sign
    page.drawText('$', {
      x: amountBoxX + 5,
      y: amountBoxY + 5,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    })

    // Amount (numeric)
    const amountStr = check.amount.toFixed(2)
    const amountWidth = boldFont.widthOfTextAtSize(amountStr, 12)
    page.drawText(amountStr, {
      x: amountBoxX + amountBoxWidth - amountWidth - 8,
      y: amountBoxY + 5,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    })

    // Amount in words line
    const wordsY = payToY - 35

    // Amount in words (truncate if too long)
    let amountWords = check.amount_in_words || ''
    const maxWordsWidth = rightMargin - leftMargin - 100
    while (
      font.widthOfTextAtSize(amountWords, 9) > maxWordsWidth &&
      amountWords.length > 0
    ) {
      amountWords = amountWords.slice(0, -1)
    }

    page.drawText(amountWords, {
      x: leftMargin,
      y: wordsY,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    })

    // Line under amount in words
    page.drawLine({
      start: { x: leftMargin, y: wordsY - 5 },
      end: { x: rightMargin - 36, y: wordsY - 5 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })

    page.drawText('DOLLARS', {
      x: rightMargin - 50,
      y: wordsY,
      size: 8,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })

    // Memo line
    const memoY = wordsY - 30

    page.drawText('MEMO', {
      x: leftMargin,
      y: memoY,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })

    if (check.memo) {
      page.drawText(check.memo, {
        x: leftMargin + 40,
        y: memoY,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      })
    }

    page.drawLine({
      start: { x: leftMargin + 40, y: memoY - 3 },
      end: { x: leftMargin + 200, y: memoY - 3 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })

    // Signature line
    const sigY = memoY
    const sigLineStart = rightMargin - 180
    const sigLineEnd = rightMargin - 36

    page.drawLine({
      start: { x: sigLineStart, y: sigY - 3 },
      end: { x: sigLineEnd, y: sigY - 3 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })

    page.drawText('AUTHORIZED SIGNATURE', {
      x: sigLineStart + 20,
      y: sigY - 12,
      size: 6,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })

    // MICR line placeholder (bottom of check)
    const micrY = checkBottom + 15

    page.drawText('C0000000000C A000000000A 0000000000C', {
      x: leftMargin + 100,
      y: micrY,
      size: 10,
      font,
      color: rgb(0.7, 0.7, 0.7),
    })

    page.drawText('(Sample MICR - Replace with actual bank info)', {
      x: leftMargin + 100,
      y: micrY - 10,
      size: 6,
      font,
      color: rgb(0.6, 0.6, 0.6),
    })

    // Bottom border of check
    page.drawLine({
      start: { x: 0, y: checkBottom },
      end: { x: PAGE_WIDTH, y: checkBottom },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    })
  }

  // Generate pages with checks (3 per page)
  for (let i = 0; i < checks.length; i += 3) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

    // Draw up to 3 checks on this page
    for (let j = 0; j < 3 && i + j < checks.length; j++) {
      const startY = PAGE_HEIGHT - j * CHECK_HEIGHT
      drawCheck(page, checks[i + j], startY)
    }
  }

  return await pdfDoc.save()
}

/**
 * Generate a single check PDF
 */
export async function generateSingleCheckPDF(
  check: CheckPrintData,
  companyName?: string,
  companyAddress?: string
): Promise<Uint8Array> {
  return generateChecksPDF({
    checks: [check],
    companyName,
    companyAddress,
  })
}

/**
 * Download the generated check PDF
 */
export async function downloadChecksPDF(
  pdfBytes: Uint8Array,
  filename: string = 'checks.pdf'
) {
  // Ensure Blob receives an ArrayBuffer (not ArrayBufferLike) with the exact view slice
  const arrayBuffer: ArrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Convert number to words for check amount
 * This is a client-side version - the database also has this function
 */
export function numberToWords(amount: number): string {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ]
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ]

  let dollars = Math.floor(amount)
  const cents = Math.round((amount - dollars) * 100)
  let result = ''

  if (dollars === 0) {
    result = 'Zero'
  } else {
    // Handle millions
    if (dollars >= 1000000) {
      const millions = Math.floor(dollars / 1000000)
      if (millions < 20) {
        result += ones[millions] + ' Million '
      } else {
        result += tens[Math.floor(millions / 10)]
        if (millions % 10 > 0) {
          result += '-' + ones[millions % 10]
        }
        result += ' Million '
      }
      dollars = dollars % 1000000
    }

    // Handle thousands
    if (dollars >= 1000) {
      const thousands = Math.floor(dollars / 1000)
      if (thousands < 20) {
        result += ones[thousands] + ' Thousand '
      } else {
        result += tens[Math.floor(thousands / 10)]
        if (thousands % 10 > 0) {
          result += '-' + ones[thousands % 10]
        }
        result += ' Thousand '
      }
      dollars = dollars % 1000
    }

    // Handle hundreds
    if (dollars >= 100) {
      result += ones[Math.floor(dollars / 100)] + ' Hundred '
      dollars = dollars % 100
    }

    // Handle tens and ones
    if (dollars >= 20) {
      result += tens[Math.floor(dollars / 10)]
      if (dollars % 10 > 0) {
        result += '-' + ones[dollars % 10]
      }
    } else if (dollars > 0) {
      result += ones[dollars]
    }
  }

  result =
    result.trim() + ' and ' + cents.toString().padStart(2, '0') + '/100 Dollars'

  return result
}
