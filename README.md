# Allo Health - Inventory & Reservation System

This repository contains the implementation for the Allo Health Inventory and Order-Fulfillment platform. The application is built to handle multi-warehouse inventory tracking and resolve checkout race conditions through a concurrent reservation system.

## Live Deployments

- **Vercel Application**: https://allo-health.vercel.app
- **Railway Application**: https://allo-health-production-592a.up.railway.app

## Requirements Addressed

### Data Model
- **Product**: Manages SKU, name, and description.
- **Warehouse**: Represents physical location-based inventory hubs.
- **Stock**: Tracks total inventory units and actively reserved units per product-warehouse combination.
- **Reservation**: Implements a state machine (pending → confirmed/released) with a strict 10-minute expiry window.

### API Architecture

| Method | Path | Description | HTTP Response |
|--------|------|-------------|---------------|
| `GET` | `/api/products` | Retrieve products alongside available stock per warehouse. | 200 OK |
| `GET` | `/api/warehouses` | Retrieve all registered warehouses. | 200 OK |
| `POST` | `/api/reservations` | Reserve units for a specific product and warehouse. | 201 Created, 409 Conflict |
| `POST` | `/api/reservations/:id/confirm` | Confirm reservation upon payment success. | 200 OK, 410 Gone |
| `POST` | `/api/reservations/:id/release` | Release reservation early upon payment failure. | 200 OK |
| `GET` | `/api/reservations/:id` | Retrieve reservation details. | 200 OK |

### Concurrency and Reservation Safety

**The Challenge:** Mitigating race conditions when multiple customers attempt to reserve the same physical unit simultaneously.

**The Solution:**
The system uses PostgreSQL row-level locks via Prisma transactions. When a reservation request is received, the corresponding stock row is locked using a `SELECT ... FOR UPDATE` raw query. This guarantees atomic read-check-write operations.

1. **Isolation:** Transaction isolation ensures a consistent view of available stock.
2. **Outcome:** Under concurrent load, precisely one request succeeds (HTTP 201), and competing requests fail safely (HTTP 409).

### Automatic Reservation Expiry
Reservations that are not confirmed within the 10-minute window are automatically released. 
- **Cron Job Setup:** A Vercel Cron job triggers the `/api/cron/release-expired` endpoint every minute to find and release expired reservations, restoring the reserved units to the available pool.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Zod Validation
- **Database**: PostgreSQL (Supabase/Neon) and Prisma ORM
- **Concurrency**: PostgreSQL Row-Level Locks (`FOR UPDATE`)

## Local Setup Instructions

### Prerequisites
- Node.js 18 or higher
- Access to a PostgreSQL Database (e.g., Supabase, Neon)

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/ThameemKing/allo-health.git
   cd allo-health
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory and add your database credentials:
   ```env
   DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
   DIRECT_URL="postgresql://user:password@host:port/database?schema=public"
   CRON_SECRET="your_secure_cron_secret"
   ```

4. Initialize the Database:
   Generate the Prisma client, run migrations, and seed initial data:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   npm run prisma:seed
   ```

5. Start the Development Server:
   ```bash
   npm run dev
   ```
   Navigate to `http://localhost:3000` to interact with the application.

## Testing Guidelines

### Manual Verification
1. Navigate to the main product listing.
2. Select an item and initiate a reservation.
3. Observe the countdown timer on the checkout page.
4. Finalize or cancel the reservation to trigger stock state updates.

### Concurrency Verification
To simulate concurrent reservation requests for the final available unit, execute two requests simultaneously:

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"productId":"<PRODUCT_ID>","warehouseId":"<WAREHOUSE_ID>","quantity":1}' & \
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"productId":"<PRODUCT_ID>","warehouseId":"<WAREHOUSE_ID>","quantity":1}'
```

The expected outcome is one successful reservation (201) and one conflict error (409).

## Future Work & Scalability
- **Idempotency**: The `IdempotencyKey` model is included in the Prisma schema to establish a framework for preventing duplicate payment confirmations during network retries. Full endpoint implementation is pending.
- **Connection Pooling**: Use PgBouncer or equivalent when scaling to thousands of concurrent database connections.

## License
MIT
