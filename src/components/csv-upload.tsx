'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Upload } from 'lucide-react'
import Papa from 'papaparse'
import { autoCategorizeTranaction } from '@/lib/categorization'
import { formatDateForDB } from '@/lib/date-utils'
import { useCompany } from '@/contexts/CompanyContext'
import { createSimpleDoubleEntryTransaction } from '@/lib/double-entry'

interface CSVUploadProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CSVUpload({ isOpen, onClose, onSuccess }: CSVUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()
  const { currentCompany } = useCompany()

  const processFile = (selectedFile: File) => {
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile)
      
      // Parse CSV for preview
      Papa.parse(selectedFile, {
        header: true,
        preview: 5,
        complete: (results) => {
          setPreview(results.data as Record<string, unknown>[])
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
    if (!file) return

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
      const fileName = `${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bank-statements')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Parse CSV and create transactions
      Papa.parse(file, {
        header: true,
        complete: async (results) => {
          try {
            const data = results.data as Record<string, unknown>[]
            
            // Check if we have the required columns
            if (data.length === 0) {
              throw new Error('CSV file is empty')
            }
            
            const firstRow = data[0]
            const columns = Object.keys(firstRow)
            const hasDate = columns.some(col => col.toLowerCase().includes('date'))
            const hasAmount = columns.some(col => col.toLowerCase().includes('amount') || col.toLowerCase().includes('debit') || col.toLowerCase().includes('credit'))
            const hasDescription = columns.some(col => col.toLowerCase().includes('description') || col.toLowerCase().includes('memo') || col.toLowerCase().includes('detail'))
            
            if (!hasDate || !hasAmount || !hasDescription) {
              throw new Error(`CSV must contain Date, Amount, and Description columns. Found columns: ${columns.join(', ')}`)
            }
            
            // Find the actual column names (case-insensitive)
            const dateCol = columns.find(col => col.toLowerCase().includes('date')) || 'Date'
            const amountCol = columns.find(col => col.toLowerCase().includes('amount') || col.toLowerCase().includes('debit') || col.toLowerCase().includes('credit')) || 'Amount'
            const descCol = columns.find(col => col.toLowerCase().includes('description') || col.toLowerCase().includes('memo') || col.toLowerCase().includes('detail')) || 'Description'
            
            const transactions = data
              .filter((row) => row[dateCol] && row[amountCol] && row[descCol])
              .map((row) => {
                const amount = parseFloat(row[amountCol] as string)
                if (isNaN(amount)) return null
                
                const type = amount > 0 ? 'income' : 'expense'
                const description = (row[descCol] as string) || 'Bank import'
                
                return {
                  company_id: currentCompany.id,
                  user_id: user.id,
                  date: formatDateForDB(new Date(row[dateCol] as string)),
                  amount: Math.abs(amount),
                  type,
                  category: autoCategorizeTranaction(description, type),
                  description,
                  source: 'import'
                }
              })
              .filter(Boolean)

            if (transactions.length === 0) {
              throw new Error('No valid transactions found. Please check your CSV format and data.')
            }

            // Convert transactions to double-entry format and create them
            for (const transaction of transactions) {
              if (transaction) {
                await createSimpleDoubleEntryTransaction(
                  supabase,
                  transaction.company_id,
                  transaction.user_id,
                  transaction.date,
                  transaction.type as 'income' | 'expense' | 'asset' | 'liability' | 'equity',
                  transaction.category,
                  transaction.amount,
                  transaction.description,
                  'import'
                )
              }
            }

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

            toast({
              title: 'Success',
              description: `Imported ${transactions.length} transactions from bank statement`,
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
    } finally {
      setUploading(false)
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

              <div className="flex gap-2">
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Import Transactions'}
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}