'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Settings,
  Building2,
  LogOut,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);
    };
    getUser();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className='flex h-full w-64 flex-col bg-card border-r'>
      <div className='flex h-16 shrink-0 items-center justify-between px-4'>
        <div className='flex items-center'>
          <Building2 className='h-8 w-8 text-primary' />
          <span className='ml-2 text-xl font-semibold text-foreground'>
            SlimBooks
          </span>
        </div>
        <ThemeToggle />
      </div>
      
      <nav className='flex-1 space-y-1 px-2 py-4'>
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground group-hover:text-accent-foreground'
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className='p-4 space-y-2'>
        {userEmail && (
          <div className='flex items-center px-2 py-2 text-xs text-muted-foreground'>
            <User className='mr-2 h-4 w-4' />
            <span className='truncate'>{userEmail}</span>
          </div>
        )}
        <Button
          onClick={handleSignOut}
          variant='ghost'
          className='w-full justify-start text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        >
          <LogOut className='mr-3 h-5 w-5' />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
