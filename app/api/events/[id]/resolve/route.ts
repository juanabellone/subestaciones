import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { decryptSession, COOKIE_NAME } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const session = token ? await decryptSession(token) : null

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { note } = await req.json()
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('events')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_note: note || null,
    })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
