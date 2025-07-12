import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// This is a placeholder for bank API integration
// In a real implementation, you would integrate with services like:
// - Plaid (most popular)
// - Yodlee
// - TrueLayer
// - Open Banking APIs

export async function POST(request: NextRequest) {
  try {
    const { bankName, accountType } = await request.json()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 })
    }

    // In a real implementation, you would:
    // 1. Use the credentials to connect to the bank API
    // 2. Fetch account information and recent transactions
    // 3. Store the connection details securely
    // 4. Set up webhooks for real-time transaction updates

    // For now, we'll just simulate a successful connection
    const mockConnection = {
      id: `conn_${Date.now()}`,
      bank_name: bankName,
      account_type: accountType,
      status: 'connected',
      last_sync: new Date().toISOString()
    }

    // Store bank connection (you'd need to create this table)
    const { error: connectionError } = await supabase
      .from('bank_connections')
      .insert({
        company_id: userData.company_id,
        user_id: user.id,
        bank_name: bankName,
        account_type: accountType,
        connection_id: mockConnection.id,
        status: 'connected',
        last_sync: new Date().toISOString()
      })

    if (connectionError) {
      // If table doesn't exist, just return success for demo
      console.log('Bank connections table not found, returning mock success')
    }

    // Simulate fetching recent transactions
    const mockTransactions = [
      {
        id: `txn_${Date.now()}_1`,
        date: new Date().toISOString().split('T')[0],
        amount: -45.67,
        description: 'STARBUCKS COFFEE #1234',
        category: 'Meals & Entertainment'
      },
      {
        id: `txn_${Date.now()}_2`,
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        amount: -120.00,
        description: 'OFFICE DEPOT SUPPLIES',
        category: 'Office Supplies'
      },
      {
        id: `txn_${Date.now()}_3`,
        date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
        amount: 2500.00,
        description: 'CLIENT PAYMENT - INVOICE #123',
        category: 'Service Revenue'
      }
    ]

    return NextResponse.json({
      success: true,
      connection: mockConnection,
      transactions: mockTransactions,
      message: 'Bank account connected successfully (demo mode)'
    })

  } catch (error: unknown) {
    console.error('Error connecting bank account:', error)
    const errorMessage = error instanceof Error ? error.message : 'An error occurred'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 })
    }

    // Fetch bank connections
    const { data: connections } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('company_id', userData.company_id)

    return NextResponse.json({
      connections: connections || [],
      message: 'Bank connections retrieved successfully'
    })

  } catch (error: unknown) {
    console.error('Error fetching bank connections:', error)
    const errorMessage = error instanceof Error ? error.message : 'An error occurred'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}