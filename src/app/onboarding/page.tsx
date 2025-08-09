'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { FormWrapper } from '@/components/form-wrapper'
import { AddressForm } from '@/components/address-form'
import { EINInput } from '@/components/ein-input'
import { optionalAddressSchema, einSchema } from '@/lib/address-validation'

// Form schema
const onboardingSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  ein: einSchema,
  address: optionalAddressSchema
})

type OnboardingFormData = z.infer<typeof onboardingSchema>

export default function OnboardingPage() {
  const [emailVerified, setEmailVerified] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      companyName: '',
      ein: '',
      address: {
        streetAddress: '',
        city: '',
        state: '',
        zipCode: ''
      }
    }
  })

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      if (!user.email_confirmed_at) {
        setEmailVerified(false)
      } else {
        setEmailVerified(true)
      }
      
      setCheckingAuth(false)
    }

    checkAuth()
  }, [supabase, router])

  const handleSubmit = async (data: OnboardingFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Check if email is verified
      if (!user.email_confirmed_at) {
        toast({
          title: 'Email verification required',
          description: 'Please verify your email address before setting up your company.',
          variant: 'destructive',
        })
        return
      }

      // Use API route to create company and user
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: data.companyName,
          ein: data.ein,
          streetAddress: data.address.streetAddress,
          city: data.address.city,
          state: data.address.state,
          zipCode: data.address.zipCode,
          accountingMethod: 'cash',
        }),
        credentials: 'include',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete onboarding')
      }

      toast({
        title: 'Success',
        description: 'Company profile created successfully!',
      })

      router.push('/dashboard')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create company profile'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  if (checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Email Verification Required</CardTitle>
            <CardDescription>
              Please check your email and click the verification link before setting up your company.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                We sent a verification link to your email address. Click the link to verify your account and continue with setup.
              </p>
              <Button onClick={() => router.push('/login')} variant="outline">
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Company Setup</CardTitle>
          <CardDescription>
            Let&apos;s set up your company profile to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormWrapper>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  {...form.register('companyName')}
                />
                {form.formState.errors.companyName && (
                  <p className="text-sm text-red-500">{form.formState.errors.companyName.message}</p>
                )}
              </div>
              
              <EINInput
                control={form.control}
                name="ein"
                id="ein"
              />

              <div className="space-y-2">
                <Label className="text-base font-medium">Business Address (Optional)</Label>
                <AddressForm
                  control={form.control}
                  namePrefix="address"
                  required={false}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Creating...' : 'Complete Setup'}
              </Button>
            </form>
          </FormWrapper>
        </CardContent>
      </Card>
    </div>
  )
}