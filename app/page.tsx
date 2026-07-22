import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { decryptSession, COOKIE_NAME } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import Navbar from '@/components/Navbar'
import EventBadge from '@/components/EventBadge'
import AdminActions from '@/components/AdminActions'
import ResolveButton from '@/components/ResolveButton'

export const revalidate = 0

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const session = token ? await decryptSession(token) : null

  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/dashboard')

  const tab = searchParams.tab === 'resueltos' ? 'resueltos' : 'pendientes'
  const supabase = createServiceClient()

  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Query según tab activo
  const eventsQuery = supabase
    .from('events')
    .select(`
      id, event_type, channel_name, channel_no, occurred_at, resolved_at, resolved_note,
      dvrs ( name, device_name, substations ( name ) )
    `)
    .order(tab === 'resueltos' ? 'resolved_at' : 'occurred_at', { ascending: false })
    .limit(100)

  if (tab === 'pendientes') {
    eventsQuery.gte('occurred_at', since48h).is('resolved_at', null)
  } else {
    eventsQuery.gte('resolved_at', since7d).not('resolved_at', 'is', null)
  }

  const { data: events, error: eventsError } = await eventsQuery
  if (eventsError) console.error('[admin] error cargando events:', eventsError.message)

  const { data: substations, error: substationsError } = await supabase
    .from('substations')
    .select('id, name, dvrs ( id, name, device_name )')
    .order('name')
  if (substationsError) console.error('[admin] error cargando substations:', substationsError.message)

  const dvrs = (substations ?? []).flatMap(sub =>
    (sub.dvrs ?? []).map(dvr => ({
      id: dvr.id,
      name: dvr.name,
      device_name: dvr.device_name,
      substation_name: sub.name,
    }))
  )

  // Stats siempre sobre pendientes
  const { data: statsEvents } = await supabase
    .from('events')
    .select('event_type')
    .gte('occurred_at', since48h)
    .is('resolved_at', null)

  const totalPending = statsEvents?.length || 0
  const videoLossCount = statsEvents?.filter(e => e.event_type.toLowerCase().includes('loss')).length || 0

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar role="admin" userEmail={session.email} />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <p className="text-sm text-gray-400">Subestaciones</p>
            <p className="text-3xl font-bold text-white mt-1">{substations?.length || 0}</p>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <p className="text-sm text-gray-400">Pendientes (48h)</p>
            <p className="text-3xl font-bold text-white mt-1">{totalPending}</p>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <p className="text-sm text-gray-400">Pérdidas de video (48h)</p>
            <p className="text-3xl font-bold text-red-400 mt-1">{videoLossCount}</p>
          </div>
        </div>

        {/* Subestaciones y DVRs */}
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

        {/* Eventos con tabs */}
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          {/* Header con tabs */}
          <div className="px-6 pt-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex gap-1">
              <a
                href="/admin"
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  tab === 'pendientes'
                    ? 'text-white border-b-2 border-red-600'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Pendientes
              </a>
              <a
                href="/admin?tab=resueltos"
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  tab === 'resueltos'
                    ? 'text-white border-b-2 border-green-600'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Resueltos
              </a>
            </div>
            {tab === 'pendientes' && <AdminActions dvrs={dvrs} />}
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
                  {tab === 'pendientes' && <th className="px-6 py-3 text-left">Acción</th>}
                  {tab === 'resueltos' && <th className="px-6 py-3 text-left">Resuelto</th>}
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
                    {tab === 'pendientes' && (
                      <td className="px-6 py-3">
                        <ResolveButton
                          eventId={event.id}
                          resolvedAt={event.resolved_at ?? null}
                          resolvedNote={event.resolved_note ?? null}
                        />
                      </td>
                    )}
                    {tab === 'resueltos' && (
                      <td className="px-6 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-green-400">
                            {new Date(event.resolved_at!).toLocaleString('es-AR', {
                              day: '2-digit', month: '2-digit',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          {event.resolved_note && (
                            <span className="text-xs text-gray-400 max-w-[200px]">{event.resolved_note}</span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {(!events || events.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-600">
                      {tab === 'pendientes' ? 'Sin eventos pendientes en las últimas 48 horas' : 'Sin eventos resueltos en los últimos 7 días'}
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
