'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MoreHorizontal,
  Printer,
  XCircle,
  CheckCircle,
  Trash2,
} from 'lucide-react'
import { formatDate } from '@/lib/date-utils'
import { formatCurrency } from '@/lib/transaction-utils'
import type { Check, CheckStatus } from '@/types/check'

interface CheckTableProps {
  checks: Check[]
  onPrint: (check: Check) => void
  onVoid: (checkId: string, reason?: string) => Promise<boolean>
  onMarkCleared: (checkId: string) => Promise<boolean>
  onDelete: (checkId: string) => Promise<boolean>
  className?: string
}

const statusColors: Record<CheckStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  printed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  voided: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  cleared: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  reconciled: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

const statusLabels: Record<CheckStatus, string> = {
  pending: 'Pending',
  printed: 'Printed',
  voided: 'Voided',
  cleared: 'Cleared',
  reconciled: 'Reconciled',
}

export function CheckTable({
  checks,
  onPrint,
  onVoid,
  onMarkCleared,
  onDelete,
  className = '',
}: CheckTableProps) {
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCheck, setSelectedCheck] = useState<Check | null>(null)
  const [voidReason, setVoidReason] = useState('')

  const handleVoidClick = (check: Check) => {
    setSelectedCheck(check)
    setVoidReason('')
    setVoidDialogOpen(true)
  }

  const handleDeleteClick = (check: Check) => {
    setSelectedCheck(check)
    setDeleteDialogOpen(true)
  }

  const handleVoidConfirm = async () => {
    if (selectedCheck) {
      await onVoid(selectedCheck.id, voidReason || undefined)
      setVoidDialogOpen(false)
      setSelectedCheck(null)
      setVoidReason('')
    }
  }

  const handleDeleteConfirm = async () => {
    if (selectedCheck) {
      await onDelete(selectedCheck.id)
      setDeleteDialogOpen(false)
      setSelectedCheck(null)
    }
  }

  return (
    <>
      <div className={`rounded-md border ${className}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Check #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payee</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No checks found
                </TableCell>
              </TableRow>
            ) : (
              checks.map(check => (
                <TableRow
                  key={check.id}
                  className={check.status === 'voided' ? 'opacity-60' : ''}
                >
                  <TableCell className="font-mono font-medium">
                    {check.check_number}
                  </TableCell>
                  <TableCell>{formatDate(check.date)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {check.payee_name}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-muted-foreground">
                    {check.memo || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {check.status === 'voided' ? (
                      <span className="line-through">{formatCurrency(check.amount)}</span>
                    ) : (
                      formatCurrency(check.amount)
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[check.status]} variant="secondary">
                      {statusLabels[check.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Print - available for pending and printed checks */}
                        {['pending', 'printed'].includes(check.status) && (
                          <DropdownMenuItem onClick={() => onPrint(check)}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print Check
                          </DropdownMenuItem>
                        )}

                        {/* Mark as Cleared - available for pending and printed */}
                        {['pending', 'printed'].includes(check.status) && (
                          <DropdownMenuItem onClick={() => onMarkCleared(check.id)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark as Cleared
                          </DropdownMenuItem>
                        )}

                        {['pending', 'printed'].includes(check.status) && (
                          <DropdownMenuSeparator />
                        )}

                        {/* Void - available for pending and printed checks */}
                        {['pending', 'printed'].includes(check.status) && (
                          <DropdownMenuItem
                            onClick={() => handleVoidClick(check)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Void Check
                          </DropdownMenuItem>
                        )}

                        {/* Delete - only for pending checks */}
                        {check.status === 'pending' && (
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(check)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Check
                          </DropdownMenuItem>
                        )}

                        {/* Show void info for voided checks */}
                        {check.status === 'voided' && (
                          <DropdownMenuItem disabled>
                            <span className="text-muted-foreground text-sm">
                              Voided{check.void_reason && `: ${check.void_reason}`}
                            </span>
                          </DropdownMenuItem>
                        )}

                        {/* Show cleared info */}
                        {check.status === 'cleared' && (
                          <DropdownMenuItem disabled>
                            <span className="text-muted-foreground text-sm">
                              Cleared on {check.cleared_at ? formatDate(check.cleared_at.split('T')[0]) : 'N/A'}
                            </span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Void Confirmation Dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Check #{selectedCheck?.check_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will void the check and reverse the associated transaction. The check
              number will be marked as voided in your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="void-reason">Reason for voiding (optional)</Label>
            <Input
              id="void-reason"
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              placeholder="e.g., Wrong amount, duplicate payment, etc."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Void Check
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Check #{selectedCheck?.check_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this check and its associated transaction.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Check
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
