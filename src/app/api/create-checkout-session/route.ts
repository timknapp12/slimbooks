import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { getRequiredTier, PRICING_TIERS } from '@/lib/subscription-pricing'

export async function POST(request: NextRequest) {
  try {
    const { priceId, tierId, isYearly } = await request.json()
    console.log('Creating checkout session with priceId:', priceId, 'tierId:', tierId, 'isYearly:', isYearly)
    
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's companies count
    const { data: userCompanies } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)

    const companyCount = userCompanies?.length || 0

    // Get user's default company
    const { data: userCompany } = await supabase
      .from('user_companies')
      .select('company_id, companies(name)')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single()

    if (!userCompany?.company_id) {
      return NextResponse.json({ error: 'No default company found' }, { status: 400 })
    }

    // Validate the requested tier can handle the user's company count
    const selectedTier = PRICING_TIERS.find(tier => tier.id === tierId)
    if (!selectedTier) {
      return NextResponse.json({ error: 'Invalid pricing tier' }, { status: 400 })
    }

    if (selectedTier.maxCompanies !== -1 && companyCount > selectedTier.maxCompanies) {
      const requiredTier = getRequiredTier(companyCount)
      return NextResponse.json({ 
        error: `You have ${companyCount} companies but selected a plan that supports only ${selectedTier.maxCompanies}. Please select the ${requiredTier.name} plan or higher.`,
        requiredTier: requiredTier.id
      }, { status: 400 })
    }

    // Use the provided priceId or get it from the tier
    const finalPriceId = priceId || (isYearly ? selectedTier.stripePriceIdYearly : selectedTier.stripePriceIdMonthly)
    
    if (!finalPriceId) {
      return NextResponse.json({ error: 'Price ID not found for selected plan' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      success_url: `${request.nextUrl.origin}/settings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/settings`,
      customer_email: user.email,
      metadata: {
        company_id: userCompany.company_id,
        user_id: user.id,
        tier_id: selectedTier.id,
        company_count: companyCount.toString(),
        is_yearly: isYearly ? 'true' : 'false'
      },
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error: unknown) {
    console.error('Error creating checkout session:', error)
    const errorMessage = error instanceof Error ? error.message : 'An error occurred'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}