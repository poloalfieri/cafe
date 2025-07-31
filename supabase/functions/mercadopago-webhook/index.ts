// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "http/server"
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
    let updateData: any = {
      payment_id: paymentId,
      payment_status: paymentInfo.status,
      updated_at: new Date().toISOString()
    }

    switch (paymentInfo.status) {
      case 'approved':
        orderStatus = 'PAYMENT_APPROVED'
        updateData.payment_approved_at = new Date().toISOString()
        break
      case 'rejected':
      case 'cancelled':
        orderStatus = 'PAYMENT_REJECTED'
        updateData.payment_rejected_at = new Date().toISOString()
        break
      case 'pending':
      case 'in_process':
        orderStatus = 'PAYMENT_PENDING'
        break
    }

    updateData.status = orderStatus

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', parseInt(externalReference))

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

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/mercadopago-webhook' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
