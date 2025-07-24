# SlimBooks - Accounting Made Simple

A modern, full-stack accounting application built with Next.js 14, Supabase, and Stripe.

## Features

### 🔐 Authentication & User Management

- Secure authentication with Supabase Auth
- Role-based access control (Admin/Staff)
- Company onboarding flow

### 💰 Financial Management

- **Transactions**: Manual entry and CSV import
- **Bank Integration**: Upload and parse bank statements
- **Categories**: Automatic categorization of transactions
- **Attachments**: Upload receipts and documents

### 📊 Financial Reports

- **Profit & Loss Statement**
- **Balance Sheet**
- **Cash Flow Statement**
- Support for both Cash and Accrual accounting methods

### 📋 Accounts Management

- **Payables**: Track money you owe
- **Receivables**: Track money owed to you
- Due date tracking and overdue notifications

### ⚙️ Settings & Configuration

- Company profile management
- User management
- Accounting method selection
- Subscription billing with Stripe

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, TailwindCSS, Shadcn UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Payments**: Stripe
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account (for billing)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/timknapp12/slimbooks.git
   cd slimbooks
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy `.env.local` and fill in your credentials:

   ```bash
   cp .env.local .env.local
   ```

   Required environment variables:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
   STRIPE_SECRET_KEY=your_stripe_secret_key_here
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here
   ```

4. **Set up Supabase**

   Run the SQL schema in your Supabase dashboard:

   ```bash
   # Copy the contents of supabase/schema.sql and run in Supabase SQL editor
   ```

5. **Set up Stripe**

   - Create a product and price in Stripe dashboard
   - Set up webhook endpoint: `your-domain.com/api/webhooks/stripe`
   - Add webhook events: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`

6. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

The application uses the following main tables:

- **companies**: Company information and settings
- **users**: User profiles and roles
- **transactions**: Financial transactions (income/expense/transfer)
- **payables_receivables**: Accounts payable and receivable
- **bank_statements**: Uploaded bank statement files
- **subscriptions**: Stripe subscription data

## Deployment

### Vercel Deployment

1. **Deploy to Vercel**

   ```bash
   npm run build
   vercel --prod
   ```

2. **Set environment variables in Vercel dashboard**

3. **Update Stripe webhook URL** to your production domain

### Supabase Configuration

1. **Enable Row Level Security** (already configured in schema)
2. **Set up Storage bucket** for bank statements and attachments
3. **Configure Auth settings** in Supabase dashboard

## Usage

### Getting Started

1. **Sign up** for a new account
2. **Complete onboarding** by setting up your company profile
3. **Add transactions** manually or import from CSV
4. **Generate reports** to view your financial data
5. **Track payables/receivables** for better cash flow management

### CSV Import Format

Bank statement CSV files should have the following columns:

- `Date`: Transaction date (MM/DD/YYYY or YYYY-MM-DD)
- `Amount`: Transaction amount (positive for income, negative for expenses)
- `Description`: Transaction description

### User Roles

- **Admin**: Full access to all features including bank imports
- **Staff**: Access to transactions and reports, but not bank imports

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, please open an issue on GitHub or contact [your-email@example.com].

---

# Technical Documentation

## PDF Generation Feature

The PDF generation feature allows users to export their financial reports as PDF documents using the `pdf-lib` library.

### Features

- **Profit & Loss Statement**: Complete income and expense breakdown
- **Balance Sheet**: Assets, liabilities, and equity summary
- **Cash Flow Statement**: Operating, investing, and financing activities
- **Professional Formatting**: Clean, business-ready PDF layout
- **Date Range Support**: Customizable reporting periods
- **Accounting Method**: Support for both cash and accrual basis

### Implementation

#### Client-Side Generation

The primary implementation generates PDFs on the client side:

```typescript
import { generateFinancialReportPDF, downloadPDF } from '@/lib/pdf-generator'

const handleExportPDF = async () => {
  const pdfBytes = await generateFinancialReportPDF({
    companyName: 'Your Company',
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
    accountingMethod: 'cash',
    reportData: reportData,
  })

  const filename = `financial-report-${dateFrom}-to-${dateTo}.pdf`
  await downloadPDF(pdfBytes, filename)
}
```

#### Server-Side API Endpoint

An alternative server-side implementation is available at `/api/generate-pdf`:

```typescript
const response = await fetch('/api/generate-pdf', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    companyName: 'Your Company',
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
    accountingMethod: 'cash',
    reportData: reportData,
  }),
})

if (response.ok) {
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'financial-report.pdf'
  link.click()
}
```

### PDF Structure

The generated PDF includes:

1. **Header Section**
   - Report title
   - Company name
   - Date range
   - Accounting method

2. **Profit & Loss Statement**
   - Income categories and amounts
   - Expense categories and amounts
   - Total income and expenses
   - Net income calculation

3. **Balance Sheet**
   - Assets breakdown (cash, receivables)
   - Liabilities (payables)
   - Owner's equity
   - Total calculations

4. **Cash Flow Statement**
   - Operating activities
   - Investing activities
   - Financing activities
   - Net cash flow

5. **Footer**
   - Generation timestamp
   - System branding

### Usage

1. Navigate to the Reports page
2. Set your desired date range and accounting method
3. Click "Generate Reports" to load the data
4. Click "Download PDF" to download the financial report

---

## Date Handling Best Practices

### Architecture

#### Database Layer
- **Column Type**: `DATE` (not TEXT)
- **Storage Format**: `YYYY-MM-DD` (ISO 8601 standard)
- **Benefits**:
  - Native date validation
  - Proper indexing for performance
  - Chronological sorting works correctly
  - Date arithmetic operations work
  - Database standards compliance

#### Application Layer
- **Display Format**: `MM/DD/YYYY` (US locale)
- **Storage Format**: `YYYY-MM-DD` (for database)
- **Parsing**: Handles multiple input formats

### Implementation

#### Date Utilities (`src/lib/date-utils.ts`)

```typescript
// Display formatting (MM/DD/YYYY)
export const formatDate = (dateString: string): string => {
  const parsedDate = new Date(dateString + 'T00:00:00.000Z')
  return parsedDate.toLocaleDateString('en-US')
}

// Database storage (YYYY-MM-DD)
export const formatDateForDB = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toISOString().split('T')[0]
}

// Current date for database
export const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0]
}
```

#### Usage Patterns

**Displaying Dates:**
```typescript
// In components
<TableCell>{formatDate(transaction.date)}</TableCell>
```

**Storing Dates:**
```typescript
// When saving to database
const transaction = {
  date: formatDateForDB(new Date()), // YYYY-MM-DD
  // other fields...
}
```

**Date Range Queries:**
```typescript
// Database queries use YYYY-MM-DD format
const { data } = await supabase
  .from('transactions')
  .gte('date', '2024-01-01')
  .lte('date', '2024-12-31')
```

### Benefits

- ✅ **Performance**: Date indexes work efficiently
- ✅ **Data Integrity**: Database validates dates automatically
- ✅ **Standards Compliance**: Follows ISO 8601 standard
- ✅ **Internationalization**: Easy to support different date formats
- ✅ **Maintainability**: Standard database practices

---

## Timezone Safety Implementation

### Overview
The application implements comprehensive timezone safety measures to prevent timezone-related issues and ensure consistent date handling.

### Timezone Safety Measures

#### 1. **Database Storage**
- **Format**: Always store dates as `YYYY-MM-DD` in database
- **Timezone**: Database stores dates without timezone (date-only)
- **Consistency**: All database operations use same format

#### 2. **Date Parsing**
- **Input**: Handle various date formats (MM/DD/YYYY, YYYY-MM-DD, etc.)
- **Processing**: Always parse as UTC to avoid timezone shifts
- **Output**: Consistent YYYY-MM-DD for database, MM/DD/YYYY for display

#### 3. **Date Comparisons**
- **Method**: Use UTC methods for date comparisons
- **Logic**: Explicit checks for date boundaries
- **Consistency**: All comparisons use same timezone context

#### 4. **Display Formatting**
- **Locale**: Use `en-US` locale for consistent MM/DD/YYYY display
- **Timezone**: Display in user's local timezone for user experience
- **Consistency**: All display uses same formatting function

### Implementation Details

#### Date Utility Functions

```typescript
// Timezone-safe date parsing
export const formatDate = (dateString: string): string => {
  const parsedDate = new Date(dateString + 'T00:00:00.000Z')
  return parsedDate.toLocaleDateString('en-US')
}

// Timezone-safe overdue check
export const isOverdue = (dueDate: string, status?: string): boolean => {
  const dueDateUTC = new Date(dueDate + 'T00:00:00.000Z')
  const nowUTC = new Date()
  return dueDateUTC < nowUTC
}

// UTC time for consistent timestamps
export const getCurrentTimeUTC = (): string => {
  return new Date().toLocaleTimeString('en-US', { 
    timeZone: 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
```

#### Database Queries
```typescript
// All date queries use YYYY-MM-DD format
const { data } = await supabase
  .from('transactions')
  .gte('date', '2024-01-01')  // No timezone issues
  .lte('date', '2024-12-31')
```

### Testing Scenarios

- ✅ **Cross-Timezone Testing**: Users in different timezones see correct dates
- ✅ **Date Boundary Testing**: Month/year transitions work correctly
- ✅ **CSV Import Testing**: Various date formats imported correctly
- ✅ **PDF Generation Testing**: Timestamps are consistent (UTC)

### Best Practices Followed

1. **UTC for Storage**: All database operations use UTC
2. **Local for Display**: User interface shows dates in local timezone
3. **Consistent Parsing**: All date parsing uses same UTC method
4. **Explicit Comparisons**: Date logic uses explicit UTC methods
5. **Clear Documentation**: All timezone handling is documented

---

## Database Migration

### Complete Migration

For existing databases, use the comprehensive migration file:

```sql
-- Run supabase/complete_migration.sql in your Supabase SQL Editor
```

This migration includes:
- Update transaction types to support all 5 account types
- Create missing tables (subscriptions, pricing_plans)
- Add foreign key constraints
- Add missing columns to existing tables
- Fix constraints and permissions
- Enable RLS and create policies
- Create functions and triggers
- Insert default data
- Grant necessary permissions

### Fresh Database Setup

For new databases, use the complete schema:

```sql
-- Run supabase/schema.sql in your Supabase SQL Editor
```

This creates a complete database with:
- All tables with proper structure
- Row Level Security policies
- Indexes for performance
- Triggers for automatic updates
- Default pricing plan
- Proper permissions
