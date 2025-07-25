import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    const supabase = await createClient()
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Testing company creation for user:', user.id)

    // Test 1: Check if user exists in public.users
    const { data: userCheck, error: userError } = await serviceSupabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    console.log('User check result:', { userCheck, userError })

    // Test 2: Try to create a company manually step by step
    console.log('Creating company manually...')
    
    // Step 2a: Create company
    const { data: company, error: companyError } = await serviceSupabase
      .from('companies')
      .insert({
        name: 'Test Company',
        address: 'Test Address',
        ein: '12-3456789',
        accounting_method: 'cash'
      })
      .select()
      .single()

    console.log('Company creation result:', { company, companyError })

    if (companyError) {
      return NextResponse.json({ 
        error: 'Company creation failed', 
        details: companyError 
      }, { status: 500 })
    }

    // Step 2b: Create user-company relationship
    const { data: userCompany, error: userCompanyError } = await serviceSupabase
      .from('user_companies')
      .insert({
        user_id: user.id,
        company_id: company.id,
        role: 'admin',
        is_default: true
      })
      .select()
      .single()

    console.log('User-company creation result:', { userCompany, userCompanyError })

    if (userCompanyError) {
      return NextResponse.json({ 
        error: 'User-company creation failed', 
        details: userCompanyError 
      }, { status: 500 })
    }

    // Step 2c: Try to create chart of accounts manually
    console.log('Creating chart of accounts manually...')
    
    const { data: chartAccounts, error: chartError } = await serviceSupabase
      .from('chart_of_accounts')
      .insert([
        {
          company_id: company.id,
          account_number: '1000',
          account_name: 'Cash',
          account_type: 'asset',
          description: 'Cash on hand and in bank accounts',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '2000',
          account_name: 'Accounts Payable',
          account_type: 'liability',
          description: 'Amounts owed to suppliers and vendors',
          is_default: true
        }
      ])
      .select()

    console.log('Chart of accounts creation result:', { chartAccounts, chartError })

    if (chartError) {
      return NextResponse.json({ 
        error: 'Chart of accounts creation failed', 
        details: chartError 
      }, { status: 500 })
    }

    // Test 3: Try the RPC function
    console.log('Testing RPC function...')
    
    const { data: rpcResult, error: rpcError } = await serviceSupabase
      .rpc('create_company_with_user', {
        user_uuid: user.id,
        company_name: 'Test Company RPC',
        company_address: 'Test Address RPC',
        company_ein: '98-7654321',
        company_accounting_method: 'cash'
      })

    console.log('RPC function result:', { rpcResult, rpcError })

    return NextResponse.json({
      success: true,
      manualCompany: company,
      rpcCompany: rpcResult,
      chartAccounts: chartAccounts
    })

  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 