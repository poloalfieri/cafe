"use client"

import { getTenantApiBase } from "@/lib/apiClient"
import { useState, useEffect } from "react"
import { Clock, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "next-intl"

interface ScheduleConfig {
  id: string
  branch_id: string
  expected_open_time: string | null
  expected_close_time: string | null
  auto_close_grace_minutes: number
}

interface CashScheduleConfigProps {
  branchId?: string
}

export default function CashScheduleConfig({ branchId }: CashScheduleConfigProps) {
  const t = useTranslations("admin.cashSchedule")
  const { toast } = useToast()
  const backendUrl = getTenantApiBase()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openTime, setOpenTime] = useState("")
  const [closeTime, setCloseTime] = useState("")
  const [graceMinutes, setGraceMinutes] = useState("120")

  useEffect(() => {
    if (!branchId) return
    fetchConfig()
  }, [branchId])

  const fetchConfig = async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const res = await fetch(`${backendUrl}/cash/schedule-config?branch_id=${branchId}`, {
        headers: { ...authHeader },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const config: ScheduleConfig | null = data.data
      if (config) {
        setOpenTime(config.expected_open_time || "")
        setCloseTime(config.expected_close_time || "")
        setGraceMinutes(String(config.auto_close_grace_minutes || 120))
      } else {
        setOpenTime("")
        setCloseTime("")
        setGraceMinutes("120")
      }
    } catch {
      // No config yet — that's ok
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!branchId) return
    setSaving(true)
    try {
      const authHeader = await getClientAuthHeaderAsync()
      const res = await fetch(`${backendUrl}/cash/schedule-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          branch_id: branchId,
          expected_open_time: openTime || null,
          expected_close_time: closeTime || null,
          auto_close_grace_minutes: Number(graceMinutes),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t("toast.saveError"))
      }
      toast({ title: t("toast.saveSuccess") })
    } catch (error: any) {
      toast({ title: t("toast.errorTitle"), description: error?.message || t("toast.saveError"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (!branchId) {
    return <p className="text-sm text-amber-600 mt-8 pt-6 border-t border-gray-200">{t("noBranchSelected")}</p>
  }

  return (
    <div className="space-y-4 mt-8 pt-6 border-t border-gray-200">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t("header.title")}
        </h2>
        <p className="text-sm text-gray-600">{t("header.subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="open-time">{t("form.openTime")}</Label>
              <Input
                id="open-time"
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="close-time">{t("form.closeTime")}</Label>
              <Input
                id="close-time"
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="grace-minutes">{t("form.graceMinutes")}</Label>
              <Select value={graceMinutes} onValueChange={setGraceMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60 min (1h)</SelectItem>
                  <SelectItem value="120">120 min (2h)</SelectItem>
                  <SelectItem value="180">180 min (3h)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? t("actions.saving") : t("actions.save")}
          </Button>
        </div>
      )}
    </div>
  )
}
