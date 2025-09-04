"use client"

import CajeroDashboard from "@/components/cajero-dashboard"
import { RoleGate } from "@/components/role-gate"

export default function CajeroPage() {
  return (
    <RoleGate allow={["desarrollador", "caja"]}>
      <div className="min-h-screen bg-gray-50">
        <CajeroDashboard />
      </div>
    </RoleGate>
  )
} 