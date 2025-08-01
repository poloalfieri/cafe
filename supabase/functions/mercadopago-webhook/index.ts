// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from '@supabase/supabase-js'
import { MercadoPagoConfig, Payment } from 'mercadopago'

console.log("Mercado Pago Webhook Function loaded!")

serve(async (req) => {
  try {
    const { type, data } = await req.json()
    
    console.log('Webhook recibido:', { type, data })

    if (type !== 'payment') {
      return new Response('OK', { status: 200 })
    }

    const paymentId = data?.id
    if (!paymentId) {
      throw new Error('Payment ID no encontrado')
    }

    // Configuración
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Inicializar Mercado Pago
    const client = new MercadoPagoConfig({ 
      accessToken: MP_ACCESS_TOKEN!,
      options: { timeout: 5000 }
    })
    const payment = new Payment(client)

    // Obtener información del pago
    const paymentInfo = await payment.get({ id: paymentId })
    const externalReference = paymentInfo.external_reference
    
    if (!externalReference) {
      throw new Error('External reference no encontrado')
    }

    // Crear cliente Supabase con service key
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)

    // Actualizar el pedido según el estado del pago
    let orderStatus = 'PAYMENT_PENDING'

    switch (paymentInfo.status) {
      case 'approved':
        orderStatus = 'PAYMENT_APPROVED'
        break
      case 'rejected':
      case 'cancelled':
        orderStatus = 'PAYMENT_REJECTED'
        break
      case 'pending':
      case 'in_process':
        orderStatus = 'PAYMENT_PENDING'
        break
      default:
        orderStatus = 'PAYMENT_PENDING'
        break
    }

    // Como id es UUID, no necesitamos parseInt
    const { error } = await supabase
      .from('orders')
      .update({ status: orderStatus })
      .eq('id', externalReference)

    if (error) {
      throw new Error(`Error actualizando pedido: ${error.message}`)
    }

    console.log(`Pedido ${externalReference} actualizado con estado: ${orderStatus}`)

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Error en webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
}) 