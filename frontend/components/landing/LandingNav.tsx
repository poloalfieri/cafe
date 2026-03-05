"use client"

import Link from "next/link"
import { useState, useEffect } from "react"

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-black/70 backdrop-blur-md border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo / nombre del producto */}
        <Link href="/landing" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 group-hover:bg-white/20 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="2" x2="6" y2="4" />
              <line x1="10" y1="2" x2="10" y2="4" />
              <line x1="14" y1="2" x2="14" y2="4" />
            </svg>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">
            CaféOS
          </span>
        </Link>

        {/* Links de navegación */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-white/70 hover:text-white text-sm transition-colors">
            Funcionalidades
          </a>
          <a href="#pricing" className="text-white/70 hover:text-white text-sm transition-colors">
            Precios
          </a>
          <a href="#contact" className="text-white/70 hover:text-white text-sm transition-colors">
            Contacto
          </a>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-white/80 hover:text-white text-sm transition-colors hidden sm:block"
          >
            Ingresar
          </Link>
          <Link
            href="/login"
            className="bg-white text-black text-sm font-medium px-4 py-2 rounded-full hover:bg-white/90 transition-colors"
          >
            Empezar gratis
          </Link>
        </div>
      </div>
    </nav>
  )
}
