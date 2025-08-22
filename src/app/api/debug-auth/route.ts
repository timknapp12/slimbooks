import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    // Get users from our database
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(5)

    // Get auth users (if possible)
    const { data: authUsers, error: authUsersError } = await supabase
      .from('auth.users')
      .select('*')
      .limit(5)

    return NextResponse.json({
      currentUser: user,
      authError: authError?.message,
      users: users,
      usersError: usersError?.message,
      authUsers: authUsers,
      authUsersError: authUsersError?.message,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Debug auth error:', error)
    return NextResponse.json(
      {
        error: 'Debug failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
