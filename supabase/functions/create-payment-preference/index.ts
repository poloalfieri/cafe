// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "@supabase/supabase-js"
import { MercadoPagoConfig, Preference } from "mercadopago"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

/**
 * Resolve effective branch ID by following mp_config_source_branch_id chain.
 * Includes cycle protection (max 5 hops).
 */
async function resolveEffectiveBranchId(
  supabase: any,
  branchId: string
): Promise<string> {
  const visited = new Set<string>()
  let current = branchId

  for (let i = 0; i < 5; i++) {
    if (visited.has(current)) {
      console.error(`Cycle detected in mp_config_source_branch_id chain: startBranch=${branchId}, path=${Array.from(visited).join(" -> ")} -> ${current}`)
      throw new Error("Invalid branch payment configuration (cycle detected)")
    }
    visited.add(current)

    const { data } = await supabase
      .from("branches")
      .select("mp_config_source_branch_id")
      .eq("id", current)
      .limit(1)

    const row = data && data.length > 0 ? data[0] : null
    if (!row?.mp_config_source_branch_id) {
      return current // this is the final effective branch
    }
    current = row.mp_config_source_branch_id
  }

  console.error(`Max hops exceeded in mp_config_source_branch_id chain: startBranch=${branchId}, path=${Array.from(visited).join(" -> ")}`)
  throw new Error("Invalid branch payment configuration (cycle detected)")
}

/**
 * Fetch MercadoPago config from payment_configs with fallback:
 *   1) Resolve mp_config_source_branch_id to find effective branch
 *   2) branch-level (restaurant_id + effective_branch_id)
 *   3) restaurant-level (restaurant_id + branch_id IS NULL)
 * Returns null if none found.
 */
async function getMpConfig(
  supabase: any,
  restaurantId: string,
  branchId: string | null
) {
  let effectiveBranchId = branchId

  // Resolve source branch chain if applicable
  if (branchId) {
    effectiveBranchId = await resolveEffectiveBranchId(supabase, branchId)
  }

  // Try branch-specific config first
  if (effectiveBranchId) {
    const { data } = await supabase
      .from("payment_configs")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("branch_id", effectiveBranchId)
      .eq("provider", "mercadopago")
      .eq("enabled", true)
      .limit(1)
    if (data && data.length > 0) return data[0]
  }

  // Fallback to restaurant-level config
  const { data } = await supabase
    .from("payment_configs")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .is("branch_id", null)
    .eq("provider", "mercadopago")
    .eq("enabled", true)
    .limit(1)
  if (data && data.length > 0) return data[0]

  return null
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { mesa_id, items, total_amount, token } = await req.json()

    // Validations
    if (!mesa_id || !items || !total_amount || !token) {
      throw new Error("mesa_id, items, total_amount y token son requeridos")
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const APP_BASE_URL =
      Deno.env.get("APP_BASE_URL") || Deno.env.get("SUPABASE_URL")

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("Supabase env vars no configuradas")
    }

    // Use service role to access payment_configs and validate mesa
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // --- Validate mesa token ---
    const { data: mesaRows, error: mesaError } = await supabase
      .from("mesas")
      .select("id, mesa_id, token, token_expires_at, is_active, restaurant_id, branch_id")
      .eq("mesa_id", mesa_id)
      .limit(1)

    if (mesaError) {
      console.error("Error buscando mesa:", mesaError)
      throw new Error("Error validando mesa")
    }

    const mesa = mesaRows && mesaRows.length > 0 ? mesaRows[0] : null
    if (!mesa) {
      throw new Error("Mesa no encontrada")
    }

    if (!mesa.is_active) {
      throw new Error("Mesa no esta activa")
    }

    if (mesa.token !== token) {
      throw new Error("Token de mesa invalido")
    }

    if (mesa.token_expires_at) {
      const expiresAt = new Date(mesa.token_expires_at)
      if (expiresAt <= new Date()) {
        throw new Error("Token de mesa expirado")
      }
    }

    const restaurantId = mesa.restaurant_id
    const branchId = mesa.branch_id

    if (!restaurantId) {
      throw new Error("Mesa sin restaurant_id asociado")
    }

    // --- Get MercadoPago config with fallback ---
    const mpConfig = await getMpConfig(supabase, restaurantId, branchId)

    if (!mpConfig || !mpConfig.access_token) {
      throw new Error(
        "MercadoPago no configurado para este restaurante/sucursal"
      )
    }

    // --- Initialize MercadoPago with the correct access_token ---
    const client = new MercadoPagoConfig({
      accessToken: mpConfig.access_token,
      options: { timeout: 5000 },
    })
    const preference = new Preference(client)

    // Generate unique order token
    const orderToken = crypto.randomUUID()

    // Create the order
    const orderData: Record<string, any> = {
      mesa_id: mesa_id.toString(),
      token: orderToken,
      status: "PAYMENT_PENDING",
      items: items,
      creation_date: new Date().toISOString(),
      payment_method: "mercadopago",
      restaurant_id: restaurantId,
    }
    if (branchId) {
      orderData.branch_id = branchId
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderData)
      .select()
      .single()

    if (orderError) {
      throw new Error(`Error creando pedido: ${orderError.message}`)
    }

    // Build notification_url with restaurant/branch params for webhook to
    // resolve the correct webhook_secret
    const webhookParams = new URLSearchParams({
      restaurantId: restaurantId,
    })
    if (branchId) {
      webhookParams.set("branchId", branchId)
    }
    const notificationUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook?${webhookParams.toString()}`

    // Determine frontend URL for back_urls
    const frontendUrl =
      Deno.env.get("FRONTEND_URL") || "http://localhost:3000"

    // Prepare items for MercadoPago
    const mpItems = items.map((item: any) => ({
      title: item.name,
      quantity: item.quantity,
      unit_price: parseFloat(item.price),
      currency_id: "ARS",
    }))

    // Create MercadoPago preference
    const preferenceData = {
      items: mpItems,
      external_reference: order.id,
      notification_url: notificationUrl,
      back_urls: {
        success: `${frontendUrl}/payment/success?order_id=${order.id}`,
        failure: `${frontendUrl}/payment/error?message=payment_failed`,
        pending: `${frontendUrl}/payment/pending?order_id=${order.id}`,
      },
      auto_return: "approved",
      statement_descriptor: "CAFE LOCAL",
      metadata: {
        mesa_id: mesa_id.toString(),
        order_id: order.id,
        restaurant_id: restaurantId,
        branch_id: branchId || "",
      },
    }

    const mpResponse = await preference.create({ body: preferenceData })

    // Persist mp_preference_id on order
    await supabase
      .from("orders")
      .update({
        mp_preference_id: mpResponse.id,
        mp_status: "pending",
      })
      .eq("id", order.id)

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order_token: order.token,
        init_point: mpResponse.init_point,
        preference_id: mpResponse.id,
        public_key: mpConfig.public_key || "",
        total_amount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
