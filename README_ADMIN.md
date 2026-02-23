# Café Stock System - Admin Setup Guide

This guide will help you set up and use the café stock management system.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Environment variables configured

## AFIP/ARCA Electronic Invoicing (WSAA + WSFEv1)

Multi-restaurant AFIP/ARCA invoicing using WSAA authentication and WSFEv1 billing.

### Architecture

| Component | Table / Module |
|-----------|---------------|
| Config per restaurant | `restaurant_afip_config` (cert/key encrypted with AES-GCM) |
| Token cache | `restaurant_afip_tokens` (per restaurant + environment + service) |
| Branch punto de venta | `branches.afip_pto_vta` / `branches.afip_share_pto_vta_branch_id` |
| Invoices | `invoices` (CAE, QR, request/response audit) |

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `AFIP_MASTER_KEY_B64` | 32-byte AES key in base64. Encrypts cert/key at rest. |
| `DATABASE_URL` | PostgreSQL connection string (Supabase URI). Required for advisory lock. |
| `SUPABASE_URL` / `SUPABASE_KEY` | Existing project credentials. |

Generate `AFIP_MASTER_KEY_B64`:

```bash
python3 -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
```

`DATABASE_URL` must point to the Supabase PostgreSQL instance (Settings > Database > Connection string > URI).

### Admin Setup Steps

1. Go to **Admin > AFIP/ARCA** tab.
2. Fill in:
   - CUIT (11 digits)
   - IVA condition (`MONOTRIBUTO` or `RI`)
   - Environment (`homo` for testing, `prod` for production)
   - Certificate PEM/CRT (file upload or paste)
   - Private key PEM/KEY (file upload or paste; passphrase only if key is encrypted)
3. Enable the toggle and save.
4. Configure each branch:
   - Set `afip_pto_vta` (the punto de venta number registered with AFIP), **or**
   - Choose "share from another branch" (e.g. if two branches share one punto de venta).
5. Click **Probar conexion** to verify WSAA login + FECompUltimoAutorizado.

### "Imprimir cuenta" vs "Factura (AFIP)"

| | Imprimir cuenta (no fiscal) | Factura (AFIP) |
|-|----------------------------|----------------|
| Availability | Always | Only when AFIP is enabled, cert/key present, and branch has pto_vta |
| Fiscal validity | None | CAE from AFIP, legally valid |
| Content | Order items + total | Items + total + CAE + CAE vto + QR ARCA |
| When to use | Quick receipt, no tax requirements | Customer requests fiscal invoice |

### Cashier Flow

1. Cashier opens pre-bill dialog for an order.
2. Two options appear:
   - **Imprimir cuenta (no fiscal)** -- always available, prints non-fiscal receipt.
   - **Factura (AFIP)** -- enabled only when AFIP is ready. Calls `POST /api/invoices/authorize`, obtains CAE, then opens the fiscal print page with QR.
3. If AFIP is not configured, the button is disabled with a message.
4. If authorization fails, an error is shown and the cashier can still print a non-fiscal receipt.

### Homologation vs Production

- `homo`: for testing and certification. Uses AFIP homologation endpoints.
- `prod`: production. Requires production certificate/key and a registered punto de venta.

### Security

- Certificate and private key are encrypted with AES-256-GCM using `AFIP_MASTER_KEY_B64` before storage.
- Passphrase (if any) is used only during key import and never persisted.
- WSAA token/sign are cached in DB with expiration; they are short-lived (12h).
- The openssl passphrase is passed via stdin, not command-line arguments.
- No certificate, key, token, sign, or payload content is written to logs.

### AFIP Endpoints (Backend)

#### GET /api/admin/afip/config

Returns non-sensitive config. Auth: admin, caja.

Response:
```json
{
  "configured": true,
  "enabled": true,
  "cuit": "20123456789",
  "iva_condition": "MONOTRIBUTO",
  "environment": "homo",
  "has_certificate": true,
  "has_private_key": true,
  "ready": true,
  "branches": [
    {
      "id": "uuid",
      "name": "Sucursal Centro",
      "afip_pto_vta": 1,
      "afip_share_pto_vta_branch_id": null,
      "effective_afip_pto_vta": 1
    }
  ]
}
```

#### PUT /api/admin/afip/config

Accepts multipart (file uploads) or JSON. Auth: admin.

Multipart fields: `cuit`, `iva_condition`, `environment`, `enabled`, `cert_file`, `key_file`, `key_passphrase` (optional).

#### POST /api/admin/afip/test-connection

Auth: admin. Body (optional): `{"branch_id": "uuid"}`.

Response: `{"ok": true, "environment": "homo", "pto_vta": 1, "ultimo_cbte_c": 42}`.

#### PUT /api/admin/branches/{branch_id}/afip-pto-vta

Auth: admin. Body:

```json
{"afip_pto_vta": 1}
```
or
```json
{"afip_share_pto_vta_branch_id": "uuid-of-source-branch"}
```

#### POST /api/invoices/authorize

Auth: admin, caja. Body:

```json
{
  "branch_id": "uuid",
  "order_id": "uuid",
  "totals": {"total": 1500.00},
  "requested_cbte_kind": "auto",
  "customer": {}
}
```

Success response:
```json
{
  "invoice_id": "uuid",
  "pto_vta": 1,
  "cbte_nro": 43,
  "cbte_tipo": 11,
  "cbte_kind": "C",
  "cae": "74123456789012",
  "cae_vto": "2026-03-05",
  "qr_url": "https://www.arca.gob.ar/fe/qr/?p=...",
  "qr_image_b64": "iVBOR..."
}
```

Error response:
```json
{
  "error": "AFIP_REJECTED",
  "message": "Comprobante rechazado por AFIP",
  "details": {"errors": [{"code": "10016", "message": "..."}]}
}
```

#### GET /api/invoices/{invoice_id}

Auth: admin, caja. Returns full invoice data for the print page.

## Installation

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install required dependencies:**
   ```bash
   npm install zod @prisma/client
   npm install -D prisma tsx
   ```

3. **Set up environment variables:**
   Create a `.env` file in the frontend directory:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/cafe_db"
   ```

4. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

5. **Run database migrations:**
   ```bash
   npx prisma migrate dev --name init_recipes
   ```

6. **Seed the database with sample data:**
   ```bash
   npx tsx prisma/seed.ts
   ```
   
   Alternative if tsx is not available:
   ```bash
   node -r ts-node/register prisma/seed.ts
   ```

## Development

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Access admin pages:**
   - Ingredients Management: `http://localhost:3000/admin/ingredients`
   - Recipe Management: `http://localhost:3000/admin/menu/[product-id]/recipe`
     - Example: `http://localhost:3000/admin/menu/1/recipe`

## Features

### Ingredients Management (`/admin/ingredients`)
- **View all ingredients** with pagination and search
- **Add new ingredients** with name, unit, stock, and cost
- **Edit existing ingredients** inline
- **Delete ingredients** (protected if used in recipes)
- **Supported units:** g, kg, ml, l, unit, tbsp, tsp, piece

### Recipe Management (`/admin/menu/[id]/recipe`)
- **View current recipe** for a product
- **Add ingredients** to recipes with quantities
- **Update quantities** inline
- **Remove ingredients** from recipes
- **Calculate estimated cost** per product based on ingredient costs

## API Endpoints

### Ingredients
- `GET /api/ingredients` - List ingredients (with pagination/search)
- `POST /api/ingredients` - Create new ingredient
- `PATCH /api/ingredients/[id]` - Update ingredient
- `DELETE /api/ingredients/[id]` - Delete ingredient

### Recipes
- `GET /api/recipes?productId=[id]` - Get recipe for product
- `POST /api/recipes` - Add ingredient to recipe
- `PATCH /api/recipes` - Update recipe quantity
- `DELETE /api/recipes` - Remove ingredient from recipe

## Testing

Run the basic tests:
```bash
node tests/stock.test.ts
```

For comprehensive testing with vitest:
```bash
npm install -D vitest
npx vitest
```

## Database Schema

The system adds three main tables:
- **ingredients** - Stores ingredient information and current stock
- **recipes** - Junction table linking products to ingredients with quantities
- **menu** - Extended existing menu table with recipe relationships

## Business Logic

### Stock Consumption
- `getProductRecipe(productId)` - Get recipe for a product
- `computeBatchConsumption(items)` - Calculate total ingredient consumption for multiple orders
- `applyConsumption(consumption)` - Safely apply stock consumption with negative stock protection

### Validation
- All inputs validated using Zod schemas
- Unit costs must be non-negative
- Stock quantities must be non-negative
- Recipe quantities must be positive

## Troubleshooting

1. **Migration errors:** Ensure PostgreSQL is running and DATABASE_URL is correct
2. **Permission errors:** Check database user permissions
3. **Build errors:** Ensure all dependencies are installed with `npm install`
4. **Seed errors:** Make sure migrations ran successfully first
5. **Linter errors:** Install missing dependencies with `npm install @prisma/client zod`

## Next Steps

1. Integrate with existing order system to automatically consume stock
2. Add stock alerts for low inventory
3. Add ingredient purchase tracking
4. Implement stock history and reporting

## Quick Start

After setting up the database and dependencies:

```bash
cd frontend
npm run dev
```

Then visit:
- http://localhost:3000/admin/ingredients
- http://localhost:3000/admin/menu/1/recipe 
