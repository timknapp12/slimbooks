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

    const { companyName, ein, address, accountingMethod } = await request.json()

    // First, ensure user exists in our users table
    const { data: existingUser } = await serviceSupabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingUser) {
      // Create user record first
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
    }

    // Create company using service role (bypasses RLS)
    const { data: company, error: companyError } = await serviceSupabase
      .from('companies')
      .insert({
        name: companyName,
        ein,
        address,
        accounting_method: accountingMethod,
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

    // Update user with company_id using service role (bypasses RLS)
    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .update({
        company_id: company.id,
      })
      .eq('id', user.id)
      .select()

    if (userError) {
      console.error('User creation error:', userError)
      return NextResponse.json(
        { error: 'Failed to create user profile', details: userError.message },
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