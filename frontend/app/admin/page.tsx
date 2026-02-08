"use client"

import { Suspense } from "react"
import AdminDashboard from "@/components/admin-dashboard"
import { RoleGate } from "@/components/role-gate"

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <RoleGate allow={["desarrollador", "admin"]}>
        <AdminDashboard />
      </RoleGate>
    </Suspense>
  )
} 
