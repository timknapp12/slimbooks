'use client'

import { useState } from 'react'

export const dynamic = 'force-dynamic'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { FormWrapper } from '@/components/form-wrapper'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      console.log('Starting signup process for email:', email)

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      console.log('Signup response:', {
        data: data
          ? {
              user: data.user
                ? {
                    id: data.user.id,
                    email: data.user.email,
                    email_confirmed_at: data.user.email_confirmed_at,
                    confirmed_at: data.user.confirmed_at,
                  }
                : null,
              session: data.session ? 'present' : null,
            }
          : null,
        error,
      })

      if (error) {
        console.error('Signup error:', error)
        // Provide more helpful error messages
        if (error.message.includes('User already registered')) {
          toast({
            title: 'Account already exists',
            description:
              'An account with this email already exists. Try signing in instead.',
            variant: 'destructive',
          })
        } else if (error.message.includes('Password should be at least')) {
          toast({
            title: 'Password too weak',
            description: 'Password should be at least 6 characters long.',
            variant: 'destructive',
          })
        } else if (error.message.includes('Invalid email')) {
          toast({
            title: 'Invalid email',
            description: 'Please enter a valid email address.',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Sign up failed',
            description: error.message,
            variant: 'destructive',
          })
        }
      } else {
        console.log(
          'Signup successful, checking if user was created in our database...'
        )

        // Check if the user was created in our users table
        if (data.user) {
          const { data: userCheck, error: userCheckError } = await supabase
            .from('users')
            .select('id, email')
            .eq('id', data.user.id)
            .single()

          console.log('User check result:', { userCheck, userCheckError })
        }

        toast({
          title: 'Account created successfully!',
          description:
            'Please check your email and click the verification link before continuing.',
          duration: 300000, // 5 minutes (300,000ms) - very long but not infinite
        })
        router.push('/login')
      }
    } catch (error) {
      console.error('Unexpected signup error:', error)
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            Sign up to get started with SlimBooks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormWrapper>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          </FormWrapper>
          <div className="mt-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Already have an account?
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
