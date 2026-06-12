'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  eventId: string
  resolvedAt: string | null
  resolvedNote: string | null
}

export default function ResolveButton({ eventId, resolvedAt, resolvedNote }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  if (resolvedAt) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-900/30 border border-green-800/50 px-2 py-0.5 rounded-full">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Resuelto
        </span>
        {resolvedNote && (
          <span className="text-xs text-gray-500 max-w-[160px] truncate" title={resolvedNote}>
            {resolvedNote}
          </span>
        )}
      </div>
    )
  }

  async function handleResolve() {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      if (!res.ok) throw new Error('Error al resolver')
      setOpen(false)
      router.refresh()
    } catch (err) {
      alert(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-green-400 border border-gray-700 hover:border-green-700 px-2 py-0.5 rounded-full transition-colors whitespace-nowrap"
      >
        Resolver
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-4">Marcar como resuelto</h3>
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-1">Nota (opcional)</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="ej: Se reemplazó el cable de la cámara 3"
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleResolve}
                disabled={loading}
                className="flex-1 text-sm bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {loading ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
