'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Plus, Filter, Printer, FileText } from 'lucide-react'
import { useCompany } from '@/contexts/CompanyContext'
import { CheckForm } from '@/components/check-form'
import { CheckTable } from '@/components/check-table'
import { useChecks } from '@/hooks/use-checks'
import { useTransactions } from '@/hooks/use-transactions'
import {
  formatDate,
  getFirstDayOfMonth,
  getLastDayOfMonth,
} from '@/lib/date-utils'
import {
  generateSingleCheckPDF,
  generateChecksPDF,
  downloadChecksPDF,
  numberToWords,
} from '@/lib/check-generator'
import type { Check, CheckFormData, CheckPrintData } from '@/types/check'

export default function ChecksPage() {
  const [isWriteCheckOpen, setIsWriteCheckOpen] = useState(false)
  const [isFilterVisible, setIsFilterVisible] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth())
  const [dateTo, setDateTo] = useState(getLastDayOfMonth())

  const supabase = createClient()
  const { currentCompany } = useCompany()
  const { toast } = useToast()

  // Use the checks hook
  const {
    checks,
    payables,
    loading,
    nextCheckNumber,
    createCheck,
    voidCheck,
    markCheckPrinted,
    markCheckCleared,
    deleteCheck,
  } = useChecks({ supabase, currentCompany })

  // Use transactions hook for chart of accounts
  const { chartOfAccounts } = useTransactions({ supabase, currentCompany })

  // Filter checks
  const filteredChecks = checks.filter(check => {
    // Status filter
    if (filterStatus !== 'all' && check.status !== filterStatus) {
      return false
    }

    // Date filter
    const checkDate = new Date(check.date)
    const fromDate = new Date(dateFrom)
    const toDate = new Date(dateTo)

    if (checkDate < fromDate || checkDate > toDate) {
      return false
    }

    return true
  })

  // Calculate totals
  const totals = filteredChecks.reduce(
    (acc, check) => {
      if (check.status === 'voided') {
        acc.voided += check.amount
        acc.voidedCount++
      } else if (check.status === 'cleared' || check.status === 'reconciled') {
        acc.cleared += check.amount
        acc.clearedCount++
      } else {
        acc.outstanding += check.amount
        acc.outstandingCount++
      }
      return acc
    },
    {
      cleared: 0,
      outstanding: 0,
      voided: 0,
      clearedCount: 0,
      outstandingCount: 0,
      voidedCount: 0,
    }
  )

  const handleWriteCheck = async (
    formData: CheckFormData,
    payableId?: string
  ): Promise<string | null> => {
    return await createCheck(formData, payableId)
  }

  const handlePrintCheck = async (check: Check) => {
    try {
      const checkPrintData: CheckPrintData = {
        check_number: check.check_number,
        date: check.date,
        payee_name: check.payee_name,
        payee_address: check.payee_address,
        amount: check.amount,
        amount_in_words: check.amount_in_words || numberToWords(check.amount),
        memo: check.memo,
        company_name: currentCompany?.name || 'Your Company',
      }

      const pdfBytes = await generateSingleCheckPDF(
        checkPrintData,
        currentCompany?.name,
        currentCompany?.street_address
          ? `${currentCompany.street_address}\n${currentCompany.city || ''}, ${
              currentCompany.state || ''
            } ${currentCompany.zip_code || ''}`
          : undefined
      )

      await downloadChecksPDF(pdfBytes, `check-${check.check_number}.pdf`)

      // Mark as printed
      await markCheckPrinted(check.id)

      toast({
        title: 'Check Generated',
        description: `Check #${check.check_number} has been generated and downloaded`,
      })
    } catch (error) {
      console.error('Error printing check:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate check PDF',
        variant: 'destructive',
      })
    }
  }

  const handlePrintAllPending = async () => {
    const pendingChecks = filteredChecks.filter(c => c.status === 'pending')

    if (pendingChecks.length === 0) {
      toast({
        title: 'No Checks to Print',
        description: 'There are no pending checks to print',
      })
      return
    }

    try {
      const checksPrintData: CheckPrintData[] = pendingChecks.map(check => ({
        check_number: check.check_number,
        date: check.date,
        payee_name: check.payee_name,
        payee_address: check.payee_address,
        amount: check.amount,
        amount_in_words: check.amount_in_words || numberToWords(check.amount),
        memo: check.memo,
      }))

      const pdfBytes = await generateChecksPDF({
        checks: checksPrintData,
        companyName: currentCompany?.name,
        companyAddress: currentCompany?.street_address
          ? `${currentCompany.street_address}\n${currentCompany.city || ''}, ${
              currentCompany.state || ''
            } ${currentCompany.zip_code || ''}`
          : undefined,
      })

      await downloadChecksPDF(pdfBytes, `checks-batch-${Date.now()}.pdf`)

      // Mark all as printed
      for (const check of pendingChecks) {
        await markCheckPrinted(check.id)
      }

      toast({
        title: 'Checks Generated',
        description: `${pendingChecks.length} check(s) have been generated and downloaded`,
      })
    } catch (error) {
      console.error('Error printing checks:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate checks PDF',
        variant: 'destructive',
      })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  if (loading) {
    return <div>Loading...</div>
  }

  const pendingCount = filteredChecks.filter(c => c.status === 'pending').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Check Register</h1>
        <p className="text-muted-foreground">Write, print, and manage checks</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 flex-wrap">
        <Button
          onClick={() => setIsWriteCheckOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Write Check
        </Button>
        <Button
          variant="outline"
          onClick={handlePrintAllPending}
          disabled={pendingCount === 0}
          className="flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          Print All Pending ({pendingCount})
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsFilterVisible(!isFilterVisible)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totals.outstanding)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.outstandingCount} check
              {totals.outstandingCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cleared
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totals.cleared)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.clearedCount} check{totals.clearedCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Voided
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totals.voided)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.voidedCount} check{totals.voidedCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {isFilterVisible && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="status-filter">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="printed">Printed</SelectItem>
                    <SelectItem value="cleared">Cleared</SelectItem>
                    <SelectItem value="voided">Voided</SelectItem>
                    <SelectItem value="reconciled">Reconciled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date-from">From Date</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="date-to">To Date</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setFilterStatus('all')
                  setDateFrom(getFirstDayOfMonth())
                  setDateTo(getLastDayOfMonth())
                }}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Checks
          </CardTitle>
          <CardDescription>
            {filteredChecks.length} check
            {filteredChecks.length !== 1 ? 's' : ''} found
            {filterStatus !== 'all' && ` with status "${filterStatus}"`}
            {` from ${formatDate(dateFrom)} to ${formatDate(dateTo)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CheckTable
            checks={filteredChecks}
            onPrint={handlePrintCheck}
            onVoid={voidCheck}
            onMarkCleared={markCheckCleared}
            onDelete={deleteCheck}
          />
        </CardContent>
      </Card>

      {/* Write Check Dialog */}
      <CheckForm
        open={isWriteCheckOpen}
        onOpenChange={setIsWriteCheckOpen}
        onSubmit={handleWriteCheck}
        chartOfAccounts={chartOfAccounts}
        payables={payables}
        nextCheckNumber={nextCheckNumber}
      />
    </div>
  )
}
