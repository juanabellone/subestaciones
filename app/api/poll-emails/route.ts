import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createServiceClient } from '@/lib/supabase-server'
import { parseHikvisionEmail } from '@/lib/emailParser'

// Este endpoint es llamado por el cron de Vercel cada minuto.
// Está protegido con un secret para que nadie más lo llame.

export async function GET(req: NextRequest) {
  // Verificar secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = { processed: 0, saved: 0, errors: 0 }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    logger: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      // Buscar mails no leídos de las últimas 2 horas (por seguridad)
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000)
      const messages = client.fetch(
        { unseen: true, since },
        { source: true, uid: true, envelope: true }
      )

      for await (const msg of messages) {
        results.processed++

        try {
          // Parsear el mail completo
          const parsed = await simpleParser(msg.source)
          const messageId = parsed.messageId || `uid-${msg.uid}`
          const bodyText = parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || ''

          // Parsear el contenido del mail de Hikvision
          const event = parseHikvisionEmail(bodyText)
          if (!event) {
            // Mail que no es de Hikvision, igualarlo como leído y saltar
            await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true })
            continue
          }

          // Buscar el DVR en la base de datos por device_name
          const { data: dvr } = await supabase
            .from('dvrs')
            .select('id')
            .eq('device_name', event.deviceName)
            .single()

          if (!dvr) {
            console.warn(`DVR no encontrado en DB: "${event.deviceName}"`)
            await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true })
            continue
          }

          // Insertar evento (email_message_id evita duplicados)
          const { error } = await supabase.from('events').insert({
            dvr_id: dvr.id,
            event_type: event.eventType,
            channel_no: event.channelNo,
            channel_name: event.channelName,
            occurred_at: event.eventTime.toISOString(),
            email_message_id: messageId,
            raw_body: bodyText.substring(0, 1000),
          })

          if (error) {
            if (error.code === '23505') {
              // Duplicado, ya fue procesado
            } else {
              console.error('Error insertando evento:', error)
              results.errors++
            }
          } else {
            results.saved++
          }

          // Marcar mail como leído
          await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true })

        } catch (msgError) {
          console.error('Error procesando mensaje:', msgError)
          results.errors++
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (err) {
    console.error('Error IMAP:', err)
    return NextResponse.json({ error: 'IMAP error', details: String(err) }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    ...results,
    timestamp: new Date().toISOString(),
  })
}
