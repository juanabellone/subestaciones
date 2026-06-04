export default function EventBadge({ type }: { type: string }) {
  const t = type.toLowerCase()

  if (t.includes('loss') || t.includes('pérdida') || t.includes('perdida')) {
    return <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Pérdida de video" />
  }
  if (t.includes('motion') || t.includes('movimiento')) {
    return <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" title="Detección de movimiento" />
  }
  if (t.includes('hdd') || t.includes('disk') || t.includes('disco')) {
    return <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" title="Error de disco" />
  }
  if (t.includes('tamper') || t.includes('manipul')) {
    return <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" title="Manipulación" />
  }
  return <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
}
