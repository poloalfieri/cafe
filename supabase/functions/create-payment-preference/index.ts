// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
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
    const { mesa_id, items, total_amount, token } = await req.json()

    // Validaciones
    if (!mesa_id || !items || !total_amount || !token) {
      throw new Error('mesa_id, items, total_amount y token son requeridos')
    }

    console.log('Datos recibidos:', { mesa_id, items, total_amount })

    // Configurar Mercado Pago
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

    if (!MP_ACCESS_TOKEN) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN no configurado')
    }

    // Crear cliente Supabase primero
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)

    // Validar token de mesa (temporalmente deshabilitado para testing)
    // const { data: tokenValid, error: tokenError } = await supabase
    //   .rpc('validate_mesa_token', {
    //     mesa_id_param: mesa_id,
    //     token_param: token
    //   })

    // if (tokenError) {
    //   console.error('Error validando token:', tokenError)
    //   throw new Error('Error validando token de mesa')
    // }

    // if (!tokenValid) {
    //   throw new Error('Token de mesa inválido o expirado')
    // }

    console.log('Token validation skipped for testing - mesa_id:', mesa_id, 'token:', token)

    // Inicializar Mercado Pago
    const client = new MercadoPagoConfig({ 
      accessToken: MP_ACCESS_TOKEN,
      options: { timeout: 5000 }
    })
    const preference = new Preference(client)

    // Generar token único para el pedido
    const orderToken = crypto.randomUUID()

    // Crear el pedido con la estructura simplificada usando solo items
    const orderData = {
      mesa_id: mesa_id.toString(),
      token: orderToken,
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
        success: `https://jkiqaytofyqrptkzvzei.supabase.co/functions/v1/payment-success`,
        failure: `https://jkiqaytofyqrptkzvzei.supabase.co/functions/v1/payment-failure`,
        pending: `https://jkiqaytofyqrptkzvzei.supabase.co/functions/v1/payment-pending`
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
        order_token: order.token,
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