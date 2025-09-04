"use client"

import AdminDashboard from "@/components/admin-dashboard"
import { RoleGate } from "@/components/role-gate"

export default function AdminPage() {
  return (
    <RoleGate allow={["desarrollador", "admin"]}>
      <AdminDashboard />
    </RoleGate>
  )
} 