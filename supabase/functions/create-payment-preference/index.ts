// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "http/server"
import { createClient } from '@supabase/supabase-js'
import { MercadoPagoConfig, Preference } from 'mercadopago'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Create Payment Preference Function loaded!")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { mesa_id, items, total_amount } = await req.json()

    // Validaciones
    if (!mesa_id || !items || !total_amount) {
      throw new Error('mesa_id, items y total_amount son requeridos')
    }

    console.log('Datos recibidos:', { mesa_id, items, total_amount })

    // Configurar Mercado Pago
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

    if (!MP_ACCESS_TOKEN) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN no configurado')
    }

    // Inicializar Mercado Pago
    const client = new MercadoPagoConfig({ 
      accessToken: MP_ACCESS_TOKEN,
      options: { timeout: 5000 }
    })
    const preference = new Preference(client)

    // Crear cliente Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)

    // Generar token único para el pedido
    const token = crypto.randomUUID()

    // Crear el pedido con la estructura simplificada usando solo items
    const orderData = {
      mesa_id: mesa_id.toString(),
      token: token,
      status: 'PAYMENT_PENDING',
      items: items, // Solo usar items, no productos
      creation_date: new Date().toISOString()
    }

    console.log('Insertando orden con datos:', orderData)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single()

    if (orderError) {
      console.error('Error creando pedido:', orderError)
      throw new Error(`Error creando pedido: ${orderError.message}`)
    }

    console.log('Pedido creado:', order)

    // Preparar items para Mercado Pago
    const mpItems = items.map((item: any) => ({
      title: item.name,
      quantity: item.quantity,
      unit_price: parseFloat(item.price),
      currency_id: 'ARS'
    }))

    // Crear preferencia en Mercado Pago
    const preferenceData = {
      items: mpItems,
      external_reference: order.id,
      notification_url: `https://jkiqaytofyqrptkzvzei.supabase.co/functions/v1/mercadopago-webhook`,
      back_urls: {
        success: `http://localhost:3000/payment/success`, // Hardcodeado temporalmente
        failure: `http://localhost:3000/payment/failure`,
        pending: `http://localhost:3000/payment/pending`
      },
      auto_return: "approved",
      statement_descriptor: "CAFE LOCAL",
      metadata: {
        mesa_id: mesa_id.toString(),
        order_id: order.id,
        token: order.token,
        total_amount: total_amount.toString(),
        items: JSON.stringify(items)
      }
    }

    console.log('Creando preferencia MP con:', preferenceData)

    const mpResponse = await preference.create({ body: preferenceData })

    console.log('Respuesta MP:', mpResponse)

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        token: order.token,
        init_point: mpResponse.init_point,
        preference_id: mpResponse.id,
        total_amount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-payment-preference' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
