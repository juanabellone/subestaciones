import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { decryptSession, COOKIE_NAME } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import Navbar from '@/components/Navbar'
import EventBadge from '@/components/EventBadge'
import AdminActions from '@/components/AdminActions'

export const revalidate = 30

export default async function AdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const session = token ? await decryptSession(token) : null

  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/dashboard')

  const supabase = createServiceClient()

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: events } = await supabase
    .from('events')
    .select(`
      id, event_type, channel_name, channel_no, occurred_at,
      dvrs ( name, device_name, substations ( name ) )
    `)
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(100)

  const { data: substations } = await supabase
    .from('substations')
    .select('id, name, dvrs ( id, name, device_name )')
    .order('name')

  const dvrs = (substations ?? []).flatMap(sub =>
    (sub.dvrs ?? []).map(dvr => ({
      id: dvr.id,
      name: dvr.name,
      substation_name: sub.name,
    }))
  )

  const totalEvents = events?.length || 0
  const videoLossCount = events?.filter(e => e.event_type.toLowerCase().includes('loss')).length || 0

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar role="admin" userEmail={session.email} />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <p className="text-sm text-gray-400">Subestaciones</p>
            <p className="text-3xl font-bold text-white mt-1">{substations?.length || 0}</p>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <p className="text-sm text-gray-400">Eventos (48h)</p>
            <p className="text-3xl font-bold text-white mt-1">{totalEvents}</p>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <p className="text-sm text-gray-400">Pérdidas de video (48h)</p>
            <p className="text-3xl font-bold text-red-400 mt-1">{videoLossCount}</p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="font-semibold text-white">Subestaciones y DVRs</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {substations?.map(sub => (
              <div key={sub.id} className="px-6 py-4">
                <p className="font-medium text-white mb-2">{sub.name}</p>
                <div className="flex flex-wrap gap-2">
                  {sub.dvrs?.map(dvr => (
                    <span key={dvr.id} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1 rounded-full">
                      {dvr.name} <span className="text-gray-500">({dvr.device_name})</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-white">Eventos recientes (últimas 48h)</h3>
            <AdminActions dvrs={dvrs} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-6 py-3 text-left">Fecha/Hora</th>
                  <th className="px-6 py-3 text-left">Subestación</th>
                  <th className="px-6 py-3 text-left">DVR</th>
                  <th className="px-6 py-3 text-left">Evento</th>
                  <th className="px-6 py-3 text-left">Canal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {events?.map(event => (
                  <tr key={event.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-3 text-gray-400 whitespace-nowrap">
                      {new Date(event.occurred_at).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-3 text-gray-300">
                      {(event.dvrs as any)?.substations?.name || '—'}
                    </td>
                    <td className="px-6 py-3 text-gray-300">
                      {(event.dvrs as any)?.name || '—'}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <EventBadge type={event.event_type} />
                        <span className="text-gray-200">{event.event_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-400">
                      {event.channel_name || event.channel_no || '—'}
                    </td>
                  </tr>
                ))}
                {(!events || events.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-600">
                      Sin eventos en las últimas 48 horas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  )
}
