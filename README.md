# SimpleBooks - Accounting Made Simple

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
