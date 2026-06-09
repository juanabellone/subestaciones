'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Dvr {
  id: string
  name: string
  substation_name: string
}

export default function AdminActions({ dvrs }: { dvrs: Dvr[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    dvr_id: '',
    event_type: '',
    channel_no: '',
    channel_name: '',
    occurred_at: new Date().toISOString().slice(0, 16),
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          occurred_at: new Date(form.occurred_at).toISOString(),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setOpen(false)
      setForm(f => ({ ...f, dvr_id: '', event_type: '', channel_no: '', channel_name: '' }))
      router.refresh()
    } catch (err) {
      alert('Error al guardar: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
      >
        + Agregar evento
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-white font-semibold mb-5">Agregar evento manual</h3>
            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="text-xs text-gray-400 block mb-1">DVR</label>
                <select
                  required
                  value={form.dvr_id}
                  onChange={e => set('dvr_id', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Seleccioná un DVR</option>
                  {dvrs.map(dvr => (
                    <option key={dvr.id} value={dvr.id}>
                      {dvr.substation_name} — {dvr.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Tipo de evento</label>
                <input
                  required
                  list="event-types"
                  value={form.event_type}
                  onChange={e => set('event_type', e.target.value)}
                  placeholder="ej: Video Loss, Motion Detection"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600"
                />
                <datalist id="event-types">
                  <option value="Video Loss" />
                  <option value="Motion Detection" />
                  <option value="Alarm Input" />
                  <option value="Disk Full" />
                  <option value="Network Disconnected" />
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Canal N°</label>
                  <input
                    value={form.channel_no}
                    onChange={e => set('channel_no', e.target.value)}
                    placeholder="ej: 1"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Nombre del canal</label>
                  <input
                    value={form.channel_name}
                    onChange={e => set('channel_name', e.target.value)}
                    placeholder="ej: Cámara 1"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Fecha y hora</label>
                <input
                  required
                  type="datetime-local"
                  value={form.occurred_at}
                  onChange={e => set('occurred_at', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
