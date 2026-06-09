import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  // Verificar que el usuario es admin
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { dvr_id, event_type, channel_no, channel_name, occurred_at } = body

  if (!dvr_id || !event_type || !occurred_at) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient.from('events').insert({
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
