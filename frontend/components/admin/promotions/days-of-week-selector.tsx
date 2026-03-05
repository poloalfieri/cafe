"use client"

import { useTranslations } from "next-intl"

interface DaysOfWeekSelectorProps {
  selectedDays: number[]
  onChange: (days: number[]) => void
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

export default function DaysOfWeekSelector({ selectedDays, onChange }: DaysOfWeekSelectorProps) {
  const t = useTranslations("admin.promotions.daysOfWeek")

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter(d => d !== day))
    } else {
      onChange([...selectedDays, day].sort())
    }
  }

  const allSelected = selectedDays.length === 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{t("title")}</span>
        {!allSelected && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {t("allDays")}
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        {DAY_KEYS.map((key, index) => {
          const isSelected = selectedDays.includes(index)
          const isActive = allSelected || isSelected
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleDay(index)}
              className={`w-10 h-10 rounded-lg text-xs font-semibold transition-all duration-150 border-2 ${
                isActive
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600"
              }`}
            >
              {t(key)}
            </button>
          )
        })}
      </div>
      {allSelected && (
        <p className="text-xs text-gray-500">{t("allDays")}</p>
      )}
    </div>
  )
}
