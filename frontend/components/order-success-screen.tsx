"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface Props {
  isDelivery: boolean
  title: string
  body: string
  slug: string
  onClose: () => void
}

export default function OrderSuccessScreen({ title, body, slug, onClose }: Props) {
  const router = useRouter()
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const redirect = setTimeout(() => {
      onClose()
      router.push(`/${slug}/usuario`)
    }, 3000)
    const tick = setInterval(() => setCountdown((p) => Math.max(0, p - 1)), 1000)
    return () => {
      clearTimeout(redirect)
      clearInterval(tick)
    }
  }, [slug, onClose, router])

  return (
    <div className="fixed inset-0 z-[70] bg-gradient-to-b from-emerald-500 to-emerald-600 flex flex-col items-center justify-center px-6 animate-in fade-in duration-500">
      <style>{`
        @keyframes drawCircle { to { stroke-dashoffset: 0; } }
        @keyframes drawCheck  { to { stroke-dashoffset: 0; } }
        @keyframes drainBar   { from { width: 100%; } to { width: 0%; } }
        @keyframes slideUp    { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .draw-circle {
          stroke-dasharray: 226.2;
          stroke-dashoffset: 226.2;
          animation: drawCircle 400ms ease-out 300ms forwards;
        }
        .draw-check {
          stroke-dasharray: 56;
          stroke-dashoffset: 56;
          animation: drawCheck 300ms ease-out 700ms forwards;
        }
        .drain-bar { animation: drainBar 3000ms linear forwards; }
        .slide-up  { opacity: 0; animation: slideUp 500ms ease-out forwards; }
      `}</style>

      {/* SVG animado: círculo + checkmark */}
      <svg
        width="120"
        height="120"
        viewBox="0 0 80 80"
        fill="none"
        aria-hidden="true"
        className="mb-8"
      >
        {/* Círculo de fondo (estático) */}
        <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
        {/* Círculo animado */}
        <circle
          cx="40"
          cy="40"
          r="36"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          className="draw-circle"
          style={{ transform: "rotate(-90deg)", transformOrigin: "40px 40px" }}
        />
        {/* Checkmark animado */}
        <path
          d="M 16 40 L 32 56 L 58 28"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="draw-check"
        />
      </svg>

      {/* Título */}
      <h1
        className="slide-up text-white text-2xl font-bold text-center mb-3"
        style={{ animationDelay: "700ms", opacity: 0 }}
      >
        {title}
      </h1>

      {/* Cuerpo */}
      <p
        className="slide-up text-white/85 text-base text-center max-w-xs leading-relaxed mb-8"
        style={{ animationDelay: "900ms", opacity: 0 }}
      >
        {body}
      </p>

      {/* Botón */}
      <div
        className="slide-up w-full max-w-xs"
        style={{ animationDelay: "1100ms", opacity: 0 }}
      >
        <Button
          onClick={() => {
            onClose()
            router.push(`/${slug}/usuario`)
          }}
          className="w-full bg-white text-emerald-700 hover:bg-white/90 font-semibold rounded-full text-base shadow-md"
          size="lg"
        >
          Ver Menú{" "}
          <span className="ml-2 text-emerald-400 text-sm font-normal">({countdown})</span>
        </Button>
      </div>

      {/* Barra de progreso que se drena en 3s */}
      <div className="fixed bottom-0 left-0 right-0 h-1.5 bg-white/20">
        <div className="h-full bg-white/70 drain-bar" />
      </div>
    </div>
  )
}
