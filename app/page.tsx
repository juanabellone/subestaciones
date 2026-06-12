import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { decryptSession, COOKIE_NAME } from '@/lib/auth'

export default async function Home() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const session = token ? await decryptSession(token) : null

  if (!session) redirect('/login')
  if (session.role === 'admin') redirect('/admin')
  redirect('/dashboard')
}
