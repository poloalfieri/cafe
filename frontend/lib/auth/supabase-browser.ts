"use client"

import { createBrowserClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  // Supabase env vars not set - error will be handled by components
}

export const supabase = createBrowserClient(supabaseUrl ?? "", supabaseAnonKey ?? "") 