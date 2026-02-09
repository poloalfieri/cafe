"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getClientAuthHeaderAsync } from "@/lib/fetcher"
import { 
  Clock,
  MapPin,
  Save,
  X
} from "lucide-react"
import { useTranslations } from "next-intl"

interface Schedule {
  day: string
  open: boolean
  openTime: string
  closeTime: string
}

interface Mesa {
  id: string
  mesa_id: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

interface ScheduleManagementProps {
  branchId?: string
}

export default function ScheduleManagement({ branchId }: ScheduleManagementProps) {
  const t = useTranslations("admin.schedule")
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001"

  const daysOfWeek = [
    t("days.monday"),
    t("days.tuesday"),
    t("days.wednesday"),
    t("days.thursday"),
    t("days.friday"),
    t("days.saturday"),
    t("days.sunday")
  ]

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Simular datos de horarios - en producción esto vendría de tu API
      const mockSchedules: Schedule[] = daysOfWeek.map(day => ({
        day,
        open: day !== t("days.sunday"),
        openTime: "08:00",
        closeTime: day === t("days.saturday") ? "23:00" : "22:00"
      }))
      setSchedules(mockSchedules)

      const authHeader = await getClientAuthHeaderAsync()
      const query = branchId ? `?branch_id=${branchId}` : ""
      const mesasResponse = await fetch(`${backendUrl}/mesa/list${query}`, {
        headers: {
          ...authHeader,
        },
      })
      if (mesasResponse.ok) {
        const mesasData = await mesasResponse.json()
        setMesas(mesasData.mesas || [])
      } else {
        setMesas([])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      setMesas([])
    }
  }

  const handleScheduleChange = (day: string, field: keyof Schedule, value: any) => {
    setSchedules(schedules.map(schedule => 
      schedule.day === day ? { ...schedule, [field]: value } : schedule
    ))
  }

  const getStatusInfo = (isActive: boolean) => {
    return isActive
      ? { label: t("tables.active"), color: "bg-green-100 text-green-700 border-green-200" }
      : { label: t("tables.inactive"), color: "bg-gray-100 text-gray-700 border-gray-200" }
  }

  const saveSchedules = async () => {
    // Aquí iría la lógica para guardar los horarios en la API
    console.log(t("logs.saveSchedules"), schedules)
    alert(t("alerts.saved"))
  }

  return (
    <div className="space-y-8">
      {/* Gestión de Horarios */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t("opening.title")}</h2>
            <p className="text-gray-600">{t("opening.subtitle")}</p>
          </div>
          <Button onClick={saveSchedules} className="bg-gray-900 hover:bg-gray-800 text-white">
            <Save className="w-4 h-4 mr-2" />
            {t("actions.saveSchedules")}
          </Button>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <div key={schedule.day} className="flex items-center gap-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-24">
                  <Label className="font-bold text-gray-900 text-sm">{schedule.day}</Label>
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`open-${schedule.day}`}
                    checked={schedule.open}
                    onChange={(e) => handleScheduleChange(schedule.day, "open", e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-gray-300 focus:ring-gray-900 focus:ring-2"
                  />
                  <Label htmlFor={`open-${schedule.day}`} className="text-sm font-medium text-gray-700">
                    {t("opening.open")}
                  </Label>
                </div>

                {schedule.open && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Clock className="w-4 h-4 text-blue-600" />
                      </div>
                      <Input
                        type="time"
                        value={schedule.openTime}
                        onChange={(e) => handleScheduleChange(schedule.day, "openTime", e.target.value)}
                        className="w-32 border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                      />
                    </div>
                    
                    <span className="text-gray-600 font-medium">{t("opening.to")}</span>
                    
                    <div className="flex items-center gap-3">
                      <Input
                        type="time"
                        value={schedule.closeTime}
                        onChange={(e) => handleScheduleChange(schedule.day, "closeTime", e.target.value)}
                        className="w-32 border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                      />
                    </div>
                  </>
                )}

                {!schedule.open && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <X className="w-4 h-4 text-red-600" />
                    </div>
                    <span className="text-red-600 font-medium text-sm">{t("opening.closed")}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gestión de Mesas */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t("tables.title")}</h2>
            <p className="text-gray-600">{t("tables.subtitle")}</p>
          </div>
          <Button onClick={fetchData} className="bg-gray-900 hover:bg-gray-800 text-white">
            {t("actions.refresh")}
          </Button>
        </div>

        {/* Vista de mesas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mesas.map((mesa) => {
            const statusInfo = getStatusInfo(mesa.is_active)
            
            return (
              <div
                key={mesa.id}
                className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Mesa {mesa.mesa_id}</h3>
                    <p className="text-gray-600 text-sm">{t("tables.idLabel", { id: mesa.id })}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="text-sm text-gray-600">
                  {t("tables.lastUpdate", {
                    value: mesa.updated_at ? new Date(mesa.updated_at).toLocaleString() : "—"
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {mesas.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("tables.emptyTitle")}</h3>
            <p className="text-gray-600">{t("tables.emptySubtitle")}</p>
          </div>
        )}
      </div>
    </div>
  )
} 
