'use client'

import { useEffect, useState, useCallback } from 'react'

export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Building2, Users, CreditCard } from 'lucide-react'

interface Company {
  id: string
  name: string
  address: string
  ein: string
  accounting_method: 'cash' | 'accrual'
}

interface User {
  id: string
  email: string
  role: 'admin' | 'staff'
}

export default function SettingsPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [managingSubscription, setManagingSubscription] = useState(false)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [priceId, setPriceId] = useState<string | null>(null)
  const { toast } = useToast()
  const supabase = createClient()

  // Form state for company
  const [companyForm, setCompanyForm] = useState({
    name: '',
    address: '',
    ein: '',
    accounting_method: 'cash' as 'cash' | 'accrual'
  })

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id, companies(*)')
        .eq('id', user.id)
        .single()

      if (userError || !userData) {
        console.error('User not found in users table:', userError)
        window.location.href = '/onboarding'
        return
      }

      if (!userData?.company_id) {
        window.location.href = '/onboarding'
        return
      }

      const companyData = userData.companies as unknown as Company
      setCompany(companyData)
      setCompanyForm({
        name: companyData.name || '',
        address: companyData.address || '',
        ein: companyData.ein || '',
        accounting_method: companyData.accounting_method || 'cash'
      })

      // Fetch all users in the company
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('company_id', userData.company_id)

      setUsers(usersData || [])

      // Check subscription status (handle gracefully if table doesn't exist)
      try {
        // First check if the table exists by trying a simple query
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('stripe_customer_id, status')
          .eq('company_id', userData.company_id)
          .maybeSingle() // Use maybeSingle instead of single to avoid errors if no data

        if (subscriptionError) {
          console.warn('Subscriptions table not available:', subscriptionError)
          setHasSubscription(false)
        } else {
          setHasSubscription(!!subscriptionData?.stripe_customer_id && subscriptionData.status === 'active')
        }
      } catch (error) {
        console.warn('Subscriptions table not available:', error)
        setHasSubscription(false)
      }

      // Fetch pricing plan (handle gracefully if table doesn't exist)
      try {
        const { data: pricingData, error: pricingError } = await supabase
          .from('pricing_plans')
          .select('stripe_price_id')
          .eq('is_active', true)
          .maybeSingle() // Use maybeSingle instead of single to avoid errors if no data

        if (pricingError) {
          console.warn('Pricing plans table not available:', pricingError)
          setPriceId(null)
        } else {
          setPriceId(pricingData?.stripe_price_id || null)
        }
      } catch (error) {
        console.warn('Pricing plans table not available:', error)
        setPriceId(null)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch settings data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [supabase, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (!company) return

      const { error } = await supabase
        .from('companies')
        .update({
          name: companyForm.name,
          address: companyForm.address,
          ein: companyForm.ein,
          accounting_method: companyForm.accounting_method
        })
        .eq('id', company.id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Company information updated successfully',
      })

      fetchData()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update company information'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleManageSubscription = async () => {
    setManagingSubscription(true)
    
    try {
      console.log('Making portal session request to:', window.location.origin + '/api/create-portal-session')
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensure cookies are sent
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 401) {
          toast({
            title: 'Authentication Required',
            description: 'Please sign in to access billing features.',
            variant: 'destructive',
          })
          window.location.href = '/login'
          return
        }
        if (errorData.code === 'NO_SUBSCRIPTION') {
          setHasSubscription(false)
          toast({
            title: 'No Subscription',
            description: 'You need to subscribe first to manage your subscription.',
            variant: 'destructive',
          })
          return
        }
        throw new Error('Failed to create portal session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Error creating portal session:', error)
      toast({
        title: 'Error',
        description: 'Failed to open subscription management. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setManagingSubscription(false)
    }
  }

  const handleSubscribe = async () => {
    if (!priceId) {
      toast({
        title: 'Error',
        description: 'Pricing information not available. Please try again.',
        variant: 'destructive',
      })
      return
    }

    setManagingSubscription(true)
    
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: priceId
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { sessionId } = await response.json()
      // Redirect to Stripe Checkout
      const stripe = await import('@stripe/stripe-js').then(m => m.loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!))
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId })
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      toast({
        title: 'Error',
        description: 'Failed to start subscription. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setManagingSubscription(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your company settings and preferences
        </p>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                Update your company details and accounting preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateCompany} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ein">EIN</Label>
                    <Input
                      id="ein"
                      value={companyForm.ein}
                      onChange={(e) => setCompanyForm({ ...companyForm, ein: e.target.value })}
                      placeholder="XX-XXXXXXX"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Business Address</Label>
                  <Input
                    id="address"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    placeholder="123 Main St, City, State, ZIP"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountingMethod">Accounting Method *</Label>
                  <Select 
                    value={companyForm.accounting_method} 
                    onValueChange={(value: 'cash' | 'accrual') => setCompanyForm({ ...companyForm, accounting_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash Basis</SelectItem>
                      <SelectItem value="accrual">Accrual Basis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage users and their permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{user.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Role: {user.role === 'admin' ? 'Administrator' : 'Staff'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin' 
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-secondary text-secondary-foreground'
                      }`}>
                        {user.role === 'admin' ? 'Admin' : 'Staff'}
                      </span>
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Billing & Subscription
              </CardTitle>
              <CardDescription>
                Manage your subscription and billing information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!company ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Company Setup Required</h3>
                  <p className="text-muted-foreground mb-4">
                    You need to set up your company information before accessing billing features.
                  </p>
                  <Button onClick={() => window.location.href = '/onboarding'}>
                    Complete Company Setup
                  </Button>
                </div>
              ) : (
              <div className="space-y-6">
                <div className="p-6 border rounded-lg bg-blue-50 dark:bg-blue-950">
                  <h3 className="text-lg font-semibold mb-2">Basic Plan</h3>
                  <p className="text-muted-foreground mb-4">
                    Perfect for small businesses getting started with accounting
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-3xl font-bold">$29</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    {hasSubscription ? (
                      <Button onClick={handleManageSubscription} disabled={managingSubscription}>
                        {managingSubscription ? 'Loading...' : 'Manage Subscription'}
                      </Button>
                    ) : (
                      <Button onClick={handleSubscribe} disabled={managingSubscription}>
                        {managingSubscription ? 'Loading...' : 'Subscribe Now'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Plan Features</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Unlimited transactions</li>
                    <li>• Financial reports (P&L, Balance Sheet, Cash Flow)</li>
                    <li>• Bank statement import</li>
                    <li>• Payables & receivables tracking</li>
                    <li>• Multiple users</li>
                    <li>• Email support</li>
                  </ul>
                </div>

                {hasSubscription && (
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2">Payment Method</h4>
                    <p className="text-sm text-muted-foreground">
                      Payment method on file
                    </p>
                    <Button variant="outline" className="mt-2">
                      Update Payment Method
                    </Button>
                  </div>
                )}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}