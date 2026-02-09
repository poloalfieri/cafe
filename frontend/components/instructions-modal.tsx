"use client"

import { X, ShoppingCart, Plus, Minus, Bell, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

interface InstructionsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function InstructionsModal({ isOpen, onClose }: InstructionsModalProps) {
  const t = useTranslations("usuario.instructions")
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto border border-gray-200 max-h-[90vh] overflow-y-auto">
        {/* Header del modal */}
        <div className="sticky top-0 bg-white rounded-t-2xl flex items-center p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-900/10 rounded-full flex items-center justify-center">
              <span className="text-gray-900 font-bold text-lg">?</span>
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{t("title")}</h2>
          </div>
        </div>

        {/* Contenido del modal */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Bienvenida */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("welcome")}</h3>
            <p className="text-gray-600 text-sm">{t("intro")}</p>
          </div>

          {/* Paso 1: Seleccionar productos */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white font-bold text-sm">1</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">{t("step1Title")}</h4>
              <p className="text-gray-600 text-sm mb-2">
                {t("step1Body")}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg">
                <span>{t("step1Hint")}</span>
                <span className="bg-gray-900 text-white px-2 py-1 rounded-full">Pizzas</span>
                <span className="bg-white border border-gray-200 px-2 py-1 rounded-full">Pastas</span>
              </div>
            </div>
          </div>

          {/* Paso 2: Seleccionar cantidad */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white font-bold text-sm">2</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">{t("step2Title")}</h4>
              <p className="text-gray-600 text-sm mb-2">
                {t("step2Body")}
              </p>
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                <Button size="sm" variant="outline" className="w-6 h-6 p-0 rounded-full bg-white border-gray-300">
                  <Minus className="w-3 h-3 text-gray-600" />
                </Button>
                <span className="text-sm font-medium text-gray-900">2</span>
                <Button size="sm" className="w-6 h-6 p-0 rounded-full bg-gray-900 hover:bg-gray-800">
                  <Plus className="w-3 h-3 text-white" />
                </Button>
              </div>
            </div>
          </div>

          {/* Paso 3: Ver carrito */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white font-bold text-sm">3</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">{t("step3Title")}</h4>
              <p className="text-gray-600 text-sm mb-2">
                {t("step3Body")}
              </p>
              <div className="inline-flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm">
                <ShoppingCart className="w-4 h-4" />
                <span>{t("step3Cta")}</span>
              </div>
            </div>
          </div>

          {/* Paso 4: Pagar */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <span className="text-white font-bold text-sm">4</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">{t("step4Title")}</h4>
              <p className="text-gray-600 text-sm mb-2">
                {t("step4Body")}
              </p>
              <div className="inline-flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm">
                <CreditCard className="w-4 h-4" />
                <span>{t("step4Cta")}</span>
              </div>
            </div>
          </div>

          {/* Ayuda adicional */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-orange-600" />
              <h4 className="font-semibold text-orange-800">{t("helpTitle")}</h4>
            </div>
            <p className="text-orange-700 text-sm">
              {t("helpBody")}
            </p>
          </div>

          {/* Botón para cerrar */}
          <Button
            onClick={onClose}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 text-base font-medium touch-manipulation"
          >
          {t("close")}
        </Button>
        </div>
      </div>
    </div>
  )
}
