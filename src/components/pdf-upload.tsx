'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  FileText,
  Edit2,
  Check,
  X as XIcon,
  Trash2,
  Bot,
  CheckCircle,
} from 'lucide-react'
import {
  autoCategorizeTranaction,
  validateAndMapCategory,
} from '@/lib/categorization'
import { formatDateForDB } from '@/lib/date-utils'
import { useCompany } from '@/contexts/CompanyContext'
import { createSimpleDoubleEntryTransaction } from '@/lib/double-entry'
import type { ChartOfAccount } from '@/types/transaction'

interface PDFUploadProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface ParsedTransaction {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
}
interface EditablePDFRow {
  id: string
  date: string
  amount: string
  description: string
  category: string
  type: 'income' | 'expense'
  originalData: ParsedTransaction
}

export function PDFUpload({ isOpen, onClose, onSuccess }: PDFUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editableData, setEditableData] = useState<EditablePDFRow[]>([])
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([])
  const [localCategories, setLocalCategories] = useState<ChartOfAccount[]>([])
  const [aiProcessing, setAiProcessing] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()
  const { currentCompany } = useCompany()

  const fetchChartOfAccounts = useCallback(async () => {
    if (!currentCompany) return

    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('account_name')

      if (error) throw error
      setChartOfAccounts(data || [])
      setLocalCategories(data || [])
    } catch (error) {
      console.error('Error fetching chart of accounts:', error)
    }
  }, [currentCompany, supabase])

  useEffect(() => {
    if (currentCompany) {
      fetchChartOfAccounts()
    }
  }, [currentCompany, fetchChartOfAccounts])

  const updateEditableRow = (
    id: string,
    field: keyof EditablePDFRow,
    value: string
  ) => {
    setEditableData(prev =>
      prev.map(row => (row.id === id ? { ...row, [field]: value } : row))
    )
  }

  const startEditing = (id: string) => {
    setEditingRowId(id)
  }

  const cancelEditing = () => {
    if (editingRowId) {
      setEditableData(prev =>
        prev.map(row => {
          if (row.id === editingRowId) {
            const originalData = row.originalData
            const autoCategory = autoCategorizeTranaction(
              originalData.description,
              originalData.type
            )

            return {
              ...row,
              date: originalData.date,
              amount: String(Math.abs(originalData.amount)),
              description: originalData.description,
              category: autoCategory,
              type: originalData.type,
            }
          }
          return row
        })
      )
    }
    setEditingRowId(null)
  }

  const saveEditing = () => {
    setEditingRowId(null)
  }

  const deleteRow = (id: string) => {
    setEditableData(prev => prev.filter(row => row.id !== id))
  }

  const resetComponent = () => {
    setFile(null)
    setEditableData([])
    setEditingRowId(null)
    setProcessingStatus('')
    setAiProcessing(false)
    setUploading(false)
    setLocalCategories(chartOfAccounts)
  }

  const convertToEditableData = (
    transactions: ParsedTransaction[]
  ): EditablePDFRow[] => {
    if (transactions.length === 0) return []

    const editableRows: EditablePDFRow[] = []

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i]

      // Use the category from AI response, fallback to auto-categorization
      const aiCategory =
        transaction.category ||
        autoCategorizeTranaction(transaction.description, transaction.type)

      const accountType = transaction.type === 'income' ? 'revenue' : 'expense'
      const existingCategory = localCategories.find(
        acc => acc.account_name === aiCategory
      )

      if (!existingCategory) {
        const tempCategory: ChartOfAccount = {
          account_name: aiCategory,
          account_type: accountType,
          account_number: `temp-${Date.now()}-${i}`,
        }
        setLocalCategories(prev => [...prev, tempCategory])
      }

      editableRows.push({
        id: `row-${i}`,
        date: transaction.date,
        amount: String(Math.abs(transaction.amount)),
        description: transaction.description,
        category: aiCategory,
        type: transaction.type,
        originalData: transaction,
      })
    }

    return editableRows
  }

  // Progress tracking with Server-Sent Events for status updates
  const connectToProgress = (id: string) => {
    console.log('Connecting to progress stream for ID:', id)
    const eventSource = new EventSource(`/api/parse-pdf/progress?id=${id}`)

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data)
        console.log('Progress update received:', data)

        if (data.type === 'connected') {
          console.log('Connected to progress stream')
          return
        }

        setProcessingStatus(data.message || '')

        if (data.step === 'complete') {
          console.log('Progress complete, closing stream')
          eventSource.close()
        }
      } catch (error) {
        console.error('Error parsing progress data:', error)
      }
    }

    eventSource.onerror = error => {
      console.error('Progress stream error:', error)
      eventSource.close()
    }

    return eventSource
  }

  const processFile = async (selectedFile: File) => {
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      setEditableData([])
      setAiProcessing(true)
      setProcessingStatus('Starting PDF processing...')

      let eventSource: EventSource | null = null

      try {
        if (!currentCompany) {
          throw new Error('No company selected')
        }

        // Generate progress ID upfront
        const progressId = `pdf-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 11)}`

        // Connect to progress stream BEFORE making the request
        eventSource = connectToProgress(progressId)

        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('companyId', currentCompany.id)
        formData.append('progressId', progressId) // Send progress ID to backend

        const response = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to process PDF')
        }

        const result = await response.json()

        if (!result.success || !result.transactions) {
          throw new Error('No transactions found in PDF')
        }

        const editableRows = convertToEditableData(result.transactions)
        setEditableData(editableRows)

        setProcessingStatus('Complete!')

        toast({
          title: 'PDF Processed Successfully',
          description: `Found ${result.transactions.length} transactions. Review and edit before importing.`,
        })
      } catch (error) {
        console.error('Error processing PDF:', error)
        toast({
          title: 'Error Processing PDF',
          description:
            error instanceof Error ? error.message : 'Failed to process PDF',
          variant: 'destructive',
        })
      } finally {
        if (eventSource) {
          eventSource.close()
        }
        setAiProcessing(false)
        setTimeout(() => {
          setProcessingStatus('')
        }, 2000)
      }
    } else {
      toast({
        title: 'Invalid file type',
        description: 'Please select a PDF file',
        variant: 'destructive',
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      processFile(selectedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      processFile(files[0])
    }
  }

  const handleUpload = async () => {
    if (!file || editableData.length === 0) return

    setUploading(true)

    try {
      if (!currentCompany) return

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      setProcessingStatus('Creating missing categories...')

      const uniqueMissingCategories = localCategories
        .filter(cat => cat.account_number?.startsWith('temp-'))
        .filter(
          cat =>
            !chartOfAccounts.find(
              existing => existing.account_name === cat.account_name
            )
        )
        .filter(
          (cat, index, self) =>
            index === self.findIndex(c => c.account_name === cat.account_name)
        )

      for (const category of uniqueMissingCategories) {
        try {
          await createMissingCategory(
            category.account_name,
            category.account_type
          )
        } catch (error) {
          console.error('Error creating category:', error)
        }
      }

      if (uniqueMissingCategories.length > 0) {
        await fetchChartOfAccounts()
      }

      setProcessingStatus('Importing transactions...')

      let successCount = 0
      let errorCount = 0
      const totalRows = editableData.length

      for (let i = 0; i < editableData.length; i++) {
        const row = editableData[i]
        setProcessingStatus(
          `Processing transaction ${i + 1} of ${totalRows}...`
        )

        if (!row.date || !row.amount || !row.description) {
          errorCount++
          continue
        }

        const amount = parseFloat(row.amount)
        if (isNaN(amount)) {
          errorCount++
          continue
        }

        try {
          const validatedCategory = await validateAndMapCategory(
            supabase,
            currentCompany.id,
            row.category,
            row.type
          )

          await createSimpleDoubleEntryTransaction(
            supabase,
            currentCompany.id,
            user.id,
            formatDateForDB(new Date(row.date)),
            row.type,
            validatedCategory,
            amount,
            row.description,
            'import'
          )

          successCount++
        } catch (error) {
          console.error('Error creating transaction:', error)
          errorCount++
        }
      }

      const message =
        errorCount > 0
          ? `Imported ${successCount} transactions successfully. ${errorCount} transactions failed.`
          : `Imported ${successCount} transactions successfully.`

      toast({
        title: 'Import Complete',
        description: message,
        variant: errorCount > 0 ? 'destructive' : 'default',
      })

      onSuccess()
      handleClose()
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to process transactions'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      setProcessingStatus('')
    }
  }

  const createMissingCategory = async (
    categoryName: string,
    accountType: string
  ) => {
    if (!currentCompany) return null

    try {
      const typePrefix =
        {
          revenue: '4000',
          expense: '5000',
          asset: '1000',
          liability: '2000',
          equity: '3000',
        }[accountType] || '9000'

      let nextNumber = parseInt(typePrefix + '10')
      let attempts = 0
      const maxAttempts = 10

      while (attempts < maxAttempts) {
        const { data: existingAccounts, error: checkError } = await supabase
          .from('chart_of_accounts')
          .select('account_number')
          .eq('company_id', currentCompany.id)
          .eq('account_number', nextNumber.toString())

        if (checkError) {
          nextNumber += 10
          attempts++
          continue
        }

        if (!existingAccounts || existingAccounts.length === 0) {
          break
        }

        nextNumber += 10
        attempts++
      }

      const { data, error } = await supabase
        .from('chart_of_accounts')
        .insert({
          company_id: currentCompany.id,
          account_number: nextNumber.toString(),
          account_name: categoryName,
          account_type: accountType,
          description: `Auto-created from PDF import`,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating category:', error)
      return null
    }
  }

  const handleClose = () => {
    resetComponent()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-none w-screen h-screen max-h-screen p-0">
        <DialogHeader className="flex flex-row items-center justify-between p-6 border-b">
          <div>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Bot className="h-6 w-6 text-blue-600" />
              Import PDF Bank Statement
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Upload a PDF bank statement and let AI extract transactions
              automatically
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver
                ? 'border-primary bg-primary/10'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <label htmlFor="pdf-upload" className="cursor-pointer block">
              {aiProcessing ? (
                <Bot className="mx-auto h-12 w-12 text-blue-600 animate-pulse" />
              ) : (
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
              )}
              <div className="mt-4">
                <span className="mt-2 block text-sm font-medium text-foreground">
                  {aiProcessing
                    ? 'AI is processing your PDF...'
                    : 'Choose PDF file or drag and drop'}
                </span>
                {processingStatus && (
                  <span className="mt-1 block text-xs text-blue-600 animate-pulse">
                    {processingStatus}
                  </span>
                )}
                {aiProcessing && (
                  <div className="mt-3 flex justify-center">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <input
                id="pdf-upload"
                name="pdf-upload"
                type="file"
                accept=".pdf"
                className="sr-only"
                onChange={handleFileChange}
                disabled={aiProcessing}
              />
            </label>
          </div>

          {file && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Selected file: {file.name}</h4>
                <p className="text-sm text-muted-foreground">
                  Size: {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>

              {editableData.length > 0 && (
                <div>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md mb-4">
                    <h5 className="font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      AI Extracted Transactions
                    </h5>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      AI found {editableData.length} transactions in your PDF.
                      Review and edit them before importing.
                    </p>
                  </div>

                  <h4 className="font-medium mb-4">
                    Review and Edit Transactions ({editableData.length} rows)
                  </h4>
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editableData.map(row => {
                          const isEditing = editingRowId === row.id
                          return (
                            <TableRow key={row.id}>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    type="date"
                                    value={row.date}
                                    onChange={e =>
                                      updateEditableRow(
                                        row.id,
                                        'date',
                                        e.target.value
                                      )
                                    }
                                    className="w-40 h-8 text-sm"
                                  />
                                ) : (
                                  row.date
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    value={row.description}
                                    onChange={e =>
                                      updateEditableRow(
                                        row.id,
                                        'description',
                                        e.target.value
                                      )
                                    }
                                    className="h-8 text-sm"
                                  />
                                ) : (
                                  row.description
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Select
                                    value={row.category}
                                    onValueChange={value =>
                                      updateEditableRow(
                                        row.id,
                                        'category',
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger className="w-[140px] h-8 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {localCategories
                                        .filter(account => {
                                          if (row.type === 'income') {
                                            return (
                                              account.account_type === 'revenue'
                                            )
                                          } else if (row.type === 'expense') {
                                            return (
                                              account.account_type === 'expense'
                                            )
                                          }
                                          return true
                                        })
                                        .map((account, index) => (
                                          <SelectItem
                                            key={`${account.account_name}-${
                                              account.account_number || index
                                            }`}
                                            value={account.account_name}
                                          >
                                            {account.account_name}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  row.category
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Select
                                    value={row.type}
                                    onValueChange={value =>
                                      updateEditableRow(
                                        row.id,
                                        'type',
                                        value as 'income' | 'expense'
                                      )
                                    }
                                  >
                                    <SelectTrigger className="w-[100px] h-8 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="income">
                                        Income
                                      </SelectItem>
                                      <SelectItem value="expense">
                                        Expense
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      row.type === 'income'
                                        ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                                        : 'bg-red-500/20 text-red-700 dark:text-red-400'
                                    }`}
                                  >
                                    {row.type}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={row.amount}
                                    onChange={e =>
                                      updateEditableRow(
                                        row.id,
                                        'amount',
                                        e.target.value
                                      )
                                    }
                                    className="w-24 h-8 text-sm"
                                  />
                                ) : (
                                  <span
                                    className={`font-medium ${
                                      row.type === 'income'
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}
                                  >
                                    {row.type === 'income' ? '+' : '-'}$
                                    {parseFloat(row.amount).toFixed(2)}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={saveEditing}
                                      className="h-8 w-8 p-0 hover:bg-green-500/10 hover:border-green-500/30"
                                    >
                                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={cancelEditing}
                                      className="h-8 w-8 p-0 hover:bg-red-500/10 hover:border-red-500/30"
                                    >
                                      <XIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => startEditing(row.id)}
                                      className="h-8 w-8 p-0 hover:bg-blue-500/10 hover:border-blue-500/30"
                                    >
                                      <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => deleteRow(row.id)}
                                      className="h-8 w-8 p-0 hover:bg-red-500/10 hover:border-red-500/30"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t bg-muted/30 p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {aiProcessing && (
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  <p className="flex items-center gap-2">
                    <Bot className="h-4 w-4 animate-pulse" />
                    AI is analyzing your PDF bank statement...
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={
                  uploading || editableData.length === 0 || aiProcessing
                }
                className={
                  editableData.length > 0 && !aiProcessing
                    ? ''
                    : 'opacity-50 cursor-not-allowed'
                }
              >
                {uploading
                  ? processingStatus || 'Processing...'
                  : 'Import Transactions'}
              </Button>
            </div>
          </div>

          {uploading && processingStatus && (
            <div className="mt-3 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 p-3 rounded border">
              {processingStatus}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
