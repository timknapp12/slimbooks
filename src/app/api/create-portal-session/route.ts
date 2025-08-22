import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  console.log('Portal session API route hit')
  console.log(
    'Cookies received:',
    request.cookies.getAll().map(c => c.name)
  )
  console.log(
    'Auth cookies:',
    request.cookies
      .getAll()
      .filter(c => c.name.includes('auth'))
      .map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' }))
  )

  try {
    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    console.log('Auth check:', { user: user?.id, authError })

    if (authError || !user) {
      console.log('Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      )
    }

    // Get user's default company
    const { data: userCompany, error: userError } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single()

    if (userError || !userCompany?.company_id) {
      return NextResponse.json(
        { error: 'No default company found' },
        { status: 404 }
      )
    }

    // Get the company's Stripe customer ID from subscriptions
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('company_id', userCompany.company_id)
      .single()

    if (subscriptionError || !subscriptionData?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No subscription found', code: 'NO_SUBSCRIPTION' },
        { status: 404 }
      )
    }

    // Create Stripe customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscriptionData.stripe_customer_id,
      return_url: `${request.nextUrl.origin}/settings?tab=billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('Error creating portal session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
