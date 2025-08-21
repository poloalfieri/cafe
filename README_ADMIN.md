# Café Stock System - Admin Setup Guide

This guide will help you set up and use the café stock management system.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Environment variables configured

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