import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { decryptSession, COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const session = token ? await decryptSession(token) : null

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { dvr_id, event_type, channel_no, channel_name, occurred_at } = body

  if (!dvr_id || !event_type || !occurred_at) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('events').insert({
    dvr_id,
    event_type,
    channel_no: channel_no || null,
    channel_name: channel_name || null,
    occurred_at,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
