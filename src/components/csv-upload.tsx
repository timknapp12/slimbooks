'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Upload, Download } from 'lucide-react'
import Papa from 'papaparse'
import { autoCategorizeTranaction, validateAndMapCategory } from '@/lib/categorization'
import { formatDateForDB } from '@/lib/date-utils'
import { useCompany } from '@/contexts/CompanyContext'
import { createSimpleDoubleEntryTransaction } from '@/lib/double-entry'

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

export function CSVUpload({ isOpen, onClose, onSuccess }: CSVUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const { toast } = useToast()
  const supabase = createClient()
  const { currentCompany } = useCompany()

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

  const validateCSV = async (data: Record<string, unknown>[]): Promise<ValidationResult> => {
    const errors: string[] = []
    const warnings: string[] = []
    const mappings: Array<{ originalCategory: string; mappedCategory: string; type: string }> = []

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
    const hasAmount = columns.some(col => col.toLowerCase().includes('amount') || col.toLowerCase().includes('debit') || col.toLowerCase().includes('credit'))
    const hasDescription = columns.some(col => col.toLowerCase().includes('description') || col.toLowerCase().includes('memo') || col.toLowerCase().includes('detail'))
    
    if (!hasDate) errors.push('Missing Date column (should contain "date" in the name)')
    if (!hasAmount) errors.push('Missing Amount column (should contain "amount", "debit", or "credit" in the name)')
    if (!hasDescription) errors.push('Missing Description column (should contain "description", "memo", or "detail" in the name)')

    if (errors.length > 0) {
      return { isValid: false, errors, warnings, mappings }
    }

    // Find actual column names
    const dateCol = columns.find(col => col.toLowerCase().includes('date')) || 'Date'
    const amountCol = columns.find(col => col.toLowerCase().includes('amount') || col.toLowerCase().includes('debit') || col.toLowerCase().includes('credit')) || 'Amount'
    const descCol = columns.find(col => col.toLowerCase().includes('description') || col.toLowerCase().includes('memo') || col.toLowerCase().includes('detail')) || 'Description'

    // Validate data rows
    let validRows = 0
    const categoryMappings = new Map<string, { originalCategory: string; mappedCategory: string; type: string }>()

    for (let i = 0; i < Math.min(data.length, 10); i++) { // Check first 10 rows for validation
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
        warnings.push(`Row ${i + 2}: Could not map category "${originalCategory}"`)
    }
  }
    // Convert mappings to array
    mappings.push(...Array.from(categoryMappings.values()))

    if (validRows === 0) {
      errors.push('No valid transaction rows found')
    } else if (warnings.length > 0) {
      warnings.push(`Found ${validRows} valid transactions out of ${data.length} rows`)
    }

    return {
      isValid: validRows > 0,
      errors,
      warnings,
      mappings
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
        preview: 10,
        complete: async (results) => {
          const data = results.data as Record<string, unknown>[]
          setPreview(data.slice(0, 5)) // Show first 5 rows in preview
          
          // Validate the CSV
          const validationResult = await validateCSV(data)
          setValidation(validationResult)
          setShowValidation(true)
        }
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

      const { data: { user } } = await supabase.auth.getUser()
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

      // Parse CSV and create transactions
      Papa.parse(file, {
        header: true,
        complete: async (results) => {
          try {
            const data = results.data as Record<string, unknown>[]
            
            const firstRow = data[0]
            const columns = Object.keys(firstRow)
            
            // Find the actual column names (case-insensitive)
            const dateCol = columns.find(col => col.toLowerCase().includes('date')) || 'Date'
            const amountCol = columns.find(col => col.toLowerCase().includes('amount') || col.toLowerCase().includes('debit') || col.toLowerCase().includes('credit')) || 'Amount'
            const descCol = columns.find(col => col.toLowerCase().includes('description') || col.toLowerCase().includes('memo') || col.toLowerCase().includes('detail')) || 'Description'
            
            let successCount = 0
            let errorCount = 0
            const totalRows = data.length

            for (let i = 0; i < data.length; i++) {
              const row = data[i]
              setProcessingStatus(`Processing transaction ${i + 1} of ${totalRows}...`)
              if (!row[dateCol] || !row[amountCol] || !row[descCol]) {
                errorCount++
                continue
              }

              const amount = parseFloat(row[amountCol] as string)
              if (isNaN(amount)) {
                errorCount++
                continue
              }
              
              const type = amount > 0 ? 'income' : 'expense'
              const description = (row[descCol] as string) || 'Bank import'
              const originalCategory = autoCategorizeTranaction(description, type)
              
              try {
                // Validate and map the category to an actual chart of accounts entry
                const validatedCategory = await validateAndMapCategory(
                  supabase,
                  currentCompany.id,
                  originalCategory,
                  type
                )

                await createSimpleDoubleEntryTransaction(
                  supabase,
                  currentCompany.id,
                  user.id,
                  formatDateForDB(new Date(row[dateCol] as string)),
                  type as 'income' | 'expense' | 'asset' | 'liability' | 'equity',
                  validatedCategory,
                  Math.abs(amount),
                  description,
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
                parsed_data: results.data
              })

            if (statementError) throw statementError

            const message = errorCount > 0 
              ? `Imported ${successCount} transactions successfully. ${errorCount} transactions failed.`
              : `Imported ${successCount} transactions successfully.`

            toast({
              title: 'Import Complete',
              description: message,
              variant: errorCount > 0 ? 'destructive' : 'default'
            })

            onSuccess()
            onClose()
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to process CSV file'
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
        }
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload file'
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
          <DialogDescription>
            Upload a CSV file from your bank to automatically import transactions
          </DialogDescription>
          <div className="flex justify-end">
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
        
        <div className="space-y-4">
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
                <p className="text-sm text-gray-500">Size: {(file.size / 1024).toFixed(2)} KB</p>
              </div>

              {preview.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Preview (first 5 rows):</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-300">
                      <thead>
                        <tr className="bg-muted/50">
                          {Object.keys(preview[0]).map((header) => (
                            <th key={header} className="border border-gray-300 px-2 py-1 text-xs">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, index) => (
                          <tr key={index}>
                            {Object.values(row).map((value, cellIndex) => (
                              <td key={cellIndex} className="border border-gray-300 px-2 py-1 text-xs">
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {showValidation && validation && (
                <div className="space-y-3">
                  {validation.errors.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <h5 className="font-medium text-red-800 mb-2">Errors Found:</h5>
                      <ul className="text-sm text-red-700 space-y-1">
                        {validation.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validation.warnings.length > 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <h5 className="font-medium text-yellow-800 mb-2">Warnings:</h5>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        {validation.warnings.map((warning, index) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validation.mappings.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <h5 className="font-medium text-blue-800 mb-2">Category Mappings:</h5>
                      <div className="text-sm text-blue-700 space-y-1">
                        {validation.mappings.map((mapping, index) => (
                          <div key={index} className="flex justify-between">
                            <span>"{mapping.originalCategory}" ({mapping.type})</span>
                            <span>→ "{mapping.mappedCategory}"</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {validation.isValid && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-700">✓ CSV format is valid and ready for import</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={handleUpload} 
                  disabled={uploading || !validation?.isValid}
                  className={validation?.isValid ? '' : 'opacity-50 cursor-not-allowed'}
                >
                  {uploading ? (processingStatus || 'Processing...') : 'Import Transactions'}
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>

              {uploading && processingStatus && (
                <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                  {processingStatus}
                </div>
              )}

              {validation && !validation.isValid && (
                <div className="text-sm text-gray-600">
                  <p>Please fix the errors above before importing.</p>
                  <p className="mt-1">
                    <strong>Expected CSV format:</strong> Date, Amount, Description columns are required.
                    Negative amounts are expenses, positive amounts are income.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}