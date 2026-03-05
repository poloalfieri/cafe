"use client"

import { useEffect, useRef, useCallback } from "react"
import { QrCode, Smartphone, CreditCard, BarChart3, Bell, Zap } from "lucide-react"

// ─── Coordenadas de los sujetos en la imagen (0=izquierda/arriba, 1=derecha/abajo)
const SUBJECTS = {
  customer: { x: 0.4,  y: 0.60 },
  cashier:  { x: 0.6, y: 0.36 },
}
const SCALE_INITIAL  = 1.0
const SCALE_CUSTOMER = 2.2
const SCALE_CASHIER  = 2.8

const STAGE = {
  zoomStartCustomer: 0.15,
  zoomEndCustomer:   0.45,
  holdCustomer:      0.62,
  zoomStartCashier:  0.68,
  zoomEndCashier:    0.85,
}

// ─── Helpers
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }
function mapRange(v: number, i0: number, i1: number, o0: number, o1: number) {
  return o0 + ((v - i0) / (i1 - i0)) * (o1 - o0)
}

function getTransform(p: number) {
  const cx = SUBJECTS.customer.x, cy = SUBJECTS.customer.y
  const kx = SUBJECTS.cashier.x,  ky = SUBJECTS.cashier.y
  let scale = SCALE_INITIAL, tx = 0, ty = 0

  if (p <= STAGE.zoomStartCustomer) {
    scale = SCALE_INITIAL; tx = 0; ty = 0
  } else if (p <= STAGE.zoomEndCustomer) {
    const t = easeInOut(clamp(mapRange(p, STAGE.zoomStartCustomer, STAGE.zoomEndCustomer, 0, 1), 0, 1))
    scale = lerp(SCALE_INITIAL, SCALE_CUSTOMER, t)
    tx    = lerp(0, (0.5 - cx) * 100, t)
    ty    = lerp(0, (0.5 - cy) * 100, t)
  } else if (p <= STAGE.holdCustomer) {
    scale = SCALE_CUSTOMER; tx = (0.5 - cx) * 100; ty = (0.5 - cy) * 100
  } else if (p <= STAGE.zoomEndCashier) {
    const t = easeInOut(clamp(mapRange(p, STAGE.zoomStartCashier, STAGE.zoomEndCashier, 0, 1), 0, 1))
    scale = lerp(SCALE_CUSTOMER, SCALE_CASHIER, t)
    tx    = lerp((0.5 - cx) * 100, (0.5 - kx) * 100, t)
    ty    = lerp((0.5 - cy) * 100, (0.5 - ky) * 100, t)
  } else {
    scale = SCALE_CASHIER; tx = (0.5 - kx) * 100; ty = (0.5 - ky) * 100
  }
  return { scale, tx, ty }
}

function getTextOpacity(p: number, fi: number, hi: number, ho: number, fo: number) {
  if (p < fi || p > fo) return 0
  if (p < hi) return clamp(mapRange(p, fi, hi, 0, 1), 0, 1)
  if (p > ho) return clamp(mapRange(p, ho, fo, 1, 0), 0, 1)
  return 1
}

// ─── Component
interface ScrollStoryProps { imageSrc?: string }

export default function ScrollStory({ imageSrc = "/images/hero-cafe.png" }: ScrollStoryProps) {
  const sectionRef       = useRef<HTMLDivElement>(null)   // 100vh anchor en el flujo de página
  const panelRef         = useRef<HTMLDivElement>(null)   // cambia absolute ↔ fixed
  const imgRef           = useRef<HTMLImageElement>(null)
  const customerRef      = useRef<HTMLDivElement>(null)
  const cashierRef       = useRef<HTMLDivElement>(null)
  const heroTextRef      = useRef<HTMLDivElement>(null)
  const progressBarRef   = useRef<HTMLDivElement>(null)

  const isActiveRef      = useRef(false)
  const cooldownRef      = useRef(false)
  const exitedForwardRef = useRef(false)  // true tras completar la historia hacia adelante
  const targetPRef       = useRef(0)
  const currentPRef      = useRef(0)
  const rafRef           = useRef(0)
  const sectionTopRef    = useRef(0)   // offsetTop guardado antes del body-lock
  const prevRectTopRef   = useRef(Infinity) // para detectar entrada desde arriba

  // ─── Renderiza un frame dado un progreso p
  const applyFrame = useCallback((p: number) => {
    if (!imgRef.current) return
    const { scale, tx, ty } = getTransform(p)
    imgRef.current.style.transform =
      `scale(${scale.toFixed(4)}) translateX(${tx.toFixed(3)}%) translateY(${ty.toFixed(3)}%)`

    if (heroTextRef.current) {
      const op = clamp(mapRange(p, 0, STAGE.zoomStartCustomer, 1, 0), 0, 1)
      heroTextRef.current.style.opacity   = String(op)
      heroTextRef.current.style.transform = `translateY(${(1 - op) * -20}px)`
    }
    if (customerRef.current) {
      const op = getTextOpacity(
        p,
        STAGE.zoomEndCustomer - 0.05, STAGE.zoomEndCustomer + 0.08,
        STAGE.holdCustomer, STAGE.holdCustomer + 0.08,
      )
      customerRef.current.style.opacity   = String(op)
      customerRef.current.style.transform = `translateY(${(1 - op) * 20}px)`
    }
    if (cashierRef.current) {
      const op = getTextOpacity(p, STAGE.zoomEndCashier - 0.05, STAGE.zoomEndCashier + 0.05, 0.95, 1.05)
      cashierRef.current.style.opacity   = String(op)
      cashierRef.current.style.transform = `translateY(${(1 - op) * 20}px)`
    }
    if (progressBarRef.current) {
      progressBarRef.current.style.height = `${p * 100}%`
    }
  }, [])

  // ─── Loop RAF con lerp
  useEffect(() => {
    const tick = () => {
      const diff = targetPRef.current - currentPRef.current
      if (Math.abs(diff) > 0.0002) {
        currentPRef.current += diff * 0.08
        applyFrame(currentPRef.current)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [applyFrame])

  // ─── Activar: bloquea body, cambia panel a fixed
  // initialP = 0 → historia hacia adelante (normal)
  // initialP = 1 → historia al revés (usuario vuelve tras completarla)
  const activateStory = useCallback((initialP = 0) => {
    if (isActiveRef.current || cooldownRef.current) return
    isActiveRef.current      = true
    exitedForwardRef.current = false   // limpia flag post-historia
    sectionTopRef.current    = sectionRef.current?.offsetTop ?? 0

    if (panelRef.current) {
      panelRef.current.style.position = "fixed"
      panelRef.current.style.top      = "0"
      panelRef.current.style.left     = "0"
      panelRef.current.style.right    = "0"
      panelRef.current.style.bottom   = "0"
    }

    // Bloquear scroll (cross-browser, incl. iOS Safari)
    const scrollY = window.scrollY
    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.top      = `-${scrollY}px`
    document.body.style.width    = "100%"

    targetPRef.current  = initialP
    currentPRef.current = initialP
    applyFrame(initialP)
  }, [applyFrame])

  // ─── Desactivar: restaura body, vuelve panel a absolute
  const exitStory = useCallback((direction: "forward" | "backward") => {
    if (!isActiveRef.current) return
    isActiveRef.current = false
    cooldownRef.current = true

    // Panel vuelve a absolute (queda visible en la sección con el zoom actual)
    if (panelRef.current) {
      panelRef.current.style.position = "absolute"
      panelRef.current.style.top      = "0"
      panelRef.current.style.left     = "0"
      panelRef.current.style.right    = "0"
      panelRef.current.style.bottom   = "0"
    }

    // Desbloquear body
    document.body.style.overflow = ""
    document.body.style.position = ""
    document.body.style.top      = ""
    document.body.style.width    = ""

    if (direction === "forward") {
      // Imagen queda en zoom del cajero. El usuario puede scrollear hacia arriba
      // para reversar la historia (wheel handler lo detecta con exitedForwardRef).
      exitedForwardRef.current = true
      prevRectTopRef.current   = 0  // evita re-activación desde el scroll listener
      window.scrollTo(0, sectionTopRef.current)
    } else {
      // Salida hacia atrás: reset del zoom
      exitedForwardRef.current = false
      targetPRef.current  = 0
      currentPRef.current = 0
      applyFrame(0)
      window.scrollTo(0, Math.max(0, sectionTopRef.current - 2))
    }

    setTimeout(() => { cooldownRef.current = false }, 400)
  }, [applyFrame])

  // ─── Detecta entrada a la sección (scroll normal → activar)
  // Solo activa cuando rect.top cruza de positivo a ≤0 (entrando desde arriba).
  // Esto evita re-activar después de exitStory('forward'), cuando scrollTo
  // vuelve a sectionTop con prevRectTop ya ≤0.
  useEffect(() => {
    const onScroll = () => {
      if (isActiveRef.current || cooldownRef.current) return
      const section = sectionRef.current
      if (!section) return
      const rect = section.getBoundingClientRect()

      if (rect.top <= 0 && rect.bottom > 0 && prevRectTopRef.current > 0) {
        activateStory()
      }

      prevRectTopRef.current = rect.top
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [activateStory])

  // ─── Wheel → controla el progreso sin que scrollee la página
  useEffect(() => {
    const SENSITIVITY = 0.0005
    let pendingExit: ReturnType<typeof setTimeout> | null = null

    const onWheel = (e: WheelEvent) => {
      // Post-historia: si el usuario scrollea hacia arriba mientras la imagen
      // zoomeada está visible, re-activamos la historia al revés desde p=1.
      if (!isActiveRef.current) {
        if (exitedForwardRef.current && !cooldownRef.current && e.deltaY < 0) {
          const section = sectionRef.current
          if (section) {
            const rect = section.getBoundingClientRect()
            // La sección ocupa el viewport (usuario en el top de la página)
            if (rect.top >= -10 && rect.bottom >= window.innerHeight * 0.5) {
              e.preventDefault()
              activateStory(1)   // empieza desde el cajero, va hacia atrás
            }
          }
        }
        return
      }
      e.preventDefault()
      if (pendingExit !== null) return

      const delta = e.deltaY * SENSITIVITY
      const cur   = targetPRef.current

      if (cur <= 0.001 && delta < 0) { exitStory("backward"); return }

      if (cur >= 0.998 && delta > 0) {
        targetPRef.current  = 1
        currentPRef.current = 1
        applyFrame(1)
        pendingExit = setTimeout(() => { exitStory("forward"); pendingExit = null }, 600)
        return
      }

      targetPRef.current = clamp(cur + delta, 0, 1)
    }

    window.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      window.removeEventListener("wheel", onWheel)
      if (pendingExit) clearTimeout(pendingExit)
    }
  }, [applyFrame, exitStory])

  // ─── Touch → igual que wheel para mobile
  useEffect(() => {
    let lastY = 0
    const SENSITIVITY = 0.001

    const onTouchStart = (e: TouchEvent) => { lastY = e.touches[0].clientY }

    const onTouchMove = (e: TouchEvent) => {
      if (!isActiveRef.current) {
        if (exitedForwardRef.current && !cooldownRef.current) {
          const y     = e.touches[0].clientY
          const delta = lastY - y   // negativo = dedo sube = scroll hacia arriba
          if (delta < 0) {
            const section = sectionRef.current
            if (section) {
              const rect = section.getBoundingClientRect()
              if (rect.top >= -10 && rect.bottom >= window.innerHeight * 0.5) {
                e.preventDefault()
                lastY = y
                activateStory(1)
              }
            }
          }
        }
        return
      }
      e.preventDefault()
      const y     = e.touches[0].clientY
      const delta = (lastY - y) * SENSITIVITY
      lastY = y
      const cur = targetPRef.current
      if (cur <= 0 && delta < 0) { exitStory("backward"); return }
      if (cur >= 1 && delta > 0) { exitStory("forward");  return }
      targetPRef.current = clamp(cur + delta, 0, 1)
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove",  onTouchMove,  { passive: false })
    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove",  onTouchMove)
    }
  }, [exitStory])

  // ─── Teclado: flechas / PageDown / PageUp
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isActiveRef.current) return
      const delta =
        e.key === "ArrowDown" || e.key === "PageDown" ?  0.06 :
        e.key === "ArrowUp"   || e.key === "PageUp"   ? -0.06 : null
      if (delta === null) return
      e.preventDefault()
      const cur = targetPRef.current
      if (cur >= 1 && delta > 0) { exitStory("forward");  return }
      if (cur <= 0 && delta < 0) { exitStory("backward"); return }
      targetPRef.current = clamp(cur + delta, 0, 1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [exitStory])

  // ─── Datos de los overlays
  const customerFeatures = [
    { icon: <QrCode size={14} />,     label: "Menú digital actualizado en tiempo real" },
    { icon: <Smartphone size={14} />, label: "Pedido desde la mesa, sin app" },
    { icon: <CreditCard size={14} />, label: "Pago integrado con múltiples métodos" },
  ]
  const cashierFeatures = [
    { icon: <Bell size={14} />,      label: "Notificaciones de pedidos al instante" },
    { icon: <Zap size={14} />,       label: "Gestión de estado en un clic" },
    { icon: <BarChart3 size={14} />, label: "Métricas y reportes diarios" },
  ]

  return (
    // Sección 100vh en el flujo normal de la página.
    // Cuando el usuario scrollea hasta aquí, se activa el lock.
    <div ref={sectionRef} className="relative h-screen">

      {/* Panel: position absolute (flujo normal) → fixed (cuando activo) */}
      <div
        ref={panelRef}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {/* Imagen */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Interior del café con cliente y cajero"
            className="w-full h-full object-cover origin-center"
            style={{ willChange: "transform", transform: "scale(1) translateX(0%) translateY(0%)" }}
          />
        </div>

        {/* Gradientes */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/70 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-black/20 z-10 pointer-events-none" />

        {/* Hero text */}
        <div
          ref={heroTextRef}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-6"
          style={{ opacity: 1 }}
        >
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/90 text-xs font-medium tracking-wide uppercase">
              Software para cafés y restaurantes
            </span>
          </div>
          <h1 className="text-white text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 max-w-4xl leading-[1.1]">
            Tu café,<br />
            <span className="text-white/60">en el siglo XXI.</span>
          </h1>
          <p className="text-white/60 text-base md:text-xl max-w-xl mb-8">
            Del QR en la mesa hasta el cierre de caja.<br />
            Todo conectado, en tiempo real.
          </p>
          <div className="flex items-center gap-2 text-white/40 text-sm mt-4 animate-bounce">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
            Scrolleá para explorar
          </div>
        </div>

        {/* Overlay cliente */}
        <div
          ref={customerRef}
          className="absolute bottom-16 left-8 md:left-16 max-w-xs md:max-w-sm z-20"
          style={{ opacity: 0 }}
        >
          <div className="bg-black/55 backdrop-blur-md rounded-2xl p-5 md:p-6 border border-white/10 shadow-2xl">
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-3 py-1 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-300 text-xs font-medium">Para el cliente</span>
            </div>
            <h2 className="text-white text-xl md:text-2xl font-bold mb-2 leading-tight">
              Una experiencia sin fricciones
            </h2>
            <p className="text-white/65 text-sm md:text-base mb-4 leading-relaxed">
              El cliente escanea el QR en la mesa, ve el menú, elige y paga — todo desde su teléfono. Sin mozo, sin esperas.
            </p>
            <ul className="space-y-2">
              {customerFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-white/85 text-sm">
                  <span className="text-emerald-400 shrink-0">{f.icon}</span>
                  {f.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Overlay cajero */}
        <div
          ref={cashierRef}
          className="absolute bottom-16 right-8 md:right-16 max-w-xs md:max-w-sm z-20"
          style={{ opacity: 0 }}
        >
          <div className="bg-black/55 backdrop-blur-md rounded-2xl p-5 md:p-6 border border-white/10 shadow-2xl">
            <div className="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full px-3 py-1 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-blue-300 text-xs font-medium">Para el equipo</span>
            </div>
            <h2 className="text-white text-xl md:text-2xl font-bold mb-2 leading-tight">
              Tu equipo, siempre al día
            </h2>
            <p className="text-white/65 text-sm md:text-base mb-4 leading-relaxed">
              Cada pedido llega al sistema en segundos. El cajero procesa, la cocina prepara, el dueño monitorea.
            </p>
            <ul className="space-y-2">
              {cashierFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-white/85 text-sm">
                  <span className="text-blue-400 shrink-0">{f.icon}</span>
                  {f.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Barra de progreso lateral */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 h-24 w-0.5 bg-white/20 rounded-full overflow-hidden">
          <div
            ref={progressBarRef}
            className="w-full bg-white rounded-full"
            style={{ height: "0%", transition: "none" }}
          />
        </div>
      </div>
    </div>
  )
}
