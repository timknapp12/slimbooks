'use client'

import { useState } from 'react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { CreditCard, Building2 } from 'lucide-react'

interface BankConnectProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function BankConnect({ isOpen, onClose, onSuccess }: BankConnectProps) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'select' | 'credentials'>('select')
  const [selectedBank, setSelectedBank] = useState('')
  const [accountType, setAccountType] = useState('')
  const { toast } = useToast()

  const popularBanks = [
    'Chase Bank',
    'Bank of America',
    'Wells Fargo',
    'Citibank',
    'Capital One',
    'US Bank',
    'PNC Bank',
    'TD Bank',
    'Other',
  ]

  const accountTypes = [
    'Checking',
    'Savings',
    'Business Checking',
    'Business Savings',
    'Credit Card',
  ]

  const handleBankSelect = (bank: string) => {
    setSelectedBank(bank)
    setStep('credentials')
  }

  const handleConnect = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/bank-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bankName: selectedBank,
          accountType: accountType,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect bank account')
      }

      toast({
        title: 'Success',
        description: data.message || 'Bank account connected successfully',
      })

      // If mock transactions were returned, you could import them here
      if (data.transactions && data.transactions.length > 0) {
        toast({
          title: 'Transactions Imported',
          description: `${data.transactions.length} recent transactions imported`,
        })
      }

      onSuccess()
      onClose()
      setStep('select')
      setSelectedBank('')
      setAccountType('')
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to connect bank account'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setStep('select')
    setSelectedBank('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Connect Bank Account
          </DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Select your bank to automatically import transactions'
              : 'This is a demo - real implementation would use secure OAuth'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Popular Banks
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {popularBanks.map(bank => (
                  <Button
                    key={bank}
                    variant="outline"
                    className="justify-start h-12"
                    onClick={() => handleBankSelect(bank)}
                  >
                    <CreditCard className="mr-3 h-4 w-4" />
                    {bank}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'credentials' && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Demo Mode:</strong> This is a demonstration. In a real
                implementation, you would be redirected to {selectedBank}&apos;s
                secure login page.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Selected Bank</Label>
              <Input value={selectedBank} disabled />
            </div>

            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleConnect}
                disabled={!accountType || loading}
                className="flex-1"
              >
                {loading ? 'Connecting...' : 'Connect Account'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
