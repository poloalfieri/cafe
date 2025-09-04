"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Plus, Users, Clock, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface Mesa {
  id: string
  mesa_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Order {
  id: string
  mesa_id: string
  status: string
  total_amount: number
  created_at: string
  items: any[]
}

export default function MozoDashboard() {
  return null
} 