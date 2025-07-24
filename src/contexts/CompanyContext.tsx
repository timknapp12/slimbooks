'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Company {
  id: string
  name: string
  address: string
  ein: string
  accounting_method: 'cash' | 'accrual'
}

interface UserCompany {
  id: string
  user_id: string
  company_id: string
  role: 'admin' | 'staff'
  is_default: boolean
  company: Company
}

interface CompanyContextType {
  currentCompany: Company | null
  userCompanies: UserCompany[]
  setCurrentCompany: (company: Company) => void
  refreshCompanies: () => Promise<void>
  loading: boolean
  isRefreshing: boolean
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null)
  const [userCompanies, setUserCompanies] = useState<UserCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const supabase = createClient()

  const fetchUserCompanies = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Fetch user's companies with company details
      const { data: userCompaniesData, error } = await supabase
        .from('user_companies')
        .select(`
          id,
          user_id,
          company_id,
          role,
          is_default,
          company:companies(*)
        `)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error fetching user companies:', error)
        setLoading(false)
        return
      }

      const companies = userCompaniesData || []
      setUserCompanies(companies)

      // Set current company to default or first company
      const defaultCompany = companies.find((uc: UserCompany) => uc.is_default)
      const firstCompany = companies[0]
      const selectedCompany = defaultCompany || firstCompany

      if (selectedCompany) {
        setCurrentCompany(selectedCompany.company as Company)
      }

      setLoading(false)
    } catch (error) {
      console.error('Error in fetchUserCompanies:', error)
      setLoading(false)
    }
  }

  const refreshCompanies = async () => {
    setIsRefreshing(true)
    try {
      await fetchUserCompanies()
    } finally {
      setIsRefreshing(false)
    }
  }

  const setCurrentCompanyWithRefresh = (company: Company) => {
    setIsRefreshing(true)
    setCurrentCompany(company)
    // Clear refresh state after a short delay to allow data to load
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  useEffect(() => {
    fetchUserCompanies()
  }, [])

  const value: CompanyContextType = {
    currentCompany,
    userCompanies,
    setCurrentCompany: setCurrentCompanyWithRefresh,
    refreshCompanies,
    loading,
    isRefreshing
  }

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider')
  }
  return context
} 