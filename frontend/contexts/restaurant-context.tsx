"use client"

import { createContext, useContext, ReactNode } from "react"

interface RestaurantContextType {
  restaurantSlug: string
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined)

export function RestaurantProvider({
  children,
  restaurantSlug,
}: {
  children: ReactNode
  restaurantSlug: string
}) {
  return (
    <RestaurantContext.Provider value={{ restaurantSlug }}>
      {children}
    </RestaurantContext.Provider>
  )
}

export function useRestaurant() {
  const context = useContext(RestaurantContext)
  if (context === undefined) {
    throw new Error("useRestaurant must be used within a RestaurantProvider")
  }
  return context
}
