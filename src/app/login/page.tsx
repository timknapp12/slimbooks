'use client'

import { useState } from 'react'

export const dynamic = 'force-dynamic'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // First, try to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // If sign-in fails due to invalid credentials, try to sign up automatically
        if (signInError.message.includes('Invalid login credentials') || 
            signInError.message.includes('Email not confirmed') ||
            signInError.message.includes('User not found')) {
          
          toast({
            title: 'Account not found',
            description: 'Creating a new account for you...',
          })

          // Try to sign up with the same credentials
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          })

          if (signUpError) {
            // If sign up also fails, show helpful error
            if (signUpError.message.includes('User already registered')) {
              toast({
                title: 'Account exists but password is incorrect',
                description: 'Please check your password or reset it if you forgot.',
                variant: 'destructive',
              })
            } else {
              toast({
                title: 'Sign up failed',
                description: signUpError.message,
                variant: 'destructive',
              })
            }
          } else {
            // Sign up successful
            toast({
              title: 'Account created successfully!',
              description: 'Please check your email to verify your account, then sign in.',
            })
          }
        } else {
          // Other sign-in errors
          toast({
            title: 'Sign in failed',
            description: signInError.message,
            variant: 'destructive',
          })
        }
      } else {
        // Sign in successful
        toast({
          title: 'Welcome back!',
          description: 'Successfully signed in.',
        })
        router.push('/dashboard')
      }
    } catch {
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
          <CardTitle>Sign In</CardTitle>
          <CardDescription>
            Enter your email and password. New users will be automatically registered.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-blue-600 hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}