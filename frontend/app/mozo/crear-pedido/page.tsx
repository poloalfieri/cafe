"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ArrowLeft, Plus, Minus, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import MozoPaymentModal from "@/components/mozo-payment-modal"

interface Product {
  id: string
  name: string
  description?: string
  price: number
  category: string
  image?: string
  available: boolean
}

interface CartItem extends Product {
  quantity: number
}

export default function CrearPedidoPage() {
  return null
} 