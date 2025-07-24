import { CompanyProvider } from '@/contexts/CompanyContext'
import { DashboardContent } from '@/components/layout/dashboard-content'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CompanyProvider>
      <DashboardContent>
        {children}
      </DashboardContent>
    </CompanyProvider>
  )
}