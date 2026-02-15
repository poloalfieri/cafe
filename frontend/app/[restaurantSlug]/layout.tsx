import { ReactNode } from "react"
import { RestaurantProvider } from "@/contexts/restaurant-context"
import { notFound } from "next/navigation"

interface RestaurantLayoutProps {
  children: ReactNode
  params: Promise<{
    restaurantSlug: string
  }>
}

async function validateRestaurantSlug(slug: string): Promise<boolean> {
  if (!slug || slug.length < 2 || slug.length > 50) {
    return false
  }
  
  const validSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  if (!validSlugPattern.test(slug)) {
    return false
  }
  
  return true
}

export default async function RestaurantLayout({
  children,
  params,
}: RestaurantLayoutProps) {
  const { restaurantSlug } = await params
  
  const isValid = await validateRestaurantSlug(restaurantSlug)
  
  if (!isValid) {
    notFound()
  }

  return (
    <RestaurantProvider restaurantSlug={restaurantSlug}>
      {children}
    </RestaurantProvider>
  )
}
