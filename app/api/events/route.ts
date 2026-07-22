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
  const cleanDeviceName = device_name.trim()

  let dvrId: string

  const { data: existingDvr } = await supabase
    .from('dvrs')
    .select('id')
    .eq('device_name', cleanDeviceName)
    .single()

  if (existingDvr) {
    dvrId = existingDvr.id
  } else {
    // El DVR no existe todavía: lo creamos sobre la marcha, dentro de una
    // subestación genérica "Sin asignar" para no perder el evento.
    let substationId: string

    const { data: existingSubstation } = await supabase
      .from('substations')
      .select('id')
      .eq('name', 'Sin asignar')
      .single()

    if (existingSubstation) {
      substationId = existingSubstation.id
    } else {
      const { data: newSubstation, error: substationError } = await supabase
        .from('substations')
        .insert({ name: 'Sin asignar' })
        .select('id')
        .single()

      if (substationError || !newSubstation) {
        return NextResponse.json(
          { error: `No se pudo crear la subestación "Sin asignar": ${substationError?.message ?? 'error desconocido'}` },
          { status: 500 }
        )
      }
      substationId = newSubstation.id
    }

    const { data: newDvr, error: newDvrError } = await supabase
      .from('dvrs')
      .insert({ name: cleanDeviceName, device_name: cleanDeviceName, substation_id: substationId })
      .select('id')
      .single()

    if (newDvrError || !newDvr) {
      return NextResponse.json(
        { error: `No se pudo crear el DVR "${cleanDeviceName}": ${newDvrError?.message ?? 'error desconocido'}` },
        { status: 500 }
      )
    }
    dvrId = newDvr.id
  }

  const { error } = await supabase.from('events').insert({
    dvr_id: dvrId,
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
