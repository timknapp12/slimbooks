import { NextRequest, NextResponse } from 'next/server'
import { generateFinancialReportPDF } from '@/lib/pdf-generator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyName, dateFrom, dateTo, accountingMethod, reportData } = body

    // Validate required fields
    if (!dateFrom || !dateTo || !accountingMethod || !reportData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate PDF
    const pdfBytes = await generateFinancialReportPDF({
      companyName,
      dateFrom,
      dateTo,
      accountingMethod,
      reportData,
    })

    // Return PDF as response
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="financial-report-${dateFrom}-to-${dateTo}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
} 