import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

serve(async (req) => {
  const url = new URL(req.url)
  const orderId = url.searchParams.get('external_reference')
  
  // Redirigir al frontend con el estado de éxito
  const redirectUrl = `http://localhost:3000/payment/success?order_id=${orderId}`
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectUrl
    }
  })
}) 