"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/auth/supabase-browser"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error: err, data } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      
      if (data.session && data.user) {
        // Guardar la sesión manualmente en sessionStorage como respaldo
        sessionStorage.setItem('supabase_session', JSON.stringify({
          session: data.session,
          user: data.user
        }))
      }
      
      // Esperar un momento para que Supabase termine de guardar
      await new Promise(resolve => setTimeout(resolve, 500))
      const safeNext = next && next.startsWith("/") ? next : "/"
      router.replace(safeNext)
    } catch (err: any) {
      setError(err?.message ?? "Error de autenticación")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-center">Iniciar sesión</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white rounded px-3 py-2 disabled:opacity-60"
          >
            {loading ? "Procesando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  )
} 
