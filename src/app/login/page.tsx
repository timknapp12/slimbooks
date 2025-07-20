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

        // Check if user has completed onboarding
        const { data: existingUser, error: userError } = await supabase
          .from('users')
          .select('id, company_id')
          .eq('id', data.user.id)
          .single();

        console.log('Login user check:', { 
          userId: data.user.id, 
          existingUser, 
          userError: userError?.message 
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
          <form onSubmit={handleLogin} className='space-y-4' suppressHydrationWarning>
            <div className='space-y-2'>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                suppressHydrationWarning
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
                suppressHydrationWarning
              />
            </div>
            <Button type='submit' className='w-full' disabled={loading} suppressHydrationWarning>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
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
