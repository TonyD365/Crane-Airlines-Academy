import { redirect } from 'next/navigation'

/**
 * Public self-service registration has been removed. Accounts are created by
 * administrators only; visitors are sent to the sign-in page.
 */
export default function RegisterPage() {
  redirect('/login')
}
