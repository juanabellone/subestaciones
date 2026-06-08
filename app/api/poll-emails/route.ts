import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { parseHikvisionEmail } from '@/lib/emailParser'

export const maxDuration = 30

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  )
}

async function getAccessToken(): Promise<string> {
  console.log('Getting access token...')
  const data = await Promise.race([
    fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID!,
        client_secret: process.env.GMAIL_CLIENT_SECRET!,
        refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
        grant_type: 'refresh_token',
      }),
    }).then(r => r.json()),
    timeout(8000),
  ])
  if (!data.access_token) throw new Error('No access token: ' + JSON.stringify(data))
  console.log('Access token obtained')
  return data.access_token
}

async function getUnreadMessages(accessToken: string): Promise<string[]> {
  console.log('Fetching unread messages...')
  const data = await Promise.race([
    fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=5', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(r => r.json()),
    timeout(8000),
  ])
  const messages = (data.messages || []).map((m: any) => m.id)
  console.log('Unread messages found:', messages.length)
  return messages
}

async function getMessage(accessToken: string, messageId: string) {
  return Promise.race([
    fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(r => r.json()),
    timeout(8000),
  ])
}

async function markAsRead(accessToken: string, messageId: string) {
  // Fire and forget con timeout — no bloqueamos si Gmail no responde
  await Promise.race([
    fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    }),
    timeout(5000),
  ]).catch(() => {})
}

function extractBody(message: any): string {
  const parts = message.payload?.parts || []
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8')
    }
  }
  if (message.payload?.body?.data) {
    return Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
  }
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8').replace(/<[^>]+>/g, ' ')
    }
  }
  return ''
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // TEST: return immediately to verify function works
  return NextResponse.json({ ok: true, test: true, timestamp: new Date().toISOString() })

  const supabase = createServiceClient()
  const results = { processed: 0, saved: 0, errors: 0 }
  const startTime = Date.now()
  const BUDGET_MS = 25000

  try {
    const accessToken = await getAccessToken()
    const messageIds = await getUnreadMessages(accessToken)

    for (const messageId of messageIds) {
      if (Date.now() - startTime > BUDGET_MS) {
        console.log('Budget exceeded, stopping early')
        break
      }
      results.processed++
      try {
        const message = await getMessage(accessToken, messageId)
        const body = extractBody(message)
        const event = parseHikvisionEmail(body)

        if (!event || !event.deviceName) {
          console.log('Skipping unparseable email:', messageId)
          await markAsRead(accessToken, messageId)
          continue
        }

        console.log('Processing event, deviceName:', event.deviceName)

        const { data: dvr } = await Promise.race([
          supabase.from('dvrs').select('id').eq('device_name', event.deviceName).single(),
          timeout(5000),
        ]) as any

        if (!dvr) {
          console.log('DVR not found for:', event.deviceName)
          await markAsRead(accessToken, messageId)
          continue
        }

        const { error } = await Promise.race([
          supabase.from('events').insert({
            dvr_id: dvr.id, event_type: event.eventType, channel_no: event.channelNo,
            channel_name: event.channelName, occurred_at: event.eventTime.toISOString(),
            email_message_id: messageId, raw_body: body.substring(0, 1000),
          }),
          timeout(5000),
        ]) as any

        if (error && error.code !== '23505') results.errors++
        else results.saved++

        await markAsRead(accessToken, messageId)
      } catch (err) {
        console.error('Error processing message', messageId, String(err))
        results.errors++
      }
    }
  } catch (err) {
    console.error('Fatal error:', String(err))
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  console.log('Done in', Date.now() - startTime, 'ms', results)
  return NextResponse.json({ ok: true, ...results, timestamp: new Date().toISOString() })
}
