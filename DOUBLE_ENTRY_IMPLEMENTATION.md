# Double-Entry Accounting Implementation

## Overview

This implementation adds proper double-entry bookkeeping to the SlimBooks application while keeping the user interface simple and intuitive. Users continue to create transactions as before, but the system automatically creates the corresponding double-entry journal entries behind the scenes.

## Key Features

### 🔄 **Automatic Double-Entry Creation**
- When a user creates a transaction, the system automatically creates the corresponding debit and credit entries
- Users don't need to understand double-entry accounting - it's handled transparently
- All transactions are properly balanced (debits = credits)

### 📊 **GAAP-Compliant Reports**
- Financial reports are now generated from proper double-entry data
- Trial Balance automatically balances
- General Ledger shows proper debit/credit entries
- All reports follow Generally Accepted Accounting Principles (GAAP)

### 🏗️ **Robust Database Structure**
- `journal_entries` table stores transaction metadata
- `transaction_entries` table stores individual debit/credit entries
- Automatic balance validation prevents unbalanced entries
- Reference numbers for audit trail

## Database Schema

### New Tables

#### `journal_entries`
```sql
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id),
    user_id UUID REFERENCES users(id),
    date DATE NOT NULL,
    reference_number VARCHAR(50),
    description TEXT NOT NULL,
    source TEXT CHECK (source IN ('manual', 'import', 'system')),
    is_adjustment BOOLEAN DEFAULT FALSE,
    is_reversed BOOLEAN DEFAULT FALSE,
    reversed_by UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `transaction_entries`
```sql
CREATE TABLE transaction_entries (
    id UUID PRIMARY KEY,
    journal_entry_id UUID REFERENCES journal_entries(id),
    account_id UUID REFERENCES chart_of_accounts(id),
    debit_amount DECIMAL(12,2) DEFAULT 0,
    credit_amount DECIMAL(12,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_debit_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR 
        (credit_amount > 0 AND debit_amount = 0)
    )
);
```

### Key Functions

#### `create_double_entry_transaction()`
Creates a complete double-entry transaction with automatic balance validation.

#### `get_account_balance()`
Calculates account balances based on double-entry transactions.

#### `generate_journal_reference()`
Generates unique reference numbers for journal entries (format: YYYY-JE-00001).

## Implementation Details

### Transaction Creation Flow

1. **User Input**: User creates a transaction (e.g., $100 expense for Office Supplies)
2. **System Processing**: 
   - Determines corresponding account (Cash)
   - Creates journal entry with reference number
   - Creates two transaction entries:
     - Debit: Office Supplies $100
     - Credit: Cash $100
3. **Validation**: System ensures debits = credits
4. **Storage**: All entries stored in double-entry format

### Account Type Mapping

| Transaction Type | Account Type | Debit Entry | Credit Entry |
|------------------|--------------|-------------|--------------|
| Income | Revenue | Cash | Revenue Account |
| Expense | Expense | Expense Account | Cash |
| Asset | Asset | Asset Account | Cash |
| Liability | Liability | Cash | Liability Account |
| Equity | Equity | Cash | Equity Account |

### Report Generation

Reports now use the double-entry data:

- **Profit & Loss**: Calculated from revenue and expense account balances
- **Balance Sheet**: Calculated from asset, liability, and equity account balances
- **Cash Flow**: Derived from operating, investing, and financing activities
- **Trial Balance**: Shows all account balances with debits = credits
- **General Ledger**: Shows all debit/credit entries by account

## Migration Process

### For New Installations

1. Run `supabase/double_entry_accounting.sql` in Supabase SQL Editor
2. Deploy the updated application code
3. Start using the double-entry system

### For Existing Installations

1. **Backup your database**
2. Run `supabase/double_entry_accounting.sql` in Supabase SQL Editor
3. Run `supabase/migration_to_double_entry.sql` to migrate existing transactions
4. Deploy the updated application code
5. Verify migration was successful
6. Test the system thoroughly
7. Optionally remove the old `transactions` table

## Code Changes

### New Files Created

- `src/lib/double-entry.ts` - Double-entry utility functions
- `src/lib/report-generator-double-entry.ts` - Updated report generator
- `supabase/double_entry_accounting.sql` - Database schema
- `supabase/migration_to_double_entry.sql` - Migration script

### Updated Files

- `src/app/(dashboard)/transactions/page.tsx` - Uses double-entry for transaction creation
- `src/app/(dashboard)/dashboard/page.tsx` - Uses double-entry for reports and transactions
- `src/app/(dashboard)/reports/page.tsx` - Uses double-entry report generator

## Benefits

### ✅ **Data Integrity**
- Automatic balance validation prevents unbalanced entries
- Proper audit trail with reference numbers
- Transaction reversals and adjustments supported

### ✅ **Professional Accounting**
- GAAP-compliant financial statements
- Proper double-entry bookkeeping
- Accurate trial balance and general ledger

### ✅ **User Experience**
- Simple interface - users don't need accounting knowledge
- Automatic double-entry creation behind the scenes
- Same familiar transaction creation process

### ✅ **Scalability**
- Supports complex multi-account transactions
- Handles adjustments and reversals
- Ready for advanced accounting features

## Testing

### Manual Testing Checklist

- [ ] Create income transaction → Verify Cash debit, Revenue credit
- [ ] Create expense transaction → Verify Expense debit, Cash credit
- [ ] Create asset transaction → Verify Asset debit, Cash credit
- [ ] Create liability transaction → Verify Cash debit, Liability credit
- [ ] Create equity transaction → Verify Cash debit, Equity credit
- [ ] Verify Trial Balance balances (debits = credits)
- [ ] Verify reports show correct account balances
- [ ] Test transaction editing and deletion

### Automated Testing

The system includes database constraints and triggers to ensure:
- All journal entries are balanced
- Transaction entries have either debit OR credit (not both)
- Reference numbers are unique per company per year

## Troubleshooting

### Common Issues

1. **"Journal entry is not balanced" error**
   - Check that debits = credits for each transaction
   - Verify account mappings in `getCorrespondingAccount()`

2. **"Account not found" error**
   - Ensure Chart of Accounts is properly set up
   - Check that account names match exactly

3. **Migration fails**
   - Verify Chart of Accounts exists before migration
   - Check for duplicate account names
   - Ensure proper permissions

### Debug Queries

```sql
-- Check journal entry balance
SELECT 
    je.reference_number,
    SUM(te.debit_amount) as total_debits,
    SUM(te.credit_amount) as total_credits,
    ABS(SUM(te.debit_amount) - SUM(te.credit_amount)) as difference
FROM journal_entries je
JOIN transaction_entries te ON je.id = te.journal_entry_id
GROUP BY je.id, je.reference_number
HAVING ABS(SUM(te.debit_amount) - SUM(te.credit_amount)) > 0.01;

-- Check account balances
SELECT 
    coa.account_name,
    coa.account_type,
    SUM(CASE WHEN te.debit_amount > 0 THEN te.debit_amount ELSE 0 END) as debits,
    SUM(CASE WHEN te.credit_amount > 0 THEN te.credit_amount ELSE 0 END) as credits,
    CASE 
        WHEN coa.account_type IN ('asset', 'expense') 
        THEN SUM(te.debit_amount) - SUM(te.credit_amount)
        ELSE SUM(te.credit_amount) - SUM(te.debit_amount)
    END as balance
FROM chart_of_accounts coa
LEFT JOIN transaction_entries te ON coa.id = te.account_id
LEFT JOIN journal_entries je ON te.journal_entry_id = je.id
WHERE coa.is_active = true
GROUP BY coa.id, coa.account_name, coa.account_type
ORDER BY coa.account_number;
```

## Future Enhancements

### Planned Features

1. **Multi-Account Transactions**
   - Support for transactions affecting more than 2 accounts
   - Split transactions across multiple categories

2. **Advanced Adjustments**
   - Journal entry reversals
   - Period-end adjustments
   - Accruals and deferrals

3. **Audit Trail**
   - User activity logging
   - Change tracking
   - Approval workflows

4. **Advanced Reports**
   - Statement of Cash Flows (indirect method)
   - Statement of Retained Earnings
   - Comparative financial statements

### Integration Opportunities

1. **Bank Reconciliation**
   - Match bank transactions to journal entries
   - Automatic reconciliation suggestions

2. **Inventory Management**
   - Cost of goods sold calculations
   - Inventory valuation methods

3. **Fixed Assets**
   - Depreciation calculations
   - Asset disposal tracking

## Conclusion

This double-entry implementation provides a solid foundation for professional accounting while maintaining a user-friendly interface. The system automatically handles the complexity of double-entry bookkeeping, ensuring data integrity and GAAP compliance without requiring users to understand accounting principles.

The migration process is designed to be safe and reversible, allowing for thorough testing before removing the old transaction system. The new structure supports future enhancements and provides the scalability needed for growing businesses. 