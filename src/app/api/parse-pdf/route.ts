import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractTextFromPDF } from '@/lib/pdf-processor'
import { parseTransactionsWithAI } from '@/lib/ai-parser'
import { sanitizeBankStatementText, validateSanitization } from '@/lib/data-sanitizer'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const companyId = formData.get('companyId') as string

    if (!file || !companyId) {
      return NextResponse.json(
        { error: 'File and company ID are required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      )
    }

    // Check if user has access to this company
    const { data: userCompany, error: companyError } = await supabase
      .from('user_companies')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single()

    if (companyError || !userCompany || userCompany.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Only admins can upload bank statements.' },
        { status: 403 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract text from PDF
    const extractedText = await extractTextFromPDF(buffer)
    
    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not extract text from PDF. The file might be scanned or corrupted.' },
        { status: 400 }
      )
    }

    // Sanitize the extracted text to remove personal/sensitive information
    const sanitizationResult = sanitizeBankStatementText(extractedText)
    const { sanitizedText, removedItems } = sanitizationResult
    
    // Validate that sanitization was effective
    const validation = validateSanitization(sanitizedText)
    if (!validation.isClean) {
      console.warn('Sanitization warnings:', validation.warnings)
    }
    
    // Log what was removed for debugging (in development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('Sanitization removed:', {
        accountNumbers: removedItems.accountNumbers.length,
        names: removedItems.names.length,
        addresses: removedItems.addresses.length,
        phoneNumbers: removedItems.phoneNumbers.length,
        emails: removedItems.emails.length,
        ssns: removedItems.ssns.length,
        routingNumbers: removedItems.routingNumbers.length
      })
    }

    // Get chart of accounts for better categorization
    const { data: chartOfAccounts } = await supabase
      .from('chart_of_accounts')
      .select('account_name, account_type')
      .eq('company_id', companyId)
      .eq('is_active', true)

    // Organize categories by type for AI
    const availableCategories = {
      income: chartOfAccounts?.filter((acc: { account_type: string }) => acc.account_type === 'revenue').map((acc: { account_name: string }) => acc.account_name) || [],
      expense: chartOfAccounts?.filter((acc: { account_type: string }) => acc.account_type === 'expense').map((acc: { account_name: string }) => acc.account_name) || []
    }

    // Parse transactions using AI with available categories (using sanitized text)
    const transactions = await parseTransactionsWithAI(sanitizedText, availableCategories)
    
    if (!transactions || transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions found in the PDF. Please check if this is a valid bank statement.' },
        { status: 400 }
      )
    }

    // Upload original file to Supabase Storage for record keeping
    const fileName = `${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('bank-statements')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
      })

    if (uploadError) {
      console.error('Error uploading PDF to storage:', uploadError)
      // Continue without storing the file - the parsing is more important
    }

    return NextResponse.json({
      success: true,
      transactions,
      extractedText: extractedText.substring(0, 1000), // First 1000 chars for debugging
      fileName: uploadData?.path || fileName,
    })
  } catch (error) {
    console.error('Error processing PDF:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process PDF',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

