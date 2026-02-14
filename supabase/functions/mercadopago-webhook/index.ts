// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "@supabase/supabase-js"
import { MercadoPagoConfig, Payment } from "mercadopago"

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

/**
 * Validate MercadoPago webhook signature.
 * MP sends x-signature header in the format: ts=...,v1=...
 * The signed payload is: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * HMAC-SHA256 with the webhook_secret.
 */
async function validateWebhookSignature(
  req: Request,
  body: any,
  webhookSecret: string
): Promise<boolean> {
  if (!webhookSecret) {
    // If no secret configured, skip validation (development mode)
    console.warn("No webhook_secret configured, skipping signature validation")
    return true
  }

  const xSignature = req.headers.get("x-signature")
  const xRequestId = req.headers.get("x-request-id")

  if (!xSignature || !xRequestId) {
    console.warn("Missing x-signature or x-request-id headers")
    return false
  }

  // Parse x-signature: ts=...,v1=...
  const parts: Record<string, string> = {}
  for (const part of xSignature.split(",")) {
    const [key, ...valueParts] = part.split("=")
    if (key && valueParts.length > 0) {
      parts[key.trim()] = valueParts.join("=").trim()
    }
  }

  const ts = parts["ts"]
  const v1 = parts["v1"]

  if (!ts || !v1) {
    console.warn("Invalid x-signature format")
    return false
  }

  // Build the signed payload per MP docs
  const dataId = body?.data?.id ? String(body.data.id) : ""
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`

  // Compute HMAC-SHA256
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(manifest)
  )
  const computed = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  return computed === v1
}

serve(async (req) => {
  try {
    // Parse restaurantId and branchId from query params
    // (set by create-payment-preference in notification_url)
    const url = new URL(req.url)
    const restaurantId = url.searchParams.get("restaurantId")
    const branchId = url.searchParams.get("branchId") || null

    const body = await req.json()
    const { type, data } = body

    if (type !== "payment") {
      return new Response("OK", { status: 200 })
    }

    const paymentId = data?.id
    if (!paymentId) {
      throw new Error("Payment ID no encontrado")
    }

    // Configuration
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("Supabase env vars no configuradas")
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get MercadoPago config for signature validation and payment lookup
    let mpConfig: any = null
    if (restaurantId) {
      mpConfig = await getMpConfig(supabase, restaurantId, branchId)
    }

    // Validate webhook signature if we have a config with webhook_secret
    if (mpConfig?.webhook_secret) {
      const isValid = await validateWebhookSignature(
        req,
        body,
        mpConfig.webhook_secret
      )
      if (!isValid) {
        console.error("Invalid webhook signature")
        return new Response(
          JSON.stringify({ error: "Firma de webhook invalida" }),
          {
            headers: { "Content-Type": "application/json" },
            status: 401,
          }
        )
      }
    }

    // Determine access_token to use for fetching payment info
    const accessToken = mpConfig?.access_token
    if (!accessToken) {
      // Fallback: try global env (development only)
      const envToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")
      if (!envToken) {
        throw new Error(
          "No se encontro access_token para consultar el pago"
        )
      }
      console.warn("Using global env MERCADO_PAGO_ACCESS_TOKEN as fallback")
    }

    const tokenToUse = accessToken || Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN")!

    // Initialize MercadoPago with correct access_token
    const client = new MercadoPagoConfig({
      accessToken: tokenToUse,
      options: { timeout: 5000 },
    })
    const payment = new Payment(client)

    // Get payment info from MercadoPago
    const paymentInfo = await payment.get({ id: paymentId })
    const externalReference = paymentInfo.external_reference

    if (!externalReference) {
      throw new Error("External reference no encontrado en pago")
    }

    // --- Idempotency check ---
    // Fetch current order state before updating
    const { data: orderRows, error: orderFetchErr } = await supabase
      .from("orders")
      .select("id, status, mp_payment_id, items")
      .eq("id", externalReference)
      .limit(1)

    if (orderFetchErr) {
      throw new Error(`Error buscando pedido: ${orderFetchErr.message}`)
    }

    const existingOrder = orderRows && orderRows.length > 0 ? orderRows[0] : null
    if (!existingOrder) {
      throw new Error(`Pedido no encontrado: ${externalReference}`)
    }

    // If order is already in a final approved state and this payment was already
    // processed, skip to avoid double stock decrement
    const alreadyApproved =
      existingOrder.status === "PAYMENT_APPROVED" &&
      existingOrder.mp_payment_id === String(paymentId)

    if (alreadyApproved) {
      console.log(
        `Webhook duplicado para pedido ${externalReference}, payment ${paymentId} - ignorando`
      )
      return new Response("OK", { status: 200 })
    }

    // Map MercadoPago status to order status
    let orderStatus = "PAYMENT_PENDING"
    switch (paymentInfo.status) {
      case "approved":
        orderStatus = "PAYMENT_APPROVED"
        break
      case "rejected":
      case "cancelled":
        orderStatus = "PAYMENT_REJECTED"
        break
      case "pending":
      case "in_process":
        orderStatus = "PAYMENT_PENDING"
        break
      default:
        orderStatus = "PAYMENT_PENDING"
        break
    }

    // Build update payload with mp_* fields
    const updatePayload: Record<string, any> = {
      status: orderStatus,
      mp_payment_id: String(paymentId),
      mp_status: paymentInfo.status || null,
      mp_status_detail: paymentInfo.status_detail || null,
    }

    if (paymentInfo.status === "approved" && paymentInfo.date_approved) {
      updatePayload.mp_paid_at = paymentInfo.date_approved
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", externalReference)

    if (updateErr) {
      throw new Error(`Error actualizando pedido: ${updateErr.message}`)
    }

    // --- Stock decrement on approved payment (only if not previously approved) ---
    const wasAlreadyApproved = existingOrder.status === "PAYMENT_APPROVED"

    if (orderStatus === "PAYMENT_APPROVED" && !wasAlreadyApproved) {
      const items = Array.isArray(existingOrder.items)
        ? existingOrder.items
        : []

      // Aggregate consumption by ingredient from product recipes
      const consumption: Record<string, number> = {}

      for (const it of items) {
        if (!it.id || !it.quantity) continue
        const { data: recipes, error: recipeErr } = await supabase
          .from("recipes")
          .select("ingredient_id, quantity")
          .eq("product_id", it.id.toString())
        if (recipeErr) throw recipeErr

        for (const r of recipes || []) {
          const key = String(r.ingredient_id)
          const qty =
            parseFloat(String(r.quantity || "0")) * Number(it.quantity)
          consumption[key] = (consumption[key] || 0) + qty
        }
      }

      // Apply consumption, skip ingredients with track_stock=false
      for (const [ingredientId, consume] of Object.entries(consumption)) {
        const { data: ingRows, error: ingErr } = await supabase
          .from("ingredients")
          .select("current_stock, min_stock, track_stock")
          .eq("id", ingredientId)
          .limit(1)
        if (ingErr) throw ingErr
        const ing = ingRows && ingRows[0]
        if (!ing || ing.track_stock === false) continue

        const current = parseFloat(String(ing.current_stock || "0"))
        const next = +(current - consume).toFixed(2)
        if (next < 0) {
          continue
        }

        const { error: decErr } = await supabase
          .from("ingredients")
          .update({ current_stock: next.toFixed(2) })
          .eq("id", ingredientId)
        if (decErr) throw decErr

        // If reached min, disable related products
        const min = parseFloat(String(ing.min_stock || "0"))
        if (next <= min) {
          const { data: relProducts, error: relErr } = await supabase
            .from("recipes")
            .select("product_id")
            .eq("ingredient_id", ingredientId)
          if (relErr) throw relErr
          const productIds = Array.from(
            new Set((relProducts || []).map((p: any) => p.product_id))
          )
          if (productIds.length > 0) {
            const { error: disableErr } = await supabase
              .from("menu")
              .update({ available: false })
              .in("id", productIds)
            if (disableErr) throw disableErr
          }
        }
      }
    }

    return new Response("OK", { status: 200 })
  } catch (error) {
    console.error("Webhook error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})
