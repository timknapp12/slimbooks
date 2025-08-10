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
  
  const formatAddress = (company: { street_address?: string | null; city?: string | null; state?: string | null; zip_code?: string | null }) => {
    const parts = [
      company.street_address,
      company.city,
      company.state,
      company.zip_code
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : 'No address'
  }
  
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        {/* Header with Company Name */}
        {currentCompany && (
          <header className="border-b bg-card">
            <div className="px-8 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 text-2xl font-bold text-foreground hover:bg-transparent"
                        disabled={isRefreshing}
                      >
                        <span className="flex items-center">
                          {isRefreshing ? 'Loading...' : currentCompany.name}
                          <ChevronDown className="ml-2 h-5 w-5" />
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
                          <div>
                            <div className="font-medium">{userCompany.company.name}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {formatAddress(userCompany.company)}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => router.push('/settings?tab=companies&addCompany=true')}
                        className="cursor-pointer"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        <span>Add Company</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatAddress(currentCompany)}
                  </p>
                </div>
              </div>
            </div>
          </header>
        )}
        
        <div className="p-8" key={currentCompany?.id || 'no-company'}>
          {isRefreshing && (
            <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
              Loading company data...
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
} 