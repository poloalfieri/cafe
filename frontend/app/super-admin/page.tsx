"use client"

import SuperAdminDashboard from "@/components/super-admin-dashboard"
import { RoleGate } from "@/components/role-gate"

export default function SuperAdminPage() {
  return (
    <RoleGate allow={["desarrollador"]}>
      <div className="min-h-screen bg-gray-50">
        <SuperAdminDashboard />
      </div>
    </RoleGate>
  )
} 