/**
 * Subscription Pricing Logic
 * 
 * This module handles tiered pricing based on the number of companies
 * a user has access to.
 */

export interface PricingTier {
  id: string
  name: string
  description: string
  maxCompanies: number
  monthlyPrice: number
  yearlyPrice: number
  features: string[]
  stripePriceIdMonthly?: string
  stripePriceIdYearly?: string
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for solo entrepreneurs and small businesses',
    maxCompanies: 1,
    monthlyPrice: 29,
    yearlyPrice: 290, // 2 months free
    features: [
      'Up to 1 company',
      'Unlimited transactions',
      'Financial reports (P&L, Balance Sheet, Cash Flow)',
      'Bank statement import',
      'Customer & vendor management',
      'Invoice creation & tracking',
      'Expense tracking with receipts',
      'Email support'
    ],
    stripePriceIdMonthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    stripePriceIdYearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Ideal for growing businesses with multiple entities',
    maxCompanies: 5,
    monthlyPrice: 79,
    yearlyPrice: 790, // 2 months free
    features: [
      'Up to 5 companies',
      'Everything in Starter',
      'Advanced reporting & analytics',
      'Recurring expense automation',
      'Multi-company consolidation',
      'Priority email support',
      'Phone support'
    ],
    stripePriceIdMonthly: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID,
    stripePriceIdYearly: process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations with complex needs',
    maxCompanies: -1, // Unlimited
    monthlyPrice: 199,
    yearlyPrice: 1990, // 2 months free
    features: [
      'Unlimited companies',
      'Everything in Professional',
      'Custom chart of accounts',
      'Advanced user permissions',
      'API access',
      'Custom integrations',
      'Dedicated account manager',
      '24/7 priority support'
    ],
    stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    stripePriceIdYearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID
  }
]

/**
 * Determines the required pricing tier based on the number of companies
 */
export function getRequiredTier(companyCount: number): PricingTier {
  for (const tier of PRICING_TIERS) {
    if (tier.maxCompanies === -1 || companyCount <= tier.maxCompanies) {
      return tier
    }
  }
  // Fallback to enterprise if somehow no tier matches
  return PRICING_TIERS[PRICING_TIERS.length - 1]
}

/**
 * Gets the current tier for a user based on their subscription
 */
export function getCurrentTier(subscription: { stripe_price_id?: string } | null): PricingTier | null {
  if (!subscription || !subscription.stripe_price_id) {
    return null
  }

  const priceId = subscription.stripe_price_id
  
  for (const tier of PRICING_TIERS) {
    if (tier.stripePriceIdMonthly === priceId || tier.stripePriceIdYearly === priceId) {
      return tier
    }
  }
  
  return null
}

/**
 * Checks if a user can add more companies based on their current subscription
 */
export function canAddCompany(currentCompanyCount: number, currentTier: PricingTier | null): boolean {
  if (!currentTier) {
    return false // No subscription
  }
  
  if (currentTier.maxCompanies === -1) {
    return true // Unlimited
  }
  
  return currentCompanyCount < currentTier.maxCompanies
}

/**
 * Gets the next tier a user needs to upgrade to
 */
export function getUpgradeTier(currentCompanyCount: number, currentTier: PricingTier | null): PricingTier | null {
  const requiredTier = getRequiredTier(currentCompanyCount + 1)
  
  if (!currentTier) {
    return requiredTier
  }
  
  // If current tier can handle the new company count, no upgrade needed
  if (currentTier.maxCompanies === -1 || currentCompanyCount < currentTier.maxCompanies) {
    return null
  }
  
  // Find the next tier up
  const currentTierIndex = PRICING_TIERS.findIndex(tier => tier.id === currentTier.id)
  if (currentTierIndex === -1 || currentTierIndex === PRICING_TIERS.length - 1) {
    return null // Already on highest tier or tier not found
  }
  
  return PRICING_TIERS[currentTierIndex + 1]
}

/**
 * Calculates the prorated amount for an upgrade
 */
export function calculateProration(
  currentTier: PricingTier,
  newTier: PricingTier,
  isYearly: boolean,
  daysRemainingInPeriod: number,
  totalDaysInPeriod: number
): number {
  const currentPrice = isYearly ? currentTier.yearlyPrice : currentTier.monthlyPrice
  const newPrice = isYearly ? newTier.yearlyPrice : newTier.monthlyPrice
  
  const priceDifference = newPrice - currentPrice
  const prorationFactor = daysRemainingInPeriod / totalDaysInPeriod
  
  return Math.round(priceDifference * prorationFactor * 100) / 100 // Round to 2 decimal places
}

/**
 * Gets pricing information for display
 */
export function getPricingDisplay(tier: PricingTier, isYearly: boolean = false): {
  price: number
  period: string
  savings?: string
} {
  if (isYearly) {
    const monthlyEquivalent = tier.yearlyPrice / 12
    const monthlySavings = tier.monthlyPrice - monthlyEquivalent
    const yearlySavings = monthlySavings * 12
    
    return {
      price: tier.yearlyPrice,
      period: 'year',
      savings: `Save $${Math.round(yearlySavings)} per year`
    }
  }
  
  return {
    price: tier.monthlyPrice,
    period: 'month'
  }
}

/**
 * Validates if a user's current subscription allows their company count
 */
export function validateSubscriptionLimits(
  companyCount: number,
  currentTier: PricingTier | null
): {
  isValid: boolean
  message?: string
  requiredTier?: PricingTier
} {
  if (!currentTier) {
    return {
      isValid: false,
      message: 'No active subscription found',
      requiredTier: getRequiredTier(companyCount)
    }
  }
  
  if (currentTier.maxCompanies === -1) {
    return { isValid: true } // Unlimited
  }
  
  if (companyCount > currentTier.maxCompanies) {
    const requiredTier = getRequiredTier(companyCount)
    return {
      isValid: false,
      message: `Your current ${currentTier.name} plan supports up to ${currentTier.maxCompanies} ${currentTier.maxCompanies === 1 ? 'company' : 'companies'}. You have ${companyCount} ${companyCount === 1 ? 'company' : 'companies'}.`,
      requiredTier
    }
  }
  
  return { isValid: true }
}