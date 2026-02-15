"use client"

import { Suspense } from "react"
import CajeroDashboard from "@/components/cajero-dashboard"
import { RoleGate } from "@/components/role-gate"
import { useTranslations } from "next-intl"

export default function CajeroPage() {
  const t = useTranslations("cajero.page")
  return (
    <Suspense fallback={<div className="p-6">{t("loading")}</div>}>
      <RoleGate allow={["desarrollador", "caja"]}>
        <div className="min-h-screen bg-gray-50">
          <CajeroDashboard />
        </div>
      </RoleGate>
    </Suspense>
  )
} 
