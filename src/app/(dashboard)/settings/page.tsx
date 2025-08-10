'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Building2, Users, CreditCard, Plus, Edit2, Check, X } from 'lucide-react'
import { useCompany } from '@/contexts/CompanyContext'
import ChartOfAccounts from '@/components/chart-of-accounts'
import { SimpleEIN } from '@/components/ein-input'
import { US_STATES } from '@/lib/us-states'



interface User {
  id: string
  email: string
  role: 'admin' | 'staff'
}

function SettingsPageContent() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [managingSubscription, setManagingSubscription] = useState(false)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [priceId, setPriceId] = useState<string | null>(null)
  const [showAddCompany, setShowAddCompany] = useState(false)
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [editingCompanyForm, setEditingCompanyForm] = useState({
    name: '',
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    ein: '',
    accounting_method: 'cash' as 'cash' | 'accrual'
  })
  const { toast } = useToast()
  const supabase = createClient()
  const { currentCompany, userCompanies, refreshCompanies } = useCompany()
  const searchParams = useSearchParams()

  // Form state for new company
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: '',
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    ein: '',
    accounting_method: 'cash' as 'cash' | 'accrual'
  })

  // Validation state
  const [editingEinValid, setEditingEinValid] = useState(true)
  const [newCompanyEinValid, setNewCompanyEinValid] = useState(true)

  const fetchData = useCallback(async () => {
    if (!currentCompany) return

    try {
      setLoading(true)

      // Fetch users for the current company
      const { data: usersData, error: usersError } = await supabase
        .from('user_companies')
        .select(`
          id,
          user_id,
          role,
          user:users(
            id,
            email
          )
        `)
        .eq('company_id', currentCompany.id)

      if (usersError) {
        console.error('Error fetching users:', usersError)
        toast({
          title: 'Error',
          description: 'Failed to fetch users',
          variant: 'destructive',
        })
        return
      }

      // Transform the data to match the User interface
      const users: User[] = usersData?.map((uc: { user_id: string; user: { email: string }; role: string }) => ({
        id: uc.user_id,
        email: uc.user.email,
        role: uc.role
      })) || []

      setUsers(users)

      // Fetch subscription info - wrap in try-catch to handle RLS issues gracefully
      // COMMENTED OUT FOR NOW - subscription functionality will be added later
      /*
      try {
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('company_id', currentCompany.id)
          .single()

        if (subscriptionError) {
          if (subscriptionError.code === 'PGRST116') {
            // No subscription found - this is normal
            setHasSubscription(false)
            // Fetch default pricing plan for new subscriptions
            const { data: pricingPlan } = await supabase
              .from('pricing_plans')
              .select('stripe_price_id')
              .eq('is_active', true)
              .single()
            setPriceId(pricingPlan?.stripe_price_id || null)
          } else {
            console.error('Error fetching subscription:', subscriptionError)
            // Don't show error toast for subscription issues, just log it
            setHasSubscription(false)
            setPriceId(null)
          }
        } else if (subscriptionData) {
          setHasSubscription(true)
          // Use stripe_price_id instead of price_id
          setPriceId(subscriptionData.stripe_price_id)
        } else {
          setHasSubscription(false)
          setPriceId(null)
        }
      } catch (error) {
        // Handle any unexpected errors (like RLS policy issues)
        console.warn('Subscription fetch failed, continuing without subscription data:', error)
        setHasSubscription(false)
        setPriceId(null)
      }
      */
      
      // Set default values for now
      setHasSubscription(false)
      setPriceId('price_test_basic_plan')
    } catch (error) {
      console.error('Error in fetchData:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [supabase, toast, currentCompany])

  useEffect(() => {
    if (currentCompany) {
      fetchData()
    }
  }, [fetchData, currentCompany])

  // Check URL parameters for tab and add company form
  useEffect(() => {
    const tab = searchParams.get('tab')
    const addCompany = searchParams.get('addCompany')
    
    if (tab === 'companies') {
      // Set the companies tab as active (this will be handled by the Tabs component)
      // The tab will be set via the defaultValue prop
    }
    
    if (addCompany === 'true') {
      setShowAddCompany(true)
    }
  }, [searchParams])



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

  const handleStartEditCompany = (userCompany: { company_id: string; company: { name: string; street_address?: string | null; city?: string | null; state?: string | null; zip_code?: string | null; ein: string; accounting_method: 'cash' | 'accrual' } }) => {
    setEditingCompanyId(userCompany.company_id)
    
    setEditingCompanyForm({
      name: userCompany.company.name || '',
      street_address: userCompany.company.street_address || '',
      city: userCompany.company.city || '',
      state: userCompany.company.state || '',
      zip_code: userCompany.company.zip_code || '',
      ein: userCompany.company.ein || '',
      accounting_method: userCompany.company.accounting_method || 'cash'
    })
  }

  const handleCancelEditCompany = () => {
    setEditingCompanyId(null)
    setEditingCompanyForm({
      name: '',
      street_address: '',
      city: '',
      state: '',
      zip_code: '',
      ein: '',
      accounting_method: 'cash'
    })
  }

  const handleSaveEditCompany = async () => {
    if (!editingCompanyId) return

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: editingCompanyForm.name,
          street_address: editingCompanyForm.street_address || null,
          city: editingCompanyForm.city || null,
          state: editingCompanyForm.state || null,
          zip_code: editingCompanyForm.zip_code || null,
          ein: editingCompanyForm.ein,
          accounting_method: editingCompanyForm.accounting_method
        })
        .eq('id', editingCompanyId)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Company updated successfully',
      })

      setEditingCompanyId(null)
      setEditingCompanyForm({
        name: '',
        street_address: '',
        city: '',
        state: '',
        zip_code: '',
        ein: '',
        accounting_method: 'cash'
      })
      await refreshCompanies()
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update company',
        variant: 'destructive',
      })
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

      <Tabs defaultValue={searchParams.get('tab') || "companies"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="chart-of-accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>



        <TabsContent value="companies">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Management
              </CardTitle>
              <CardDescription>
                Manage your companies and switch between them
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userCompanies.map((userCompany) => (
                  <div key={userCompany.company_id} className="flex items-center justify-between p-4 border rounded-lg">
                    {editingCompanyId === userCompany.company_id ? (
                      // Edit mode
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`edit-company-name-${userCompany.company_id}`}>Company Name *</Label>
                            <Input
                              id={`edit-company-name-${userCompany.company_id}`}
                              value={editingCompanyForm.name}
                              onChange={(e) => setEditingCompanyForm({ ...editingCompanyForm, name: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <SimpleEIN
                              id={`edit-company-ein-${userCompany.company_id}`}
                              value={editingCompanyForm.ein}
                              onValueChangeAction={(value) => setEditingCompanyForm({ ...editingCompanyForm, ein: value })}
                              onValidationChange={setEditingEinValid}
                              nextInputId={`edit-company-street-${userCompany.company_id}`}
                            />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor={`edit-company-street-${userCompany.company_id}`}>Street Address</Label>
                            <Input
                              id={`edit-company-street-${userCompany.company_id}`}
                              value={editingCompanyForm.street_address}
                              onChange={(e) => setEditingCompanyForm({ ...editingCompanyForm, street_address: e.target.value })}
                              placeholder="123 Main St"
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor={`edit-company-city-${userCompany.company_id}`}>City</Label>
                              <Input
                                id={`edit-company-city-${userCompany.company_id}`}
                                value={editingCompanyForm.city}
                                onChange={(e) => setEditingCompanyForm({ ...editingCompanyForm, city: e.target.value })}
                                placeholder="San Francisco"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-company-state-${userCompany.company_id}`}>State</Label>
                              <Select
                                value={editingCompanyForm.state}
                                onValueChange={(value) => setEditingCompanyForm({ ...editingCompanyForm, state: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                                <SelectContent>
                                  {US_STATES.map((state) => (
                                    <SelectItem key={state.code} value={state.code}>
                                      {state.name} ({state.code})
                                    </SelectItem>
                                  ))}                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor={`edit-company-zip-${userCompany.company_id}`}>ZIP Code</Label>
                              <Input
                                id={`edit-company-zip-${userCompany.company_id}`}
                                value={editingCompanyForm.zip_code}
                                onChange={(e) => setEditingCompanyForm({ ...editingCompanyForm, zip_code: e.target.value })}
                                placeholder="12345"
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`edit-company-accounting-${userCompany.company_id}`}>Accounting Method</Label>
                          <Select
                            value={editingCompanyForm.accounting_method}
                            onValueChange={(value: 'cash' | 'accrual') => 
                              setEditingCompanyForm({ ...editingCompanyForm, accounting_method: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                                <SelectContent>
                                  {US_STATES.map((state) => (
                                    <SelectItem key={state.code} value={state.code}>
                                      {state.name} ({state.code})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleSaveEditCompany} 
                            size="sm"
                            disabled={!editingEinValid}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Save
                          </Button>
                          <Button onClick={handleCancelEditCompany} variant="outline" size="sm">
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div>
                          <p className="font-medium">{userCompany.company.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Role: {userCompany.role === 'admin' ? 'Administrator' : 'Staff'}
                            {userCompany.is_default && ' • Default'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleStartEditCompany(userCompany)}
                            variant="ghost"
                            size="sm"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            userCompany.role === 'admin' 
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-secondary text-secondary-foreground'
                          }`}>
                            {userCompany.role === 'admin' ? 'Admin' : 'Staff'}
                          </span>
                          {userCompany.is_default && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Default
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
                
                {!showAddCompany && (
                  <div className="pt-4 border-t">
                    <Button 
                      onClick={() => setShowAddCompany(true)}
                      className="w-full"
                      variant="outline"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add New Company
                    </Button>
                  </div>
                )}

                {showAddCompany && (
                  <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-4">Add New Company</h4>
                    <form onSubmit={async (e) => {
                      e.preventDefault()
                      try {
                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) return

                        // Check if email is verified
                        if (!user.email_confirmed_at) {
                          toast({
                            title: 'Email verification required',
                            description: 'Please verify your email address before creating a company.',
                            variant: 'destructive',
                          })
                          return
                        }

                        // Create service role client for database operations (bypasses RLS)
                        const serviceSupabase = createServiceClient(
                          process.env.NEXT_PUBLIC_SUPABASE_URL!,
                          process.env.SUPABASE_SERVICE_ROLE_KEY!
                        )

                        // Create company manually
                        const { data: company, error: companyError } = await serviceSupabase
                          .from('companies')
                          .insert({
                            name: newCompanyForm.name,
                            street_address: newCompanyForm.street_address || null,
                            city: newCompanyForm.city || null,
                            state: newCompanyForm.state || null,
                            zip_code: newCompanyForm.zip_code || null,
                            ein: newCompanyForm.ein || null,
                            accounting_method: newCompanyForm.accounting_method
                          })
                          .select()
                          .single()

                        if (companyError) throw companyError

                        // Create user-company relationship
                        const { error: userCompanyError } = await serviceSupabase
                          .from('user_companies')
                          .insert({
                            user_id: user.id,
                            company_id: company.id,
                            role: 'admin',
                            is_default: false
                          })

                        if (userCompanyError) throw userCompanyError

                        // Create default chart of accounts
                        const { error: chartError } = await serviceSupabase
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

                        if (chartError) throw chartError

                        toast({
                          title: 'Success',
                          description: 'Company created successfully',
                        })

                        setShowAddCompany(false)
                        setNewCompanyForm({ name: '', street_address: '', city: '', state: '', zip_code: '', ein: '', accounting_method: 'cash' })
                        await refreshCompanies()
                      } catch (error) {
                        console.error('Company creation error:', error)
                        toast({
                          title: 'Error',
                          description: 'Failed to create company',
                          variant: 'destructive',
                        })
                      }
                    }}>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="newCompanyName">Company Name *</Label>
                          <Input
                            id="newCompanyName"
                            value={newCompanyForm.name}
                            onChange={(e) => setNewCompanyForm({ ...newCompanyForm, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="newCompanyStreet">Street Address</Label>
                            <Input
                              id="newCompanyStreet"
                              value={newCompanyForm.street_address}
                              onChange={(e) => setNewCompanyForm({ ...newCompanyForm, street_address: e.target.value })}
                              placeholder="123 Main St"
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor="newCompanyCity">City</Label>
                              <Input
                                id="newCompanyCity"
                                value={newCompanyForm.city}
                                onChange={(e) => setNewCompanyForm({ ...newCompanyForm, city: e.target.value })}
                                placeholder="San Francisco"
                              />
                            </div>
                            <div>
                              <Label htmlFor="newCompanyState">State</Label>
                              <Select
                                value={newCompanyForm.state}
                                onValueChange={(value) => setNewCompanyForm({ ...newCompanyForm, state: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                                <SelectContent>
                                  {US_STATES.map((state) => (
                                    <SelectItem key={state.code} value={state.code}>
                                      {state.name} ({state.code})
                                    </SelectItem>
                                  ))}                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="newCompanyZip">ZIP Code</Label>
                              <Input
                                id="newCompanyZip"
                                value={newCompanyForm.zip_code}
                                onChange={(e) => setNewCompanyForm({ ...newCompanyForm, zip_code: e.target.value })}
                                placeholder="12345"
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <SimpleEIN
                            id="newCompanyEin"
                            value={newCompanyForm.ein}
                            onValueChangeAction={(value) => setNewCompanyForm({ ...newCompanyForm, ein: value })}
                            onValidationChange={setNewCompanyEinValid}
                            nextInputId="newCompanyStreet"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            type="submit" 
                            size="sm"
                            disabled={!newCompanyEinValid}
                          >
                            Create Company
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => setShowAddCompany(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}
              </div>
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

        <TabsContent value="chart-of-accounts">
          <ChartOfAccounts />
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
              {!currentCompany ? (
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

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsPageContent />
    </Suspense>
  )
}