'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface NavbarProps {
  role: 'admin' | 'client'
  userEmail: string
}

export default function Navbar({ role, userEmail }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-red-700 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867V15.133a1 1 0 01-1.447.902L15 14M3 8h12a2 2 0 012 2v4a2 2 0 01-2 2H3a2 2 0 01-2-2v-4a2 2 0 012-2z" />
          </svg>
        </div>
        <span className="font-bold text-white">BIS Seguridad</span>
        {role === 'admin' && (
          <span className="text-xs bg-red-700/30 text-red-400 border border-red-700/50 px-2 py-0.5 rounded-full">Admin</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">{userEmail}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Salir
        </button>
      </div>
    </nav>
  )
}
