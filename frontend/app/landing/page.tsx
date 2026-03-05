import type { Metadata } from "next"
import Link from "next/link"
import LandingNav from "@/components/landing/LandingNav"
import ScrollStory from "@/components/landing/ScrollStory"
import FeaturesSection from "@/components/landing/FeaturesSection"

export const metadata: Metadata = {
  title: "CaféOS — Software para cafés y restaurantes",
  description:
    "Menú digital QR, pedidos en tiempo real, pagos integrados y métricas con IA. Todo lo que tu café necesita para modernizarse.",
}

export default function LandingPage() {
  return (
    <main className="bg-black min-h-screen">
      {/* Navbar flotante */}
      <LandingNav />

      {/* Sección scroll storytelling */}
      <ScrollStory imageSrc="/images/hero-cafe.png" />

      {/* Features */}
      <FeaturesSection />

      {/* CTA final */}
      <section className="bg-[#0a0a0a] py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-white text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            ¿Listo para modernizar tu café?
          </h2>
          <p className="text-white/50 text-base md:text-lg mb-8 max-w-xl mx-auto">
            Empezá hoy mismo. Sin tarjeta de crédito, sin contratos. Configuración en menos de 10 minutos.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="bg-white text-black font-semibold px-8 py-3.5 rounded-full hover:bg-white/90 transition-colors text-base w-full sm:w-auto text-center"
            >
              Empezar gratis
            </Link>
            <a
              href="mailto:contacto@cafeos.app"
              className="text-white/60 hover:text-white border border-white/10 px-8 py-3.5 rounded-full transition-colors text-base w-full sm:w-auto text-center"
            >
              Hablar con ventas
            </a>
          </div>
        </div>
      </section>

      {/* Footer mínimo */}
      <footer className="bg-black py-8 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-white/30 text-sm">
            © {new Date().getFullYear()} CaféOS. Todos los derechos reservados.
          </span>
          <div className="flex items-center gap-6">
            <a href="#" className="text-white/30 hover:text-white/60 text-sm transition-colors">
              Términos
            </a>
            <a href="#" className="text-white/30 hover:text-white/60 text-sm transition-colors">
              Privacidad
            </a>
            <a href="mailto:contacto@cafeos.app" className="text-white/30 hover:text-white/60 text-sm transition-colors">
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
