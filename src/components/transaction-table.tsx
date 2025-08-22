'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Edit2, Check, X, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'
import { formatCurrency, getTransactionTypeColor, getAmountColor, getAmountSign } from '@/lib/transaction-utils'
import type { Transaction, ChartOfAccount } from '@/types/transaction'

interface TransactionTableProps {
  transactions: Transaction[]
  chartOfAccounts: ChartOfAccount[]
  editingTransactionId: string | null
  editingTransaction: Partial<Transaction>
  onStartEditing: (transaction: Transaction) => void
  onCancelEditing: () => void
  onSaveTransaction: () => Promise<boolean>
  onDeleteTransaction: (transactionId: string) => Promise<boolean>
  onUpdateEditingTransaction: (updates: Partial<Transaction>) => void
  onPermanentlyDeleteTransaction?: (transactionId: string) => Promise<boolean>
  showActions?: boolean
  className?: string
  isDeletedSection?: boolean
}

export function TransactionTable({
  transactions,
  chartOfAccounts,
  editingTransactionId,
  editingTransaction,
  onStartEditing,
  onCancelEditing,
  onSaveTransaction,
  onDeleteTransaction,
  onUpdateEditingTransaction,
  onPermanentlyDeleteTransaction,
  showActions = true,
  className = '',
  isDeletedSection
}: TransactionTableProps) {
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

  return (
    <Table className={`${className} ${isDeletedSection ? 'opacity-75' : ''}`}>
      <TableHeader>
        <TableRow className={isDeletedSection ? 'bg-gray-100' : ''}>
          <TableHead className={isDeletedSection ? 'text-gray-600' : ''}>Date</TableHead>
          <TableHead className={isDeletedSection ? 'text-gray-600' : ''}>Description</TableHead>
          <TableHead className={isDeletedSection ? 'text-gray-600' : ''}>Category</TableHead>
          <TableHead className={isDeletedSection ? 'text-gray-600' : ''}>Type</TableHead>
          <TableHead className={`text-right ${isDeletedSection ? 'text-gray-600' : ''}`}>Amount</TableHead>
          {showActions && <TableHead className={isDeletedSection ? 'text-gray-600' : ''}>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => {
          const isEditing = editingTransactionId === transaction.id
          
          return (
            <TableRow key={transaction.id} className={`${isEditing ? '' : ''} ${isDeletedSection ? 'opacity-75 bg-gray-50 hover:bg-gray-100' : ''}`}>
              <TableCell className={`align-middle ${isDeletedSection ? 'text-gray-600' : ''}`}>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editingTransaction.date || ''}
                    onChange={(e) => onUpdateEditingTransaction({ date: e.target.value })}
                    className="w-36 h-8 text-sm"
                  />
                ) : (
                  formatDate(transaction.date)
                )}
              </TableCell>
              <TableCell className={`align-middle ${isDeletedSection ? 'text-gray-600' : ''}`}>
                {isEditing ? (
                  <Input
                    value={editingTransaction.description || ''}
                    onChange={(e) => onUpdateEditingTransaction({ description: e.target.value })}
                    className="h-8 text-sm"
                  />
                ) : (
                  transaction.description
                )}
              </TableCell>
              <TableCell className={`align-middle ${isDeletedSection ? 'text-gray-600' : ''}`}>
                {isEditing ? (
                  <Select 
                    value={editingTransaction.category || ''} 
                    onValueChange={(value) => onUpdateEditingTransaction({ category: value })}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getCategoriesByType(editingTransaction.type || 'expense').map((category: string) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  transaction.category
                )}
              </TableCell>
              <TableCell className={`align-middle ${isDeletedSection ? 'text-gray-600' : ''}`}>
                {isEditing ? (
                  <Select 
                    value={editingTransaction.type || ''} 
                     onValueChange={(value: 'income' | 'expense' | 'asset' | 'liability' | 'equity') => {
                       const categoriesForType = getCategoriesByType(value);
                       const currentCategory = editingTransaction.category;
                       const isCategoryValidForType = categoriesForType.includes(currentCategory || '');
                       
                       onUpdateEditingTransaction({ 
                         type: value,
                         // Reset category if current category is not valid for new type
                         category: isCategoryValidForType ? currentCategory : categoriesForType[0] || ''
                       });
                     }}                  >
                    <SelectTrigger className="w-[100px] h-8 text-sm">
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
                ) : (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isDeletedSection ? 'opacity-75 ' : ''}${getTransactionTypeColor(transaction.type)}`}>
                    {transaction.type}
                  </span>
                )}
              </TableCell>
              <TableCell className={`text-right align-middle ${isDeletedSection ? 'text-gray-600' : ''}`}>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={editingTransaction.amount || ''}
                    onChange={(e) => onUpdateEditingTransaction({ amount: parseFloat(e.target.value) || 0 })}
                    className="w-24 h-8 text-sm"
                  />
                ) : (
                  <span className={`font-medium ${isDeletedSection ? 'opacity-75 ' : ''}${getAmountColor(transaction.type)}`}>
                    {getAmountSign(transaction.type)}{formatCurrency(transaction.amount)}
                  </span>
                )}
              </TableCell>
              {showActions && (
                <TableCell className={`align-middle ${isDeletedSection ? 'text-gray-600' : ''}`}>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onSaveTransaction}
                        className="h-8 w-8 p-0 hover:bg-green-50 hover:border-green-300"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onCancelEditing}
                        className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-300"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {!isDeletedSection && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onStartEditing(transaction)}
                          className="h-8 w-8 p-0 hover:bg-blue-50 hover:border-blue-300"
                        >
                          <Edit2 className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                       {isDeletedSection ? (
                         <div className="flex gap-2">
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => onDeleteTransaction(transaction.id)}
                             className="h-8 px-3 hover:bg-green-50 hover:border-green-300 text-green-600 border-green-200"
                           >
                             <span className="text-green-600">Restore</span>
                           </Button>
                           {onPermanentlyDeleteTransaction && (
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={() => onPermanentlyDeleteTransaction(transaction.id)}
                               className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-300 text-red-600 border-red-200"
                               title="Delete permanently"
                             >
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           )}
                         </div>
                       ) : (
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => onDeleteTransaction(transaction.id)}
                           className="h-8 px-3 hover:bg-red-50 hover:border-red-300"
                         >
                           <Trash2 className="h-4 w-4 text-red-600" />
                         </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>          )
        })}
      </TableBody>
    </Table>
  )
} 