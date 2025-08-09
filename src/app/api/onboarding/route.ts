import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Use regular client for auth check
    const supabase = await createClient()
    
    // Create service role client for database operations (bypasses RLS)
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if email is verified
    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: 'Email verification required before creating company' },
        { status: 403 }
      )
    }

    const { companyName, ein, streetAddress, city, state, zipCode, accountingMethod } = await request.json()

    // Wait for user to be created in our users table (with retry)
    let existingUser = null
    let retryCount = 0
    const maxRetries = 5
    
    while (retryCount < maxRetries) {
      const { data: userCheck, error: userCheckError } = await serviceSupabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single()

      if (userCheck && !userCheckError) {
        existingUser = userCheck
        break
      }
      
      console.log(`User not found in public.users table, retry ${retryCount + 1}/${maxRetries}`)
      retryCount++
      
      if (retryCount < maxRetries) {
        // Wait 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    if (!existingUser) {
      console.log('User still not found after retries, creating manually...')
      // Create user record manually if trigger failed
      const { error: userCreateError } = await serviceSupabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email!,
          role: 'admin',
        })

      if (userCreateError) {
        console.error('User creation error:', userCreateError)
        return NextResponse.json(
          { error: 'Failed to create user profile', details: userCreateError.message },
          { status: 500 }
        )
      }
      
      console.log('User created manually in public.users table')
    } else {
      console.log('User found in public.users table')
    }

    console.log('Creating company manually...');

    // Create company manually instead of using RPC function
    const { data: company, error: companyError } = await serviceSupabase
      .from('companies')
      .insert({
        name: companyName,
        street_address: streetAddress || null,
        city: city || null,
        state: state || null,
        zip_code: zipCode || null,
        ein: ein || null,
        accounting_method: accountingMethod
      })
      .select()
      .single()

    if (companyError) {
      console.error('Company creation error:', companyError)
      return NextResponse.json(
        { error: 'Failed to create company', details: companyError.message },
        { status: 500 }
      )
    }

    console.log('Company created successfully:', company);

    // Create user-company relationship
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

    if (userCompanyError) {
      console.error('User-company creation error:', userCompanyError)
      return NextResponse.json(
        { error: 'Failed to create user-company relationship', details: userCompanyError.message },
        { status: 500 }
      )
    }

    console.log('User-company relationship created:', userCompany);

    // Create default chart of accounts manually
    console.log('Creating default chart of accounts...');
    
    const { data: chartAccounts, error: chartError } = await serviceSupabase
      .from('chart_of_accounts')
      .insert([
        // Assets (1000-1999)
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
          account_number: '1100',
          account_name: 'Accounts Receivable',
          account_type: 'asset',
          description: 'Amounts owed by customers',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '1200',
          account_name: 'Inventory',
          account_type: 'asset',
          description: 'Merchandise and materials held for sale',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '1300',
          account_name: 'Prepaid Expenses',
          account_type: 'asset',
          description: 'Expenses paid in advance',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '1400',
          account_name: 'Equipment',
          account_type: 'asset',
          description: 'Office equipment and machinery',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '1500',
          account_name: 'Accumulated Depreciation - Equipment',
          account_type: 'asset',
          description: 'Accumulated depreciation on equipment',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '1600',
          account_name: 'Vehicles',
          account_type: 'asset',
          description: 'Company vehicles',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '1700',
          account_name: 'Accumulated Depreciation - Vehicles',
          account_type: 'asset',
          description: 'Accumulated depreciation on vehicles',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '1800',
          account_name: 'Buildings',
          account_type: 'asset',
          description: 'Company buildings and structures',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '1900',
          account_name: 'Accumulated Depreciation - Buildings',
          account_type: 'asset',
          description: 'Accumulated depreciation on buildings',
          is_default: true
        },
        // Liabilities (2000-2999)
        {
          company_id: company.id,
          account_number: '2000',
          account_name: 'Accounts Payable',
          account_type: 'liability',
          description: 'Amounts owed to suppliers and vendors',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '2100',
          account_name: 'Notes Payable',
          account_type: 'liability',
          description: 'Short-term and long-term notes payable',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '2200',
          account_name: 'Accrued Expenses',
          account_type: 'liability',
          description: 'Expenses incurred but not yet paid',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '2300',
          account_name: 'Sales Tax Payable',
          account_type: 'liability',
          description: 'Sales tax collected but not yet remitted',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '2400',
          account_name: 'Payroll Taxes Payable',
          account_type: 'liability',
          description: 'Payroll taxes withheld but not yet paid',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '2500',
          account_name: 'Income Tax Payable',
          account_type: 'liability',
          description: 'Income taxes owed but not yet paid',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '2600',
          account_name: 'Unearned Revenue',
          account_type: 'liability',
          description: 'Revenue received in advance of services',
          is_default: true
        },
        // Equity (3000-3999)
        {
          company_id: company.id,
          account_number: '3000',
          account_name: 'Owner\'s Capital',
          account_type: 'equity',
          description: 'Owner\'s investment in the business',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '3100',
          account_name: 'Owner\'s Draws',
          account_type: 'equity',
          description: 'Owner\'s withdrawals from the business',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '3200',
          account_name: 'Retained Earnings',
          account_type: 'equity',
          description: 'Accumulated profits not distributed',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '3300',
          account_name: 'Common Stock',
          account_type: 'equity',
          description: 'Par value of common stock issued',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '3400',
          account_name: 'Paid-in Capital in Excess of Par',
          account_type: 'equity',
          description: 'Amount paid for stock in excess of par value',
          is_default: true
        },
        // Revenue (4000-4999)
        {
          company_id: company.id,
          account_number: '4000',
          account_name: 'Sales Revenue',
          account_type: 'revenue',
          description: 'Revenue from sales of goods or services',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '4100',
          account_name: 'Service Revenue',
          account_type: 'revenue',
          description: 'Revenue from providing services',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '4200',
          account_name: 'Interest Income',
          account_type: 'revenue',
          description: 'Interest earned on investments and bank accounts',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '4300',
          account_name: 'Rental Income',
          account_type: 'revenue',
          description: 'Income from renting property or equipment',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '4400',
          account_name: 'Other Income',
          account_type: 'revenue',
          description: 'Other miscellaneous income',
          is_default: true
        },
        // Expenses (5000-6999)
        {
          company_id: company.id,
          account_number: '5000',
          account_name: 'Cost of Goods Sold',
          account_type: 'expense',
          description: 'Direct costs of producing goods or services',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '5100',
          account_name: 'Office Supplies',
          account_type: 'expense',
          description: 'Office supplies and materials',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '5200',
          account_name: 'Rent Expense',
          account_type: 'expense',
          description: 'Rent for office space and facilities',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '5300',
          account_name: 'Utilities',
          account_type: 'expense',
          description: 'Electricity, water, gas, and other utilities',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '5400',
          account_name: 'Telephone & Internet',
          account_type: 'expense',
          description: 'Phone and internet service expenses',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '5500',
          account_name: 'Insurance',
          account_type: 'expense',
          description: 'Business insurance premiums',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '5600',
          account_name: 'Depreciation Expense',
          account_type: 'expense',
          description: 'Depreciation on fixed assets',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '5700',
          account_name: 'Wages & Salaries',
          account_type: 'expense',
          description: 'Employee wages and salaries',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '5800',
          account_name: 'Payroll Taxes',
          account_type: 'expense',
          description: 'Employer portion of payroll taxes',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '5900',
          account_name: 'Employee Benefits',
          account_type: 'expense',
          description: 'Health insurance and other employee benefits',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '6000',
          account_name: 'Advertising & Marketing',
          account_type: 'expense',
          description: 'Advertising and marketing expenses',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '6100',
          account_name: 'Travel & Entertainment',
          account_type: 'expense',
          description: 'Business travel and entertainment expenses',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '6200',
          account_name: 'Professional Services',
          account_type: 'expense',
          description: 'Legal, accounting, and consulting fees',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '6300',
          account_name: 'Repairs & Maintenance',
          account_type: 'expense',
          description: 'Repairs and maintenance expenses',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '6400',
          account_name: 'Interest Expense',
          account_type: 'expense',
          description: 'Interest on loans and credit lines',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '6500',
          account_name: 'Bank Charges',
          account_type: 'expense',
          description: 'Bank fees and service charges',
          is_default: true
        },
        {
          company_id: company.id,
          account_number: '6600',
          account_name: 'Miscellaneous Expense',
          account_type: 'expense',
          description: 'Other miscellaneous expenses',
          is_default: true
        }
      ])
      .select()

    if (chartError) {
      console.error('Chart of accounts creation error:', chartError)
      return NextResponse.json(
        { error: 'Failed to create chart of accounts', details: chartError.message },
        { status: 500 }
      )
    }

    console.log('Chart of accounts created successfully:', chartAccounts?.length, 'accounts');

    // Company details are already available from the creation step



    // Get the user data
    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('User fetch error:', userError)
      return NextResponse.json(
        { error: 'Failed to fetch user profile', details: userError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      company: company,
      user: userData 
    })
  } catch (error) {
    console.error('Onboarding API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}