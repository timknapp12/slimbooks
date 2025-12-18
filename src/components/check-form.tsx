'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateForDB } from '@/lib/date-utils'
import type { CheckFormData, Payable } from '@/types/check'
import type { ChartOfAccount } from '@/types/transaction'

interface CheckFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (formData: CheckFormData, payableId?: string) => Promise<string | null>
  chartOfAccounts: ChartOfAccount[]
  payables?: Payable[]
  nextCheckNumber: number
  initialData?: Partial<CheckFormData> & { payableId?: string }
  title?: string
  description?: string
  submitButtonText?: string
}

export function CheckForm({
  open,
  onOpenChange,
  onSubmit,
  chartOfAccounts,
  payables = [],
  nextCheckNumber,
  initialData,
  title = 'Write Check',
  description = 'Create a new check payment',
  submitButtonText = 'Create Check',
}: CheckFormProps) {
  const [formData, setFormData] = useState<CheckFormData>({
    payee_name: '',
    payee_address: '',
    amount: '',
    memo: '',
    date: formatDateForDB(new Date()),
    category: 'Accounts Payable',
    check_number: '',
  })
  const [selectedPayableId, setSelectedPayableId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get expense categories for the category dropdown
  const expenseCategories = chartOfAccounts
    .filter(account => account.account_type === 'expense' || account.account_type === 'liability')
    .map(account => account.account_name)

  // Reset form when dialog opens/closes or initial data changes
  useEffect(() => {
    if (open) {
      setFormData({
        payee_name: initialData?.payee_name || '',
        payee_address: initialData?.payee_address || '',
        amount: initialData?.amount || '',
        memo: initialData?.memo || '',
        date: initialData?.date || formatDateForDB(new Date()),
        category: initialData?.category || 'Accounts Payable',
        check_number: initialData?.check_number || '',
      })
      setSelectedPayableId(initialData?.payableId || '')
    }
  }, [open, initialData])

  // When a payable is selected, populate form fields
  useEffect(() => {
    if (selectedPayableId) {
      const payable = payables.find(p => p.id === selectedPayableId)
      if (payable) {
        setFormData(prev => ({
          ...prev,
          payee_name: payable.name,
          amount: payable.amount.toString(),
          memo: `Payment for invoice`,
        }))
      }
    }
  }, [selectedPayableId, payables])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const checkId = await onSubmit(formData, selectedPayableId || undefined)
      if (checkId) {
        onOpenChange(false)
        // Reset form
        setFormData({
          payee_name: '',
          payee_address: '',
          amount: '',
          memo: '',
          date: formatDateForDB(new Date()),
          category: 'Accounts Payable',
          check_number: '',
        })
        setSelectedPayableId('')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatCurrency = (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pay from Payable */}
          {payables.length > 0 && (
            <div>
              <Label htmlFor="payable">Pay from Open Payable (Optional)</Label>
              <Select
                value={selectedPayableId}
                onValueChange={setSelectedPayableId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a payable to pay..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None - Manual Entry</SelectItem>
                  {payables.map(payable => (
                    <SelectItem key={payable.id} value={payable.id}>
                      {payable.name} - {formatCurrency(payable.amount.toString())}
                      {payable.due_date && ` (Due: ${payable.due_date})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Check Number */}
          <div>
            <Label htmlFor="check_number">
              Check Number (Next: #{nextCheckNumber})
            </Label>
            <Input
              id="check_number"
              type="number"
              value={formData.check_number}
              onChange={e =>
                setFormData({ ...formData, check_number: e.target.value })
              }
              placeholder={`Leave blank for #${nextCheckNumber}`}
            />
          </div>

          {/* Date */}
          <div>
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          {/* Payee Name */}
          <div>
            <Label htmlFor="payee_name">Pay to the Order of *</Label>
            <Input
              id="payee_name"
              value={formData.payee_name}
              onChange={e =>
                setFormData({ ...formData, payee_name: e.target.value })
              }
              placeholder="Payee name"
              required
            />
          </div>

          {/* Payee Address */}
          <div>
            <Label htmlFor="payee_address">Payee Address</Label>
            <Textarea
              id="payee_address"
              value={formData.payee_address}
              onChange={e =>
                setFormData({ ...formData, payee_address: e.target.value })
              }
              placeholder="123 Main St&#10;City, State 12345"
              rows={2}
            />
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={e =>
                setFormData({ ...formData, amount: e.target.value })
              }
              placeholder="$0.00"
              required
            />
            {formData.amount && (
              <p className="text-sm text-muted-foreground mt-1">
                {formatCurrency(formData.amount)}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="category">Expense Category *</Label>
            <Select
              value={formData.category}
              onValueChange={value =>
                setFormData({ ...formData, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Memo */}
          <div>
            <Label htmlFor="memo">Memo</Label>
            <Input
              id="memo"
              value={formData.memo}
              onChange={e => setFormData({ ...formData, memo: e.target.value })}
              placeholder="For invoice #123, services rendered, etc."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : submitButtonText}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
