/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useState, useEffect } from 'react'
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
  Upload,
  Download,
  Edit2,
  Check,
  X as XIcon,
  Trash2,
} from 'lucide-react'
import Papa from 'papaparse'
import {
  autoCategorizeTranaction,
  validateAndMapCategory,
} from '@/lib/categorization'
import { formatDateForDB } from '@/lib/date-utils'
import { useCompany } from '@/contexts/CompanyContext'
import { createSimpleDoubleEntryTransaction } from '@/lib/double-entry'
import type { ChartOfAccount } from '@/types/transaction'

interface CSVUploadProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  mappings: Array<{
    originalCategory: string
    mappedCategory: string
    type: string
  }>
}

interface EditableCSVRow {
  id: string
  date: string
  amount: string
  description: string
  category: string
  type: 'income' | 'expense'
  originalData: Record<string, unknown>
}

export function CSVUpload({ isOpen, onClose, onSuccess }: CSVUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [editableData, setEditableData] = useState<EditableCSVRow[]>([])
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([])
  const [localCategories, setLocalCategories] = useState<ChartOfAccount[]>([])
  const { toast } = useToast()
  const supabase = createClient()
  const { currentCompany } = useCompany()

  useEffect(() => {
    if (currentCompany) {
      fetchChartOfAccounts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany])

  const updateEditableRow = (
    id: string,
    field: keyof EditableCSVRow,
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
    // Restore original values for the row being edited
    if (editingRowId) {
      setEditableData(prev =>
        prev.map(row => {
          if (row.id === editingRowId) {
            // Restore original values from the CSV data
            const originalRow = row.originalData
            const amount = String(
              originalRow[
                Object.keys(originalRow).find(
                  col =>
                    col.toLowerCase().includes('amount') ||
                    col.toLowerCase().includes('debit') ||
                    col.toLowerCase().includes('credit')
                ) || 'Amount'
              ] || 0
            )
            const numAmount = parseFloat(amount)
            const type = numAmount >= 0 ? 'income' : 'expense'
            const description = String(
              originalRow[
                Object.keys(originalRow).find(
                  col =>
                    col.toLowerCase().includes('description') ||
                    col.toLowerCase().includes('memo') ||
                    col.toLowerCase().includes('detail')
                ) || 'Description'
              ] || ''
            )
            const autoCategory = autoCategorizeTranaction(description, type)

            return {
              ...row,
              date: String(
                originalRow[
                  Object.keys(originalRow).find(col =>
                    col.toLowerCase().includes('date')
                  ) || 'Date'
                ] || ''
              ),
              amount: amount,
              description: description,
              category: autoCategory,
              type: type,
            }
          }
          return row
        })
      )
    }
    setEditingRowId(null)
  }

  const saveEditing = (id: string) => {
    setEditingRowId(null)
  }

  const deleteRow = (id: string) => {
    setEditableData(prev => prev.filter(row => row.id !== id))
  }

  const createMissingCategory = async (
    categoryName: string,
    accountType: string
  ) => {
    if (!currentCompany) return null

    try {
      // First check if the category already exists (in case of race conditions)
      const { data: existingCategories, error: checkError } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('account_name', categoryName)

      if (checkError) {
        console.error('Error checking for existing category:', checkError)
      } else if (existingCategories && existingCategories.length > 0) {
        return existingCategories[0]
      }

      // Generate a unique account number based on type
      const typePrefix =
        {
          revenue: '4000',
          expense: '5000',
          asset: '1000',
          liability: '2000',
          equity: '3000',
        }[accountType] || '9000'

      // Get the next available number for this type
      // Use a more robust approach to avoid race conditions
      let nextNumber = parseInt(typePrefix + '10')
      let attempts = 0
      const maxAttempts = 10

      while (attempts < maxAttempts) {
        // Check if this number is already taken
        const { data: existingAccounts, error: checkError } = await supabase
          .from('chart_of_accounts')
          .select('account_number')
          .eq('company_id', currentCompany.id)
          .eq('account_number', nextNumber.toString())

        if (checkError) {
          console.error(
            `Error checking account number ${nextNumber}:`,
            checkError
          )
          // Continue to next number if there's an error
          nextNumber += 10
          attempts++
          continue
        }

        if (!existingAccounts || existingAccounts.length === 0) {
          // This number is available
          break
        }

        // Number is taken, try the next one
        nextNumber += 10
        attempts++
      }

      if (attempts >= maxAttempts) {
        throw new Error(
          `Could not find available account number for ${categoryName} after ${maxAttempts} attempts`
        )
      }

      // Try to insert the category with retry logic
      let insertAttempts = 0
      const maxInsertAttempts = 3
      let newAccount = null
      let insertError = null

      while (insertAttempts < maxInsertAttempts && !newAccount) {
        try {
          const { data, error } = await supabase
            .from('chart_of_accounts')
            .insert({
              company_id: currentCompany.id,
              account_number: nextNumber.toString(),
              account_name: categoryName,
              account_type: accountType,
              description: `Auto-created from CSV import`,
              is_active: true,
            })
            .select()
            .single()

          if (error) {
            insertError = error
            // If it's a duplicate key error, try a different account number
            if (error.code === '23505') {
              nextNumber += 10
              insertAttempts++
              continue
            } else {
              throw error
            }
          }

          newAccount = data
          break
        } catch (error) {
          insertError = error
          insertAttempts++
          if (insertAttempts >= maxInsertAttempts) {
            throw error
          }
        }
      }

      if (!newAccount) {
        throw new Error(
          `Failed to create category ${categoryName} after ${maxInsertAttempts} attempts`
        )
      }

      console.log('Created new category:', newAccount)
      return newAccount
    } catch (error) {
      console.error('Error creating category:', error)
      return null
    }
  }

  const fetchChartOfAccounts = async () => {
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
  }

  const convertToEditableData = (
    csvData: Record<string, unknown>[]
  ): EditableCSVRow[] => {
    if (csvData.length === 0) return []

    const firstRow = csvData[0]
    const columns = Object.keys(firstRow)

    // Find the actual column names (case-insensitive)
    const dateCol =
      columns.find(col => col.toLowerCase().includes('date')) || 'Date'
    const amountCol =
      columns.find(
        col =>
          col.toLowerCase().includes('amount') ||
          col.toLowerCase().includes('debit') ||
          col.toLowerCase().includes('credit')
      ) || 'Amount'
    const descCol =
      columns.find(
        col =>
          col.toLowerCase().includes('description') ||
          col.toLowerCase().includes('memo') ||
          col.toLowerCase().includes('detail')
      ) || 'Description'

    const editableRows: EditableCSVRow[] = []

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i]
      const amount = String(row[amountCol] || 0)
      const numAmount = parseFloat(amount)
      const type = numAmount >= 0 ? 'income' : 'expense'

      // Try to auto-categorize based on description
      const description = String(row[descCol] || '')
      const autoCategory = autoCategorizeTranaction(description, type)

      // Check if category exists, add locally if it doesn't
      const accountType = type === 'income' ? 'revenue' : 'expense'
      const existingCategory = localCategories.find(
        acc => acc.account_name === autoCategory
      )

      if (!existingCategory) {
        // Create a temporary local category (not saved to DB yet)
        const tempCategory: ChartOfAccount = {
          account_name: autoCategory,
          account_type: accountType,
          account_number: `temp-${Date.now()}-${i}`,
        }
        setLocalCategories(prev => [...prev, tempCategory])
      }

      editableRows.push({
        id: `row-${i}`,
        date: String(row[dateCol] || ''),
        amount: amount,
        description: description,
        category: autoCategory,
        type: type,
        originalData: row,
      })
    }

    return editableRows
  }

  const downloadSampleCSV = () => {
    const sampleData = `Date,Amount,Description
2024-01-15,-45.67,Coffee Shop Purchase
2024-01-16,2500.00,Client Payment - Invoice #1001
2024-01-17,-125.00,Office Supplies - Staples
2024-01-18,-89.99,Software Subscription - Adobe
2024-01-19,1200.00,Freelance Project Payment
2024-01-20,-67.50,Business Lunch - Restaurant`

    const blob = new Blob([sampleData], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample-bank-transactions.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const validateCSV = async (
    data: Record<string, unknown>[]
  ): Promise<ValidationResult> => {
    const errors: string[] = []
    const warnings: string[] = []
    const mappings: Array<{
      originalCategory: string
      mappedCategory: string
      type: string
    }> = []

    if (!currentCompany) {
      errors.push('No company selected')
      return { isValid: false, errors, warnings, mappings }
    }

    // Check if we have data
    if (data.length === 0) {
      errors.push('CSV file is empty')
      return { isValid: false, errors, warnings, mappings }
    }

    const firstRow = data[0]
    const columns = Object.keys(firstRow)

    // Check required columns
    const hasDate = columns.some(col => col.toLowerCase().includes('date'))
    const hasAmount = columns.some(
      col =>
        col.toLowerCase().includes('amount') ||
        col.toLowerCase().includes('debit') ||
        col.toLowerCase().includes('credit')
    )
    const hasDescription = columns.some(
      col =>
        col.toLowerCase().includes('description') ||
        col.toLowerCase().includes('memo') ||
        col.toLowerCase().includes('detail')
    )

    if (!hasDate)
      errors.push('Missing Date column (should contain "date" in the name)')
    if (!hasAmount)
      errors.push(
        'Missing Amount column (should contain "amount", "debit", or "credit" in the name)'
      )
    if (!hasDescription)
      errors.push(
        'Missing Description column (should contain "description", "memo", or "detail" in the name)'
      )

    if (errors.length > 0) {
      return { isValid: false, errors, warnings, mappings }
    }

    // Find actual column names
    const dateCol =
      columns.find(col => col.toLowerCase().includes('date')) || 'Date'
    const amountCol =
      columns.find(
        col =>
          col.toLowerCase().includes('amount') ||
          col.toLowerCase().includes('debit') ||
          col.toLowerCase().includes('credit')
      ) || 'Amount'
    const descCol =
      columns.find(
        col =>
          col.toLowerCase().includes('description') ||
          col.toLowerCase().includes('memo') ||
          col.toLowerCase().includes('detail')
      ) || 'Description'

    // Validate data rows
    let validRows = 0
    const categoryMappings = new Map<
      string,
      { originalCategory: string; mappedCategory: string; type: string }
    >()

    for (let i = 0; i < Math.min(data.length, 10); i++) {
      // Check first 10 rows for validation
      const row = data[i]

      if (!row[dateCol] || !row[amountCol] || !row[descCol]) {
        warnings.push(`Row ${i + 2}: Missing required data`)
        continue
      }

      const amount = parseFloat(row[amountCol] as string)
      if (isNaN(amount)) {
        warnings.push(`Row ${i + 2}: Invalid amount "${row[amountCol]}"`)
        continue
      }

      const type = amount > 0 ? 'income' : 'expense'
      const description = (row[descCol] as string) || 'Bank import'
      const originalCategory = autoCategorizeTranaction(description, type)

      try {
        const mappedCategory = await validateAndMapCategory(
          supabase,
          currentCompany.id,
          originalCategory,
          type
        )

        const key = `${originalCategory}-${type}`
        if (!categoryMappings.has(key)) {
          categoryMappings.set(key, { originalCategory, mappedCategory, type })
        }

        validRows++
      } catch (error) {
        warnings.push(
          `Row ${i + 2}: Could not map category "${originalCategory}"`
        )
      }
    }
    // Convert mappings to array
    mappings.push(...Array.from(categoryMappings.values()))

    if (validRows === 0) {
      errors.push('No valid transaction rows found')
    } else if (warnings.length > 0) {
      warnings.push(
        `Found ${validRows} valid transactions out of ${data.length} rows`
      )
    }

    return {
      isValid: validRows > 0,
      errors,
      warnings,
      mappings,
    }
  }

  const processFile = async (selectedFile: File) => {
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile)
      setValidation(null)
      setShowValidation(false)

      // Parse CSV for preview and validation
      Papa.parse(selectedFile, {
        header: true,
        complete: async results => {
          const data = results.data as Record<string, unknown>[]
          setPreview(data.slice(0, 5)) // Show first 5 rows in preview

          // Convert to editable format
          const editableRows = convertToEditableData(data)
          setEditableData(editableRows)

          // Validate the CSV
          const validationResult = await validateCSV(data)
          setValidation(validationResult)
          setShowValidation(true)
        },
      })
    } else {
      toast({
        title: 'Invalid file type',
        description: 'Please select a CSV file',
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
    if (!file || !validation?.isValid) return

    setUploading(true)

    try {
      if (!currentCompany) return

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Check if user is admin for this company
      const { data: userCompany } = await supabase
        .from('user_companies')
        .select('role')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .single()

      if (!userCompany || userCompany.role !== 'admin') {
        toast({
          title: 'Error',
          description: 'Only admins can upload bank statements',
          variant: 'destructive',
        })
        return
      }

      // Upload file to Supabase Storage
      setProcessingStatus('Uploading file...')
      const fileName = `${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bank-statements')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      setProcessingStatus('Processing transactions...')

      // First, create any missing categories that were added locally
      // Deduplicate by category name to avoid creating the same category multiple times
      const uniqueMissingCategories = localCategories
        .filter(cat => cat.account_number?.startsWith('temp-'))
        .filter(
          cat =>
            !chartOfAccounts.find(
              existing => existing.account_name === cat.account_name
            )
        )
        // Remove duplicates by category name
        .filter(
          (cat, index, self) =>
            index === self.findIndex(c => c.account_name === cat.account_name)
        )

      if (uniqueMissingCategories.length > 0) {
        setProcessingStatus(
          `Creating ${uniqueMissingCategories.length} missing categories...`
        )

        // Use a Set to track categories we're creating to prevent duplicates
        const categoriesBeingCreated = new Set<string>()

        for (const category of uniqueMissingCategories) {
          // Skip if we're already creating this category
          if (categoriesBeingCreated.has(category.account_name)) {
            continue
          }

          try {
            categoriesBeingCreated.add(category.account_name)

            const result = await createMissingCategory(
              category.account_name,
              category.account_type
            )

            if (result) {
            } else {
            }
          } catch (error) {
            // Continue with other categories even if one fails
          } finally {
            // Remove from the set after processing
            categoriesBeingCreated.delete(category.account_name)
          }
        }
        // Refresh chart of accounts after creating new ones
        await fetchChartOfAccounts()
      }

      // Process edited transactions
      try {
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
            // Validate and map the category to an actual chart of accounts entry
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
              Math.abs(amount),
              row.description,
              'import'
            )

            successCount++
          } catch (error) {
            console.error('Error creating transaction:', error)
            errorCount++
          }
        }

        setProcessingStatus('Saving import record...')
        // Save bank statement record
        const { error: statementError } = await supabase
          .from('bank_statements')
          .insert({
            company_id: currentCompany.id,
            uploaded_by: user.id,
            file_url: uploadData.path,
            parsed_data: editableData,
          })

        if (statementError) throw statementError

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
        onClose()
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
        // Ensure loading state is cleared even if there's an error
        setUploading(false)
        setProcessingStatus('')
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to upload file'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      setUploading(false)
      setProcessingStatus('')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-none w-screen h-screen max-h-screen p-0">
        <DialogHeader className="flex flex-row items-center justify-between p-6 border-b">
          <div>
            <DialogTitle className="text-2xl">
              Import Bank Statement
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Upload a CSV file from your bank to automatically import
              transactions
            </DialogDescription>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadSampleCSV}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Sample CSV
            </Button>
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
            <label htmlFor="file-upload" className="cursor-pointer block">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <span className="mt-2 block text-sm font-medium text-foreground">
                  Choose CSV file or drag and drop
                </span>
              </div>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={handleFileChange}
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
                  {validation?.mappings && validation.mappings.length > 0 && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md mb-4">
                      <h5 className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                        Smart Category Suggestions
                      </h5>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                        We&apos;ve automatically matched your transaction
                        categories to our chart of accounts. You can review and
                        edit these before importing.
                      </p>
                      <div className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                        {validation.mappings.map((mapping, index) => (
                          <div key={index} className="flex justify-between">
                            <span>
                              &quot;{mapping.originalCategory}&quot; (
                              {mapping.type})
                            </span>
                            <span>→ &quot;{mapping.mappedCategory}&quot;</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
                                          // Filter by account type based on transaction type
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
                                    {Math.abs(parseFloat(row.amount)).toFixed(
                                      2
                                    )}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => saveEditing(row.id)}
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

              {showValidation && validation && (
                <div className="space-y-3">
                  {validation.errors.length > 0 && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                      <h5 className="font-medium text-red-700 dark:text-red-300 mb-2">
                        Errors Found:
                      </h5>
                      <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                        {validation.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validation.warnings.length > 0 && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                      <h5 className="font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                        Warnings:
                      </h5>
                      <ul className="text-sm text-yellow-600 dark:text-yellow-400 space-y-1">
                        {validation.warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validation.isValid && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        ✓ CSV format is valid and ready for import
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Action Buttons */}
        <div className="border-t bg-muted/30 p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {validation && !validation.isValid && (
                <div className="text-sm text-muted-foreground">
                  <p>Please fix the errors above before importing.</p>
                  <p className="mt-1">
                    <strong>Expected CSV format:</strong> Date, Amount,
                    Description columns are required. Negative amounts are
                    expenses, positive amounts are income.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || !validation?.isValid}
                className={
                  validation?.isValid ? '' : 'opacity-50 cursor-not-allowed'
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
