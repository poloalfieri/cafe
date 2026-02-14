"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { X, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CategoryFiltersModalProps {
  isOpen: boolean
  categories: string[]
  selectedCategory: string
  onSelectCategory: (category: string) => void
  onClose: () => void
}

export default function CategoryFiltersModal({
  isOpen,
  categories,
  selectedCategory,
  onSelectCategory,
  onClose
}: CategoryFiltersModalProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      setTimeout(() => setIsAnimating(true), 10)
      document.body.style.overflow = 'hidden'
    } else {
      setIsAnimating(false)
      const timer = setTimeout(() => {
        setShouldRender(false)
        document.body.style.overflow = 'unset'
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleSelectCategory = (category: string) => {
    onSelectCategory(category)
    handleClose()
  }

  const handleClose = () => {
    setIsAnimating(false)
    setTimeout(() => onClose(), 300)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  if (!mounted || !shouldRender) return null

  const modalContent = (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] transition-opacity duration-300 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleBackdropClick}
      />
      
      {/* Bottom Sheet - 100% width, sin overflow */}
      <div 
        className={`fixed inset-x-0 bottom-0 z-[100] bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-hidden w-full max-w-full transition-transform duration-300 ease-out ${
          isAnimating ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-gray-900/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Filter className="w-5 h-5 text-gray-900" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 truncate">Filtrar por categoría</h2>
          </div>
          <Button
            onClick={handleClose}
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0 rounded-full hover:bg-gray-100 flex-shrink-0 ml-2"
          >
            <X className="w-5 h-5 text-gray-900" />
          </Button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {/* Grid de categorías - responsive */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
            {categories.map((category: string) => (
              <Button
                key={category}
                onClick={() => handleSelectCategory(category)}
                variant={selectedCategory === category ? "default" : "outline"}
                className={`rounded-xl px-4 py-6 text-sm font-medium h-auto whitespace-normal text-center break-words ${
                  selectedCategory === category
                    ? "bg-gray-900 text-white hover:bg-gray-800"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {category}
              </Button>
            ))}
          </div>

          {/* Botón de limpiar filtros */}
          {selectedCategory !== "Todos" && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Button
                onClick={() => handleSelectCategory("Todos")}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 font-semibold"
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )

  return createPortal(modalContent, document.body)
}
