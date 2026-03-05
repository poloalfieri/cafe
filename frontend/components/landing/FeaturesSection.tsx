import { QrCode, BarChart3, Smartphone, CreditCard, Zap, Users } from "lucide-react"

const features = [
  {
    icon: <QrCode className="w-6 h-6" />,
    title: "Menú QR inteligente",
    description:
      "Cada mesa tiene su QR único. El cliente escanea, navega el menú con fotos, filtra por categoría y hace el pedido — sin tocar nada físico.",
    color: "from-emerald-500/20 to-emerald-500/5",
    border: "border-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Pedidos en tiempo real",
    description:
      "Los pedidos llegan al panel del cajero y a la cocina en el mismo instante. Sin papel, sin gritos, sin pérdidas. El estado de cada orden se actualiza en vivo.",
    color: "from-blue-500/20 to-blue-500/5",
    border: "border-blue-500/20",
    iconColor: "text-blue-400",
  },
  {
    icon: <CreditCard className="w-6 h-6" />,
    title: "Pagos integrados",
    description:
      "Efectivo, tarjeta, transferencia o código QR. Todos los métodos en un solo lugar. El cierre de caja es automático al final del día.",
    color: "from-violet-500/20 to-violet-500/5",
    border: "border-violet-500/20",
    iconColor: "text-violet-400",
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: "Dashboard de métricas",
    description:
      "Ventas por hora, productos más pedidos, métodos de pago preferidos, horas pico. Todo en un panel visual. Más análisis con IA incluido.",
    color: "from-amber-500/20 to-amber-500/5",
    border: "border-amber-500/20",
    iconColor: "text-amber-400",
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: "Multi-sucursal",
    description:
      "¿Tenés más de un local? Gestioná todas tus sucursales desde una sola cuenta. Métricas consolidadas o por local, a tu elección.",
    color: "from-pink-500/20 to-pink-500/5",
    border: "border-pink-500/20",
    iconColor: "text-pink-400",
  },
  {
    icon: <Smartphone className="w-6 h-6" />,
    title: "Sin apps que descargar",
    description:
      "Ni el cliente ni tu equipo necesitan instalar nada. Todo funciona desde el navegador. Actualización instantánea en todos los dispositivos.",
    color: "from-cyan-500/20 to-cyan-500/5",
    border: "border-cyan-500/20",
    iconColor: "text-cyan-400",
  },
]

export default function FeaturesSection() {
  return (
    <section id="features" className="bg-[#0a0a0a] py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-5">
            <span className="text-white/50 text-xs font-medium tracking-wide uppercase">
              Todo lo que necesitás
            </span>
          </div>
          <h2 className="text-white text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
            Una plataforma completa.
            <br />
            <span className="text-white/40">Sin complicaciones.</span>
          </h2>
          <p className="text-white/50 text-base md:text-lg max-w-xl mx-auto">
            Diseñado para cafés y restaurantes que quieren modernizarse sin contratar un equipo de IT.
          </p>
        </div>

        {/* Grid de features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <div
              key={i}
              className={`relative rounded-2xl border ${feature.border} bg-gradient-to-br ${feature.color} p-6 group hover:scale-[1.02] transition-transform duration-300`}
            >
              <div className={`${feature.iconColor} mb-4`}>{feature.icon}</div>
              <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
