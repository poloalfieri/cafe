"use client"

import { Suspense } from "react"
import AdminDashboard from "@/components/admin-dashboard"
import { RoleGate } from "@/components/role-gate"
import { useTranslations } from "next-intl"

export default function AdminPage() {
  const t = useTranslations("admin.page")
  return (
    <Suspense fallback={<div className="p-6">{t("loading")}</div>}>
      <RoleGate allow={["desarrollador", "admin"]}>
        <AdminDashboard />
      </RoleGate>
    </Suspense>
  )
} 
