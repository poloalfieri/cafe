"use client"

import React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { MapPin, Loader2, X } from "lucide-react"

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: {
    road?: string
    house_number?: string
    suburb?: string
    city?: string
    state?: string
    country?: string
    postcode?: string
  }
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  required?: boolean
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Ej: Montevideo 764, CABA",
  className = "",
  required = false,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState(!!value)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!value && query && selected) {
      setQuery("")
      setSelected(false)
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const searchAddress = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        q,
        format: "json",
        addressdetails: "1",
        limit: "5",
        countrycodes: "ar",
      })
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: { "Accept-Language": "es" },
        }
      )
      if (res.ok) {
        const data: NominatimResult[] = await res.json()
        setResults(data)
        setIsOpen(data.length > 0)
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setSelected(false)
    onChange("")

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchAddress(val), 400)
  }

  const handleSelect = (result: NominatimResult) => {
    const addr = result.address
    const parts: string[] = []
    if (addr.road) parts.push(addr.road)
    if (addr.suburb) parts.push(addr.suburb)
    if (addr.city) parts.push(addr.city)
    if (addr.state) parts.push(addr.state)

    const formatted = parts.length > 0 ? parts.join(", ") : result.display_name
    setQuery(formatted)
    setSelected(true)
    setIsOpen(false)
    onChange(formatted)
  }

  const handleClear = () => {
    setQuery("")
    setSelected(false)
    setResults([])
    onChange("")
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          className={`h-10 w-full rounded-md border border-gray-300 bg-white pl-9 pr-9 text-sm ${
            selected ? "border-green-400 bg-green-50" : ""
          } ${className}`}
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0 && !selected) setIsOpen(true)
          }}
          required={required}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
        {selected && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map((result) => (
            <li
              key={result.place_id}
              onClick={() => handleSelect(result)}
              className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer flex items-start gap-2"
            >
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{result.display_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
