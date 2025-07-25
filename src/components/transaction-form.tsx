'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateForDB } from '@/lib/date-utils'
import type { TransactionFormData, ChartOfAccount } from '@/types/transaction'

interface TransactionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (formData: TransactionFormData) => Promise<boolean>
  chartOfAccounts: ChartOfAccount[]
  initialData?: Partial<TransactionFormData>
  title?: string
  description?: string
  submitButtonText?: string
}

export function TransactionForm({
  open,
  onOpenChange,
  onSubmit,
  chartOfAccounts,
  initialData,
  title = 'Add Transaction',
  description = 'Add a new transaction to your records',
  submitButtonText = 'Add Transaction'
}: TransactionFormProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    date: formatDateForDB(new Date()),
    amount: '',
    type: 'expense',
    category: '',
    description: ''
  })

  // Reset form when dialog opens/closes or initial data changes
  useEffect(() => {
    if (open) {
      setFormData({
        date: initialData?.date || formatDateForDB(new Date()),
        amount: initialData?.amount || '',
        type: initialData?.type || 'expense',
        category: initialData?.category || '',
        description: initialData?.description || ''
      })
    }
  }, [open, initialData])

  // Reset category when type changes
  useEffect(() => {
    if (formData.type) {
      const typeMapping: { [key: string]: string } = {
        'income': 'revenue',
        'expense': 'expense',
        'asset': 'asset',
        'liability': 'liability',
        'equity': 'equity'
      }
      
      const accountType = typeMapping[formData.type] || formData.type
      const validCategories = chartOfAccounts
        .filter(account => account.account_type === accountType)
        .map(account => account.account_name)
      
      if (!validCategories.includes(formData.category)) {
        setFormData(prev => ({ ...prev, category: '' }))
      }
    }
  }, [formData.type, formData.category, chartOfAccounts])

  const getCategoriesByType = (type: string) => {
    const typeMapping: { [key: string]: string } = {
      'income': 'revenue',
      'expense': 'expense',
      'asset': 'asset',
      'liability': 'liability',
      'equity': 'equity'
    }
    
    const accountType = typeMapping[type] || type
    return chartOfAccounts
      .filter(account => account.account_type === accountType)
      .map(account => account.account_name)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await onSubmit(formData)
    if (success) {
      onOpenChange(false)
      // Reset form
      setFormData({
        date: formatDateForDB(new Date()),
        amount: '',
        type: 'expense',
        category: '',
        description: ''
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="$0.00"
              required
            />
          </div>
          <div>
            <Label htmlFor="type">Type *</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value: 'income' | 'expense' | 'asset' | 'liability' | 'equity') => setFormData({ ...formData, type: value, category: '' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="liability">Liability</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="category">Category *</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {getCategoriesByType(formData.type).map((category: string) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Notes"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {submitButtonText}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 