import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireRestaurantAuth } from "@/lib/api-auth";

// Roles allowed to manage payment config
const ALLOWED_ROLES = ["owner", "admin", "desarrollador"] as const;

function maskToken(token: string | null | undefined): string {
  if (!token) return "";
  if (token.length <= 4) return "****";
  return "*".repeat(token.length - 4) + token.slice(-4);
}

/**
 * GET /api/admin/payment-config?restaurantId=...&branchId=...&level=...
 *
 * Returns current MercadoPago config with masked access_token.
 *
 * Query params:
 * - level: "restaurant" (only global config) or "branch" (branch with fallback, default)
 *
 * Response includes:
 * - mercadopago: config fields (masked)
 * - scope: "branch" | "restaurant" | "none"
 * - branch_config_source: { type: "self"|"restaurant"|"branch"|"none", source_branch_id?, source_branch_name? }
 * - eligible_branches: [{ id, name }] — other branches with their own MP config
 */
export async function GET(req: NextRequest) {
  const auth = await requireRestaurantAuth(req, [...ALLOWED_ROLES]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") || auth.restaurantId;
  const branchId = searchParams.get("branchId") || null;
  const level = searchParams.get("level") || "branch"; // "branch" | "restaurant"

  const admin = getSupabaseAdmin();

  // --- Determine branch_config_source from branches.mp_config_source_branch_id ---
  let branchConfigSource: {
    type: "self" | "restaurant" | "branch" | "none";
    source_branch_id?: string;
    source_branch_name?: string;
  } = { type: "none" };

  let effectiveBranchIdForConfig = branchId;

  if (branchId) {
    const { data: branchRow } = await admin
      .from("branches")
      .select("id, name, mp_config_source_branch_id")
      .eq("id", branchId)
      .limit(1);

    const branch = branchRow && branchRow.length > 0 ? branchRow[0] : null;

    if (branch?.mp_config_source_branch_id) {
      // This branch points to another branch
      const sourceBranchId = branch.mp_config_source_branch_id;
      // Look up source branch name
      const { data: sourceRow } = await admin
        .from("branches")
        .select("id, name")
        .eq("id", sourceBranchId)
        .limit(1);

      const sourceBranch = sourceRow && sourceRow.length > 0 ? sourceRow[0] : null;

      branchConfigSource = {
        type: "branch",
        source_branch_id: sourceBranchId,
        source_branch_name: sourceBranch?.name || "Sucursal desconocida",
      };

      // Override: use source branch for config resolution
      effectiveBranchIdForConfig = sourceBranchId;
    }
  }

  // --- Fetch MercadoPago config ---
  let scope: "branch" | "restaurant" | "none" = "none";
  let config: any = null;

  if (level === "restaurant") {
    // Only fetch restaurant-level config (no fallback)
    const { data } = await admin
      .from("payment_configs")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .is("branch_id", null)
      .eq("provider", "mercadopago")
      .limit(1);

    if (data && data.length > 0) {
      config = data[0];
      scope = "restaurant";
    }
  } else {
    // level === "branch" (default): Try branch-level config first with fallback
    if (effectiveBranchIdForConfig) {
      const { data } = await admin
        .from("payment_configs")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("branch_id", effectiveBranchIdForConfig)
        .eq("provider", "mercadopago")
        .limit(1);

      if (data && data.length > 0) {
        config = data[0];
        scope = "branch";
      }
    }

    // Fallback to restaurant-level config
    if (!config) {
      const { data } = await admin
        .from("payment_configs")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .is("branch_id", null)
        .eq("provider", "mercadopago")
        .limit(1);

      if (data && data.length > 0) {
        config = data[0];
        scope = "restaurant";
      }
    }
  }

  // If branch_config_source was not set to "branch" (another branch), derive it from scope
  if (branchId && branchConfigSource.type !== "branch") {
    if (scope === "branch") {
      branchConfigSource = { type: "self" };
    } else if (scope === "restaurant") {
      branchConfigSource = { type: "restaurant" };
    } else {
      branchConfigSource = { type: "none" };
    }
  }

  // --- Fetch eligible source branches (for "use another branch" picker) ---
  let eligibleBranches: { id: string; name: string }[] = [];

  if (branchId) {
    // Get all branches of this restaurant that have their own MP config enabled
    const { data: allBranches } = await admin
      .from("branches")
      .select("id, name")
      .eq("restaurant_id", restaurantId);

    if (allBranches && allBranches.length > 0) {
      // Get branch IDs that have MP config
      const branchIds = allBranches
        .map((b: any) => b.id)
        .filter((id: string) => id !== branchId); // exclude current branch

      if (branchIds.length > 0) {
        const { data: configuredBranches } = await admin
          .from("payment_configs")
          .select("branch_id")
          .eq("restaurant_id", restaurantId)
          .eq("provider", "mercadopago")
          .eq("enabled", true)
          .in("branch_id", branchIds);

        const configuredBranchIds = new Set(
          (configuredBranches || []).map((c: any) => c.branch_id)
        );

        eligibleBranches = allBranches
          .filter(
            (b: any) => b.id !== branchId && configuredBranchIds.has(b.id)
          )
          .map((b: any) => ({ id: b.id, name: b.name }));
      }
    }
  }

  if (!config) {
    return NextResponse.json({
      mercadopago: {
        enabled: false,
        access_token: "",
        public_key: "",
        webhook_url: "",
        webhook_secret: "",
      },
      scope: "none",
      branch_config_source: branchConfigSource,
      eligible_branches: eligibleBranches,
    });
  }

  return NextResponse.json({
    mercadopago: {
      enabled: config.enabled ?? false,
      access_token: maskToken(config.access_token),
      public_key: config.public_key || "",
      webhook_url: config.webhook_url || "",
      webhook_secret: maskToken(config.webhook_secret),
    },
    scope,
    branch_config_source: branchConfigSource,
    eligible_branches: eligibleBranches,
  });
}

/**
 * POST /api/admin/payment-config
 *
 * Body: {
 *   restaurantId, branchId,
 *   scope: "branch"|"restaurant",
 *   source_mode: "self"|"restaurant"|"branch",
 *   source_branch_id?: string,          // when source_mode === "branch"
 *   mercadopago?: { enabled, access_token, public_key, webhook_url, webhook_secret }
 * }
 *
 * When source_mode === "branch":
 *   - Validates source branch has valid MP config
 *   - Sets branches.mp_config_source_branch_id = source_branch_id
 *   - Does NOT upsert payment_configs for this branch
 *
 * When source_mode === "self" or "restaurant":
 *   - Clears branches.mp_config_source_branch_id = null
 *   - Upserts payment_configs as before
 *
 * If access_token is empty or masked (contains only * and last 4 chars match),
 * keep the existing value.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRestaurantAuth(req, [...ALLOWED_ROLES]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const {
    restaurantId: bodyRestaurantId,
    branchId,
    scope,
    source_mode,
    source_branch_id,
    mercadopago,
  } = body;

  const restaurantId = bodyRestaurantId || auth.restaurantId;

  if (!restaurantId) {
    return NextResponse.json(
      { error: "restaurantId es requerido" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

  // --- Handle "use another branch" mode ---
  if (source_mode === "branch") {
    if (!branchId) {
      return NextResponse.json(
        { error: "branchId es requerido para source_mode 'branch'" },
        { status: 400 }
      );
    }
    if (!source_branch_id) {
      return NextResponse.json(
        { error: "source_branch_id es requerido para source_mode 'branch'" },
        { status: 400 }
      );
    }
    if (source_branch_id === branchId) {
      return NextResponse.json(
        { error: "No se puede apuntar a la misma sucursal" },
        { status: 400 }
      );
    }

    // Validate source branch has valid MP config
    const { data: sourceConfig } = await admin
      .from("payment_configs")
      .select("id, enabled")
      .eq("restaurant_id", restaurantId)
      .eq("branch_id", source_branch_id)
      .eq("provider", "mercadopago")
      .eq("enabled", true)
      .limit(1);

    if (!sourceConfig || sourceConfig.length === 0) {
      return NextResponse.json(
        {
          error:
            "La sucursal fuente no tiene MercadoPago configurado y habilitado",
        },
        { status: 400 }
      );
    }

    // Cycle detection: make sure source_branch doesn't point back to us
    const visited = new Set<string>([branchId]);
    let current = source_branch_id;
    for (let i = 0; i < 5; i++) {
      if (visited.has(current)) {
        return NextResponse.json(
          { error: "Referencia circular detectada entre sucursales" },
          { status: 400 }
        );
      }
      visited.add(current);
      const { data: nextBranch } = await admin
        .from("branches")
        .select("mp_config_source_branch_id")
        .eq("id", current)
        .limit(1);
      const next =
        nextBranch && nextBranch.length > 0
          ? nextBranch[0].mp_config_source_branch_id
          : null;
      if (!next) break;
      current = next;
    }

    // Set mp_config_source_branch_id on this branch
    const { error: updateBranchErr } = await admin
      .from("branches")
      .update({ mp_config_source_branch_id: source_branch_id })
      .eq("id", branchId);

    if (updateBranchErr) {
      return NextResponse.json(
        {
          error: `Error actualizando sucursal: ${updateBranchErr.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, source_mode: "branch" });
  }

  // --- Handle "self" or "restaurant" modes ---
  if (!scope || !["branch", "restaurant"].includes(scope)) {
    return NextResponse.json(
      { error: "scope debe ser 'branch' o 'restaurant'" },
      { status: 400 }
    );
  }

  if (scope === "branch" && !branchId) {
    return NextResponse.json(
      { error: "branchId es requerido para scope 'branch'" },
      { status: 400 }
    );
  }

  if (!mercadopago) {
    return NextResponse.json(
      { error: "mercadopago config es requerida" },
      { status: 400 }
    );
  }

  // Clear mp_config_source_branch_id if we are saving self or restaurant config
  if (branchId) {
    await admin
      .from("branches")
      .update({ mp_config_source_branch_id: null })
      .eq("id", branchId);
  }

  const targetBranchId = scope === "restaurant" ? null : branchId;

  // Check if config already exists
  let query = admin
    .from("payment_configs")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("provider", "mercadopago");

  if (targetBranchId) {
    query = query.eq("branch_id", targetBranchId);
  } else {
    query = query.is("branch_id", null);
  }

  const { data: existing } = await query.limit(1);
  const existingConfig = existing && existing.length > 0 ? existing[0] : null;

  // Determine access_token: keep existing if masked or empty
  let accessToken = mercadopago.access_token || "";
  const isMasked =
    !accessToken ||
    accessToken.trim() === "" ||
    /^\*+/.test(accessToken);

  if (isMasked && existingConfig?.access_token) {
    accessToken = existingConfig.access_token;
  }

  // Determine webhook_secret: keep existing if masked or empty
  let webhookSecret = mercadopago.webhook_secret || "";
  const isSecretMasked =
    !webhookSecret ||
    webhookSecret.trim() === "" ||
    /^\*+/.test(webhookSecret);

  if (isSecretMasked && existingConfig?.webhook_secret) {
    webhookSecret = existingConfig.webhook_secret;
  }

  const now = new Date().toISOString();

  if (existingConfig) {
    // Update existing
    const { error: updateError } = await admin
      .from("payment_configs")
      .update({
        enabled: mercadopago.enabled ?? false,
        access_token: accessToken,
        public_key: mercadopago.public_key || "",
        webhook_url: mercadopago.webhook_url || "",
        webhook_secret: webhookSecret,
        updated_at: now,
      })
      .eq("id", existingConfig.id);

    if (updateError) {
      return NextResponse.json(
        { error: `Error actualizando config: ${updateError.message}` },
        { status: 500 }
      );
    }
  } else {
    // Insert new
    const { error: insertError } = await admin
      .from("payment_configs")
      .insert({
        restaurant_id: restaurantId,
        branch_id: targetBranchId,
        provider: "mercadopago",
        enabled: mercadopago.enabled ?? false,
        access_token: accessToken,
        public_key: mercadopago.public_key || "",
        webhook_url: mercadopago.webhook_url || "",
        webhook_secret: webhookSecret,
        created_at: now,
        updated_at: now,
      });

    if (insertError) {
      return NextResponse.json(
        { error: `Error creando config: ${insertError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, scope });
}
