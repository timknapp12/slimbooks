'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/client'
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
    address: '',
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
    address: '',
    ein: '',
    accounting_method: 'cash' as 'cash' | 'accrual'
  })

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

  const handleStartEditCompany = (userCompany: { company_id: string; company: { name: string; address: string; ein: string; accounting_method: 'cash' | 'accrual' } }) => {
    setEditingCompanyId(userCompany.company_id)
    setEditingCompanyForm({
      name: userCompany.company.name || '',
      address: userCompany.company.address || '',
      ein: userCompany.company.ein || '',
      accounting_method: userCompany.company.accounting_method || 'cash'
    })
  }

  const handleCancelEditCompany = () => {
    setEditingCompanyId(null)
    setEditingCompanyForm({
      name: '',
      address: '',
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
          address: editingCompanyForm.address,
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
        address: '',
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
                            <Label htmlFor={`edit-company-ein-${userCompany.company_id}`}>EIN</Label>
                            <Input
                              id={`edit-company-ein-${userCompany.company_id}`}
                              value={editingCompanyForm.ein}
                              onChange={(e) => setEditingCompanyForm({ ...editingCompanyForm, ein: e.target.value })}
                              placeholder="XX-XXXXXXX"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`edit-company-address-${userCompany.company_id}`}>Business Address</Label>
                          <Input
                            id={`edit-company-address-${userCompany.company_id}`}
                            value={editingCompanyForm.address}
                            onChange={(e) => setEditingCompanyForm({ ...editingCompanyForm, address: e.target.value })}
                            placeholder="123 Main St, City, State, ZIP"
                          />
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
                              <SelectItem value="cash">Cash Basis</SelectItem>
                              <SelectItem value="accrual">Accrual Basis</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveEditCompany} size="sm">
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

                        // Create new company using database function
                        const { error: functionError } = await supabase
                          .rpc('create_company_with_user_auth', {
                            company_name: newCompanyForm.name,
                            company_address: newCompanyForm.address || null,
                            company_ein: newCompanyForm.ein || null,
                            company_accounting_method: newCompanyForm.accounting_method
                          })

                        if (functionError) throw functionError

                        toast({
                          title: 'Success',
                          description: 'Company created successfully',
                        })

                        setShowAddCompany(false)
                        setNewCompanyForm({ name: '', address: '', ein: '', accounting_method: 'cash' })
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
                        <div>
                          <Label htmlFor="newCompanyAddress">Business Address</Label>
                          <Input
                            id="newCompanyAddress"
                            value={newCompanyForm.address}
                            onChange={(e) => setNewCompanyForm({ ...newCompanyForm, address: e.target.value })}
                            placeholder="123 Main St, City, State, ZIP"
                          />
                        </div>
                        <div>
                          <Label htmlFor="newCompanyEin">EIN</Label>
                          <Input
                            id="newCompanyEin"
                            value={newCompanyForm.ein}
                            onChange={(e) => setNewCompanyForm({ ...newCompanyForm, ein: e.target.value })}
                            placeholder="XX-XXXXXXX"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" size="sm">
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