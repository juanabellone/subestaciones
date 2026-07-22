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
  const { device_name, event_type, channel_no, channel_name, occurred_at } = body

  if (!device_name || !event_type || !occurred_at) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: dvr, error: dvrError } = await supabase
    .from('dvrs')
    .select('id')
    .eq('device_name', device_name.trim())
    .single()

  if (dvrError || !dvr) {
    return NextResponse.json(
      { error: `No se encontró un DVR con device_name "${device_name}". Revisá que coincida exactamente (mayúsculas incluidas) con el configurado en Supabase.` },
      { status: 400 }
    )
  }

  const { error } = await supabase.from('events').insert({
    dvr_id: dvr.id,
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
