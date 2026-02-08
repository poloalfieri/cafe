"use client"

import { Suspense } from "react"
import CajeroDashboard from "@/components/cajero-dashboard"
import { RoleGate } from "@/components/role-gate"

export default function CajeroPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <RoleGate allow={["desarrollador", "caja"]}>
        <div className="min-h-screen bg-gray-50">
          <CajeroDashboard />
        </div>
      </RoleGate>
    </Suspense>
  )
} 
