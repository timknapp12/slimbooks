'use client';

import { useState } from 'react';

export const dynamic = 'force-dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FormWrapper } from '@/components/form-wrapper';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Login response:', { 
        data: data ? { 
          user: data.user ? { 
            id: data.user.id, 
            email: data.user.email, 
            email_confirmed_at: data.user.email_confirmed_at,
            confirmed_at: data.user.confirmed_at 
          } : null, 
          session: data.session ? 'present' : null 
        } : null, 
        error 
      });

      if (error) {
        if (
          error.message.includes('Invalid login credentials') ||
          error.message.includes('User not found')
        ) {
          toast({
            title: 'Sign in failed',
            description:
              "Invalid credentials. If you don't have an account, please sign up first.",
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Sign in failed',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else if (data.user) {
        // Check if email is verified
        if (!data.user.email_confirmed_at) {
          toast({
            title: 'Email verification required',
            description: 'Please check your email and click the verification link to continue.',
            variant: 'destructive',
          });
          return;
        }

        // Check if user has completed onboarding (with retry for trigger timing)
        let existingUser = null
        let userError = null
        let retryCount = 0
        const maxRetries = 3
        
        while (retryCount < maxRetries) {
          // First check if user exists in our users table
          const { data: userCheck, error: userCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('id', data.user.id)
            .single()

          if (userCheck && !userCheckError) {
            // User exists, now check if they have a company
            const { data: companyCheck, error: companyCheckError } = await supabase
              .from('user_companies')
              .select('company_id')
              .eq('user_id', data.user.id)
              .eq('is_default', true)
              .single()

            if (companyCheck && !companyCheckError) {
              existingUser = { ...userCheck, company_id: companyCheck.company_id }
            } else {
              existingUser = userCheck // User exists but no company
            }
            break
          }
          
          console.log(`User not found in public.users table, retry ${retryCount + 1}/${maxRetries}`)
          retryCount++
          
          if (retryCount < maxRetries) {
            // Wait 500ms before retrying
            await new Promise(resolve => setTimeout(resolve, 500))
          } else {
            userError = userCheckError
          }
        }

        console.log('Login user check:', { 
          userId: data.user.id, 
          existingUser, 
          userError: userError?.message,
          retries: retryCount
        });

        if (!existingUser || !existingUser.company_id) {
          // User doesn't exist in our table or hasn't completed onboarding
          toast({
            title: 'Welcome!',
            description: 'Let\'s set up your company.',
          });
          router.push('/onboarding');
        } else {
          // User exists and has completed onboarding
          router.push('/dashboard');
        }
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-background'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>
            Enter your email and password to sign in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormWrapper>
            <form onSubmit={handleLogin} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='email'>Email</Label>
                <Input
                  id='email'
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='password'>Password</Label>
                <Input
                  id='password'
                  type='password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type='submit' className='w-full' disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </FormWrapper>
          <div className='mt-4 text-center space-y-2'>
            <p className='text-sm text-muted-foreground'>
              Don&apos;t have an account?
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
