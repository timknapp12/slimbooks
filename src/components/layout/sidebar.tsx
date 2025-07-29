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
  Users,
  FileText as Invoice,
  CreditCard,
  Truck,
  ShoppingCart,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Invoices', href: '/invoices', icon: Invoice },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Vendors', href: '/vendors', icon: Truck },
  { name: 'Expenses', href: '/expenses', icon: ShoppingCart },
  { name: 'Recurring', href: '/recurring-expenses', icon: RotateCcw },
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
    <div className='flex h-full w-16 sm:w-64 flex-col bg-card border-r'>
      <div className='flex h-16 shrink-0 items-center justify-between px-2 sm:px-4'>
        <div className='flex items-center min-w-0'>
          <Building2 className='h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0' />
          <span className='ml-2 text-lg sm:text-xl font-semibold text-foreground hidden sm:block truncate'>
            SlimBooks
          </span>
        </div>
        <div className='hidden sm:block'>
          <ThemeToggle />
        </div>
      </div>
      
      <nav className='flex-1 space-y-1 px-1 sm:px-2 py-4 overflow-y-auto'>
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              title={item.name} // Tooltip for collapsed state
            >
              <item.icon
                className={cn(
                  'h-5 w-5 flex-shrink-0',
                  'sm:mr-3',
                  isActive
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground group-hover:text-accent-foreground'
                )}
              />
              <span className='hidden sm:block truncate'>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className='p-2 sm:p-4 space-y-2 border-t'>
        <div className='block sm:hidden'>
          <ThemeToggle />
        </div>
        {userEmail && (
          <div className='hidden sm:flex items-center px-2 py-2 text-xs text-muted-foreground'>
            <User className='mr-2 h-4 w-4 flex-shrink-0' />
            <span className='truncate'>{userEmail}</span>
          </div>
        )}
        <Button
          onClick={handleSignOut}
          variant='ghost'
          className='w-full justify-center sm:justify-start text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          title='Sign Out'
        >
          <LogOut className='h-5 w-5 sm:mr-3' />
          <span className='hidden sm:block'>Sign Out</span>
        </Button>
      </div>
    </div>
  );
}
