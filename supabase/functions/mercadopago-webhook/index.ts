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
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ status: orderStatus })
      .eq('id', externalReference)

    if (updateErr) {
      throw new Error(`Error actualizando pedido: ${updateErr.message}`)
    }

    // On approved payment: decrement stock based on recipes and items
    if (orderStatus === 'PAYMENT_APPROVED') {
      // Fetch order items
      const { data: orders, error: orderErr } = await supabase
        .from('orders')
        .select('items')
        .eq('id', externalReference)
        .limit(1)
      if (orderErr) throw orderErr
      const order = orders && orders[0]
      const items = Array.isArray(order?.items) ? order.items : []

      // Aggregate consumption by ingredient from product recipes
      const consumption: Record<string, number> = {}

      for (const it of items) {
        if (!it.id || !it.quantity) continue
        // Get recipe for product id
        const { data: recipes, error: recipeErr } = await supabase
          .from('recipes')
          .select('ingredient_id, quantity')
          .eq('product_id', it.id.toString())
        if (recipeErr) throw recipeErr

        for (const r of recipes || []) {
          const key = String(r.ingredient_id)
          const qty = parseFloat(String(r.quantity || '0')) * Number(it.quantity)
          consumption[key] = (consumption[key] || 0) + qty
        }
      }

      // Apply consumption in a best-effort manner, skipping ingredients with track_stock=false
      for (const [ingredientId, consume] of Object.entries(consumption)) {
        // Check track_stock and current values
        const { data: ingRows, error: ingErr } = await supabase
          .from('ingredients')
          .select('current_stock, min_stock, track_stock')
          .eq('id', ingredientId)
          .limit(1)
        if (ingErr) throw ingErr
        const ing = ingRows && ingRows[0]
        if (!ing || ing.track_stock === false) continue

        const current = parseFloat(String(ing.current_stock || '0'))
        const next = +(current - consume).toFixed(2)
        if (next < 0) {
          // Skip negative to avoid breaking inventory; could log
          continue
        }

        const { error: decErr } = await supabase
          .from('ingredients')
          .update({ current_stock: next.toFixed(2) })
          .eq('id', ingredientId)
        if (decErr) throw decErr

        // If reached min, disable related products
        const min = parseFloat(String(ing.min_stock || '0'))
        if (next <= min) {
          const { data: relProducts, error: relErr } = await supabase
            .from('recipes')
            .select('product_id')
            .eq('ingredient_id', ingredientId)
          if (relErr) throw relErr
          const productIds = Array.from(new Set((relProducts || []).map((p: any) => p.product_id)))
          if (productIds.length > 0) {
            const { error: disableErr } = await supabase
              .from('menu')
              .update({ available: false })
              .in('id', productIds)
            if (disableErr) throw disableErr
          }
        }
      }
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