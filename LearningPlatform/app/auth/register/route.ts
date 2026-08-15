import { NextResponse } from 'next/server'

/**
 * Public self-service registration is disabled.
 *
 * Accounts are created by administrators only, from the admin Users panel
 * (POST /api/admin/users). New users sign in with their RBX username.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Registration is disabled. Please contact an administrator for an account.' },
    { status: 403 },
  )
}
