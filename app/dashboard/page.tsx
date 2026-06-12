import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { decryptSession, COOKIE_NAME } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import Navbar from '@/components/Navbar'
import EventBadge from '@/components/EventBadge'

export const revalidate = 60

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const session = token ? await decryptSession(token) : null

  if (!session) redirect('/login')
  if (session.role === 'admin') redirect('/admin')

  const supabase = createServiceClient()

  const { data: substations } = await supabase
    .from('substations')
    .select(`
      id, name,
      dvrs (
        id, name, device_name,
        events (
          id, event_type, channel_name, channel_no, occurred_at
        )
      )
    `)
    .order('name')

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar role="client" userEmail={session.email} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">Panel de monitoreo</h2>
          <p className="text-gray-400 text-sm mt-1">Eventos de las últimas 24 horas</p>
        </div>

        {(!substations || substations.length === 0) ? (
          <div className="text-center py-20 text-gray-500">No hay subestaciones configuradas</div>
        ) : (
          <div className="space-y-6">
            {substations.map(sub => (
              <div key={sub.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <h3 className="font-semibold text-white">{sub.name}</h3>
                  <span className="text-xs text-gray-500">{sub.dvrs?.length || 0} DVR(s)</span>
                </div>

                <div className="divide-y divide-gray-800">
                  {sub.dvrs?.map(dvr => {
                    const recentEvents = (dvr.events || [])
                      .filter(e => new Date(e.occurred_at) > new Date(Date.now() - 24 * 60 * 60 * 1000))
                      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
                      .slice(0, 10)

                    return (
                      <div key={dvr.id} className="px-6 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867V15.133a1 1 0 01-1.447.902L15 14M3 8h12a2 2 0 012 2v4a2 2 0 01-2 2H3a2 2 0 01-2-2v-4a2 2 0 012-2z" />
                            </svg>
                            <span className="font-medium text-gray-200">{dvr.name}</span>
                            <span className="text-xs text-gray-500">({dvr.device_name})</span>
                          </div>
                          <span className="text-xs text-gray-500">{recentEvents.length} evento(s) hoy</span>
                        </div>

                        {recentEvents.length === 0 ? (
                          <p className="text-sm text-gray-600 italic">Sin eventos recientes</p>
                        ) : (
                          <div className="space-y-2">
                            {recentEvents.map(event => (
                              <div key={event.id} className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-2.5">
                                <EventBadge type={event.event_type} />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-gray-200">{event.event_type}</span>
                                  {event.channel_name && (
                                    <span className="text-xs text-gray-500 ml-2">— {event.channel_name}</span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {new Date(event.occurred_at).toLocaleString('es-AR', {
                                    day: '2-digit', month: '2-digit',
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
