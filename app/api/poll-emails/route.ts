import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { parseHikvisionEmail } from '@/lib/emailParser'

export const maxDuration = 30

async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function getAccessToken(): Promise<string> {
  console.log('Getting access token...')
  const res = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('No access token: ' + JSON.stringify(data))
  console.log('Access token obtained')
  return data.access_token
}

async function getUnreadMessages(accessToken: string): Promise<string[]> {
  console.log('Fetching unread messages...')
  const res = await fetchWithTimeout(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=5',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  console.log('Unread messages found:', (data.messages || []).length)
  return (data.messages || []).map((m: any) => m.id)
}

async function getMessage(accessToken: string, messageId: string) {
  const res = await fetchWithTimeout(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  return res.json()
}

async function markAsRead(accessToken: string, messageId: string) {
  await fetchWithTimeout(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    }
  )
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

  const supabase = createServiceClient()
  const results = { processed: 0, saved: 0, errors: 0 }

  try {
    const accessToken = await getAccessToken()
    const messageIds = await getUnreadMessages(accessToken)

    for (const messageId of messageIds) {
      results.processed++
      try {
        const message = await getMessage(accessToken, messageId)
        const body = extractBody(message)
        const event = parseHikvisionEmail(body)
        if (!event) { await markAsRead(accessToken, messageId); continue }

        const { data: dvr } = await supabase.from('dvrs').select('id').eq('device_name', event.deviceName).single()
        if (!dvr) { await markAsRead(accessToken, messageId); continue }

        const { error } = await supabase.from('events').insert({
          dvr_id: dvr.id, event_type: event.eventType, channel_no: event.channelNo,
          channel_name: event.channelName, occurred_at: event.eventTime.toISOString(),
          email_message_id: messageId, raw_body: body.substring(0, 1000),
        })
        if (error && error.code !== '23505') results.errors++
        else results.saved++
        await markAsRead(accessToken, messageId)
      } catch (err) {
        console.error('Error processing message', messageId, err)
        results.errors++
      }
    }
  } catch (err) {
    console.error('Fatal error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...results, timestamp: new Date().toISOString() })
}
