"use client"

import { Suspense } from "react"
import SuperAdminDashboard from "@/components/super-admin-dashboard"
import { RoleGate } from "@/components/role-gate"

export default function SuperAdminPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <RoleGate allow={["desarrollador"]}>
        <div className="min-h-screen bg-gray-50">
          <SuperAdminDashboard />
        </div>
      </RoleGate>
    </Suspense>
  )
} 
