import { NextRequest, NextResponse } from 'next/server'
import { encryptSession, COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  let role: 'admin' | 'client' | null = null

  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    role = 'admin'
  } else if (email === process.env.CLIENT_EMAIL && password === process.env.CLIENT_PASSWORD) {
    role = 'client'
  }

  if (!role) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  const token = await encryptSession(role, email)
  const res = NextResponse.json({ role })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })
  return res
}
