'use client'

import { useState, useEffect, useCallback } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useCompany } from '@/contexts/CompanyContext'
import {
  Plus,
  Edit2,
  BookOpen,
  Check,
  X,
  HelpCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

interface ChartOfAccount {
  id: string
  account_number: string
  account_name: string
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  description: string | null
  is_active: boolean
  is_default: boolean
  parent_account_id: string | null
  created_at: string
  updated_at: string
}

interface NewAccountForm {
  account_number: string
  account_name: string
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  description: string
}

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [editingAccount, setEditingAccount] = useState<Partial<ChartOfAccount>>(
    {}
  )
  const [newAccountForm, setNewAccountForm] = useState<NewAccountForm>({
    account_number: '',
    account_name: '',
    account_type: 'asset',
    description: '',
  })
  const [filterType, setFilterType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showHelperTool, setShowHelperTool] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()
  const { currentCompany } = useCompany()

  const fetchAccounts = useCallback(async () => {
    try {
      if (!currentCompany) return

      let query = supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('account_number')

      if (filterType !== 'all') {
        query = query.eq('account_type', filterType)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching accounts:', error)
        toast({
          title: 'Error',
          description: 'Failed to load Chart of Accounts',
          variant: 'destructive',
        })
        return
      }

      setAccounts(data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast({
        title: 'Error',
        description: 'Failed to load Chart of Accounts',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [currentCompany, filterType, supabase, toast])

  useEffect(() => {
    if (currentCompany) {
      fetchAccounts()
    }
  }, [fetchAccounts, currentCompany])

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch =
      account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.account_number.includes(searchTerm) ||
      (account.description &&
        account.description.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesSearch
  })

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentCompany) return

    // Validate required fields
    if (
      !newAccountForm.account_number?.trim() ||
      !newAccountForm.account_name?.trim()
    ) {
      toast({
        title: 'Error',
        description: 'Account number and name are required',
        variant: 'destructive',
      })
      return
    }

    try {
      // Check if account number already exists
      const { data: existingAccounts, error: checkError } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('account_number', newAccountForm.account_number)

      if (checkError) {
        console.error('Error checking existing account:', checkError)
      }

      if (existingAccounts && existingAccounts.length > 0) {
        toast({
          title: 'Error',
          description: 'Account number already exists',
          variant: 'destructive',
        })
        return
      }

      const { error } = await supabase.from('chart_of_accounts').insert({
        company_id: currentCompany.id,
        account_number: newAccountForm.account_number,
        account_name: newAccountForm.account_name,
        account_type: newAccountForm.account_type,
        description: newAccountForm.description || null,
      })

      if (error) {
        console.error('Error adding account:', error)
        toast({
          title: 'Error',
          description: 'Failed to add account',
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Success',
        description: 'Account added successfully',
      })

      setNewAccountForm({
        account_number: '',
        account_name: '',
        account_type: 'asset',
        description: '',
      })
      setIsAddDialogOpen(false)
      fetchAccounts()
    } catch (error) {
      console.error('Error adding account:', error)
      toast({
        title: 'Error',
        description: 'Failed to add account',
        variant: 'destructive',
      })
    }
  }

  const handleStartEdit = (account: ChartOfAccount) => {
    setEditingAccountId(account.id)
    setEditingAccount({
      account_number: account.account_number,
      account_name: account.account_name,
      account_type: account.account_type,
      description: account.description || '',
    })
  }

  const handleCancelEdit = () => {
    setEditingAccountId(null)
    setEditingAccount({})
  }

  const handleSaveEdit = async () => {
    console.log('handleSaveEdit called')
    console.log('editingAccountId:', editingAccountId)
    console.log('currentCompany:', currentCompany)
    console.log('editingAccount:', editingAccount)

    if (!editingAccountId || !currentCompany) {
      console.log('Missing editingAccountId or currentCompany')
      return
    }

    // Validate required fields
    if (
      !editingAccount.account_number?.trim() ||
      !editingAccount.account_name?.trim()
    ) {
      console.log('Validation failed - missing account number or name')
      toast({
        title: 'Error',
        description: 'Account number and name are required',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      // Check if account number already exists (excluding current account)
      const { data: existingAccounts, error: checkError } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('account_number', editingAccount.account_number)
        .neq('id', editingAccountId)

      if (checkError) {
        console.error('Error checking existing account:', checkError)
      }

      if (existingAccounts && existingAccounts.length > 0) {
        toast({
          title: 'Error',
          description: 'Account number already exists',
          variant: 'destructive',
        })
        return
      }

      console.log('Updating account with data:', {
        account_number: editingAccount.account_number,
        account_name: editingAccount.account_name,
        account_type: editingAccount.account_type,
        description: editingAccount.description || null,
      })

      const { error } = await supabase
        .from('chart_of_accounts')
        .update({
          account_number: editingAccount.account_number,
          account_name: editingAccount.account_name,
          account_type: editingAccount.account_type,
          description: editingAccount.description || null,
        })
        .eq('id', editingAccountId)

      if (error) {
        console.error('Error updating account:', error)
        toast({
          title: 'Error',
          description: 'Failed to update account',
          variant: 'destructive',
        })
        return
      }

      console.log('Account updated successfully')

      toast({
        title: 'Success',
        description: 'Account updated successfully',
      })

      setEditingAccountId(null)
      setEditingAccount({})
      fetchAccounts()
    } catch (error) {
      console.error('Error updating account:', error)
      toast({
        title: 'Error',
        description: 'Failed to update account',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'asset':
        return 'text-blue-600 bg-blue-50'
      case 'liability':
        return 'text-red-600 bg-red-50'
      case 'equity':
        return 'text-purple-600 bg-purple-50'
      case 'revenue':
        return 'text-green-600 bg-green-50'
      case 'expense':
        return 'text-orange-600 bg-orange-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'asset':
        return 'Asset'
      case 'liability':
        return 'Liability'
      case 'equity':
        return 'Equity'
      case 'revenue':
        return 'Revenue'
      case 'expense':
        return 'Expense'
      default:
        return type
    }
  }

  if (!currentCompany) {
    return (
      <div className="text-center py-8">
        <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Company Setup Required</h3>
        <p className="text-muted-foreground">
          You need to set up your company information before accessing Chart of
          Accounts.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chart of Accounts</h2>
          <p className="text-muted-foreground">
            Manage your company&apos;s Chart of Accounts for proper financial
            categorization
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Account</DialogTitle>
              <DialogDescription>
                Create a new account in your Chart of Accounts
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    value={newAccountForm.account_number}
                    onChange={e =>
                      setNewAccountForm({
                        ...newAccountForm,
                        account_number: e.target.value,
                      })
                    }
                    placeholder="e.g., 1000"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="accountType">Account Type</Label>
                  <Select
                    value={newAccountForm.account_type}
                    onValueChange={(
                      value:
                        | 'asset'
                        | 'liability'
                        | 'equity'
                        | 'revenue'
                        | 'expense'
                    ) =>
                      setNewAccountForm({
                        ...newAccountForm,
                        account_type: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="liability">Liability</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  value={newAccountForm.account_name}
                  onChange={e =>
                    setNewAccountForm({
                      ...newAccountForm,
                      account_name: e.target.value,
                    })
                  }
                  placeholder="e.g., Cash"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newAccountForm.description}
                  onChange={e =>
                    setNewAccountForm({
                      ...newAccountForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Optional description"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Add Account</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Helper Tool - Account Number Ranges */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              <CardTitle>Account Number Ranges Guide</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelperTool(!showHelperTool)}
              className="flex items-center space-x-1"
            >
              {showHelperTool ? (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span>Hide Guide</span>
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4" />
                  <span>Show Guide</span>
                </>
              )}
            </Button>
          </div>
          <CardDescription>
            Understanding how account numbers are used for ordering in financial
            reports
          </CardDescription>
        </CardHeader>
        {showHelperTool && (
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                How Account Numbers Work in Reports
              </h4>
              <p className="text-blue-800 dark:text-blue-200 text-sm mb-3">
                Account numbers are used to organize and display accounts in a
                logical order across all financial reports. This follows
                standard accounting practices where accounts are grouped by type
                and displayed in numerical order.
              </p>
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                <strong>In Reports:</strong> Accounts are automatically sorted
                by account number, ensuring consistent ordering in Profit & Loss
                statements, Balance Sheets, Cash Flow statements, and other
                financial reports.
              </p>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Range</TableHead>
                    <TableHead>Account Type</TableHead>
                    <TableHead>Examples</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-sm">
                      1000–1999
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-green-700 dark:text-green-400">
                        Assets
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      1010 – Cash, 1200 – Accounts Receivable
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">
                      2000–2999
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-red-700 dark:text-red-400">
                        Liabilities
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      2010 – Accounts Payable
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">
                      3000–3999
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-blue-700 dark:text-blue-400">
                        Equity
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      3010 – Owner&apos;s Capital
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">
                      4000–4999
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-purple-700 dark:text-purple-400">
                        Revenue
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      4010 – Sales Revenue
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">
                      5000–5999
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-orange-700 dark:text-orange-400">
                        Cost of Goods Sold
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      5010 – Raw Materials
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">
                      6000–6999
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-yellow-700 dark:text-yellow-400">
                        Operating Expenses
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      6100 – Rent, 6200 – Utilities
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">
                      7000–7999
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-gray-700 dark:text-gray-400">
                        Other Income/Expense
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      7100 – Interest Income
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                💡 Best Practices
              </h4>
              <ul className="text-amber-800 dark:text-amber-200 text-sm space-y-1">
                <li>
                  • Use numbers within the appropriate range for each account
                  type
                </li>
                <li>
                  • Leave gaps between numbers (e.g., 1010, 1020, 1030) for
                  future accounts
                </li>
                <li>
                  • Be consistent with your numbering scheme across all accounts
                </li>
                <li>
                  • Default accounts are pre-numbered following these ranges
                </li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>
                {filteredAccounts.length} account
                {filteredAccounts.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Label htmlFor="filterType">Filter by Type:</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="asset">Assets</SelectItem>
                    <SelectItem value="liability">Liabilities</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="expense">Expenses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="search">Search:</Label>
                <Input
                  id="search"
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-48"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p>Loading accounts...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map(account => (
                  <TableRow key={account.id}>
                    <TableCell>
                      {editingAccountId === account.id ? (
                        <Input
                          value={editingAccount.account_number || ''}
                          onChange={e =>
                            setEditingAccount({
                              ...editingAccount,
                              account_number: e.target.value,
                            })
                          }
                          className="w-20"
                          placeholder="Account #"
                        />
                      ) : (
                        <span className="font-mono">
                          {account.account_number}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingAccountId === account.id ? (
                        <Input
                          value={editingAccount.account_name || ''}
                          onChange={e =>
                            setEditingAccount({
                              ...editingAccount,
                              account_name: e.target.value,
                            })
                          }
                          placeholder="Account Name"
                        />
                      ) : (
                        account.account_name
                      )}
                    </TableCell>
                    <TableCell>
                      {editingAccountId === account.id ? (
                        <Select
                          value={
                            editingAccount.account_type || account.account_type
                          }
                          onValueChange={(
                            value:
                              | 'asset'
                              | 'liability'
                              | 'equity'
                              | 'revenue'
                              | 'expense'
                          ) =>
                            setEditingAccount({
                              ...editingAccount,
                              account_type: value,
                            })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asset">Asset</SelectItem>
                            <SelectItem value="liability">Liability</SelectItem>
                            <SelectItem value="equity">Equity</SelectItem>
                            <SelectItem value="revenue">Revenue</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAccountTypeColor(
                            account.account_type
                          )}`}
                        >
                          {getAccountTypeLabel(account.account_type)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingAccountId === account.id ? (
                        <Input
                          value={editingAccount.description || ''}
                          onChange={e =>
                            setEditingAccount({
                              ...editingAccount,
                              description: e.target.value,
                            })
                          }
                          placeholder="Description"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {account.description || '-'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          account.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {account.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {editingAccountId === account.id ? (
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={saving}
                          >
                            {saving ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartEdit(account)}
                            disabled={false}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
