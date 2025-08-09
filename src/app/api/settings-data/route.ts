import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    // Use regular client for auth check
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use service role client to get user and company data (bypasses RLS)
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .select(`
        id,
        email,
        role,
        company_id,
        companies (
          id,
          name,
          street_address,
          city,
          state,
          zip_code,
          ein,
          accounting_method
        )
      `)
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found', hasUser: false, hasCompany: false },
        { status: 404 }
      )
    }

    if (!userData.company_id) {
      return NextResponse.json(
        { error: 'No company', hasUser: true, hasCompany: false },
        { status: 200 }
      )
    }

    // Get all users in the company
    const { data: companyUsers, error: usersError } = await serviceSupabase
      .from('users')
      .select('id, email, role')
      .eq('company_id', userData.company_id)

    if (usersError) {
      console.error('Company users lookup error:', usersError)
    }

    return NextResponse.json({
      hasUser: true,
      hasCompany: true,
      user: userData,
      companyUsers: companyUsers || []
    })
  } catch (error) {
    console.error('Settings data API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}