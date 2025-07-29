'use client'

import { useCompany } from '@/contexts/CompanyContext'
import { Sidebar } from './sidebar'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'

interface DashboardContentProps {
  children: React.ReactNode
}

export function DashboardContent({ children }: DashboardContentProps) {
  const { currentCompany, userCompanies, setCurrentCompany, isRefreshing } = useCompany()
  const router = useRouter()
  
  return (
    <div className="grid grid-cols-[4rem_1fr] sm:grid-cols-[16rem_1fr] h-screen bg-background">
      <Sidebar />
      <main className="grid grid-rows-[auto_1fr] overflow-hidden bg-background">
        {/* Header with Company Name */}
        {currentCompany && (
          <header className="border-b bg-card">
            <div className="px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 text-xl sm:text-2xl font-bold text-foreground hover:bg-transparent truncate"
                        disabled={isRefreshing}
                      >
                        <span className="flex items-center min-w-0">
                          <span className="truncate">
                            {isRefreshing ? 'Loading...' : currentCompany.name}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {userCompanies.map((userCompany) => (
                        <DropdownMenuItem
                          key={userCompany.company_id}
                          onClick={() => setCurrentCompany(userCompany.company)}
                          className="cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{userCompany.company.name}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {userCompany.company.address}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => router.push('/settings?tab=companies&addCompany=true')}
                        className="cursor-pointer"
                      >
                        <Plus className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span>Add Company</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {currentCompany.address && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {currentCompany.address}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </header>
        )}
        
        <div className="overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8" key={currentCompany?.id || 'no-company'}>
            {isRefreshing && (
              <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
                Loading company data...
              </div>
            )}
            {children}
          </div>
        </div>
      </main>
    </div>
  )
} 