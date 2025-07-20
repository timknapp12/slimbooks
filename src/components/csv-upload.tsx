'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Upload } from 'lucide-react'
import Papa from 'papaparse'
import { autoCategorizeTranaction } from '@/lib/categorization'

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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('company_id, role')
        .eq('id', user.id)
        .single()

      if (!userData?.company_id || userData.role !== 'admin') {
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
            const transactions = (results.data as Record<string, unknown>[])
              .filter((row) => row.Date && row.Amount && row.Description)
              .map((row) => {
                const amount = parseFloat(row.Amount as string)
                const type = amount > 0 ? 'income' : 'expense'
                const description = (row.Description as string) || 'Bank import'
                
                return {
                  company_id: userData.company_id,
                  user_id: user.id,
                  date: new Date(row.Date as string).toISOString().split('T')[0],
                  amount: Math.abs(amount),
                  type,
                  category: autoCategorizeTranaction(description, type),
                  description,
                  source: 'import'
                }
              })

            if (transactions.length > 0) {
              const { error: transactionError } = await supabase
                .from('transactions')
                .insert(transactions)

              if (transactionError) throw transactionError
            }

            // Save bank statement record
            const { error: statementError } = await supabase
              .from('bank_statements')
              .insert({
                company_id: userData.company_id,
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