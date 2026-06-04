/**
 * Parser de mails de alerta Hikvision
 *
 * Formato típico del cuerpo del mail:
 *
 * Device Name: DVR54
 * Device No.: 255
 * Event Type: Video Loss
 * Event Time: 06-04-2026 11:45:22
 * Channel No.: 1
 * Channel Name: D 80 C1
 */

export interface HikvisionEvent {
  deviceName: string
  eventType: string
  eventTime: Date
  channelNo: string | null
  channelName: string | null
}

export function parseHikvisionEmail(body: string): HikvisionEvent | null {
  try {
    const get = (field: string): string | null => {
      // Busca el campo en el cuerpo del mail (case-insensitive)
      const regex = new RegExp(`${field}\\s*[:\\-]\\s*(.+)`, 'i')
      const match = body.match(regex)
      return match ? match[1].trim() : null
    }

    const deviceName = get('Device Name')
    const eventType = get('Event Type') || get('Alarm Type') || get('Event')
    const eventTimeStr = get('Event Time') || get('Alarm Time') || get('Time')

    if (!deviceName || !eventType || !eventTimeStr) {
      console.warn('Email de Hikvision con campos faltantes:', { deviceName, eventType, eventTimeStr })
      return null
    }

    // Parsear fecha: formatos posibles "06-04-2026 11:45:22" o "2026-06-04 11:45:22"
    const eventTime = parseHikvisionDate(eventTimeStr)
    if (!eventTime) {
      console.warn('No se pudo parsear la fecha:', eventTimeStr)
      return null
    }

    return {
      deviceName,
      eventType,
      eventTime,
      channelNo: get('Channel No') || get('Channel No.'),
      channelName: get('Channel Name'),
    }
  } catch (err) {
    console.error('Error parseando mail:', err)
    return null
  }
}

function parseHikvisionDate(str: string): Date | null {
  // Formato DD-MM-YYYY HH:MM:SS
  const match1 = str.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (match1) {
    const [, dd, mm, yyyy, hh, min, ss] = match1
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`)
  }

  // Formato YYYY-MM-DD HH:MM:SS
  const match2 = str.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (match2) {
    const [, yyyy, mm, dd, hh, min, ss] = match2
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`)
  }

  // Intentar parseo directo
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}
