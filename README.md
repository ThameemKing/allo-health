# Allo Health - Inventory & Reservation System

A production-grade inventory management platform with concurrent reservation handling, built for multi-warehouse retail and D2C brands.

## Features

✅ **Concurrent Reservation System** - Race-condition-free reservations using database-level locking
✅ **Multi-Warehouse Support** - Manage inventory across multiple warehouses
✅ **Real-Time Stock Tracking** - Separate reserved and available units
✅ **Live Countdown Timer** - 10-minute reservation window with visual feedback
✅ **Automatic Expiry** - Vercel Cron job for automatic reservation release
✅ **Error Handling** - Explicit 409 (conflict) and 410 (expired) responses
✅ **Full-Stack TypeScript** - Type-safe from database to frontend

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, TypeScript
- **Database**: PostgreSQL (Supabase/Neon) + Prisma ORM
- **Concurrency**: PostgreSQL pessimistic locking (SELECT FOR UPDATE)
- **Deployment**: Vercel + Supabase/Neon
- **Validation**: Zod

## Architecture

### Concurrency Safety

The core challenge is preventing two simultaneous requests from reserving the same last unit. This is solved using **PostgreSQL pessimistic locking**:

```typescript
const reservation = await prisma.$transaction(async (tx) => {
  // Lock the stock row - other transactions wait
  const stock = await tx.$queryRaw`
    SELECT * FROM "Stock" WHERE ... FOR UPDATE
  `;
  
  // Check availability with guaranteed consistency
  if (availableUnits < quantity) throw new Error('409');
  
  // Create reservation and update stock atomically
  // No other transaction can interfere between check and update
});
```

**Why this works:**
1. `FOR UPDATE` acquires an exclusive row lock
2. Other transactions are blocked until the lock is released
3. Only one transaction can proceed past the lock at a time
4. Guarantees: If transaction A sees quantity=1, transaction B won't also see quantity=1

### Data Model

```prisma
Stock {
  totalUnits:    100          // Sum of reserved + available
  reservedUnits: 10           // Units in pending/confirmed reservations
  // availableUnits = totalUnits - reservedUnits (calculated, not stored)
}

Reservation {
  status: "pending" | "confirmed" | "released"
  expiresAt: DateTime         // 10 minutes from creation
  confirmedAt: DateTime?      // Only set when status→confirmed
}
```

### Reservation Flow

1. **Reserve** (`POST /api/reservations`)
   - Lock stock row
   - Verify available units ≥ requested quantity
   - Create reservation in `pending` status (expires in 10 min)
   - Increment `reservedUnits` (prevents other customers from seeing this stock)
   - **Returns 409 if insufficient stock**

2. **Confirm** (`POST /api/reservations/:id/confirm`)
   - Verify reservation hasn't expired (else auto-release it)
   - Update reservation status → `confirmed`
   - Decrement `totalUnits` and `reservedUnits` (permanent sale)
   - **Returns 410 if reservation expired**

3. **Release** (`POST /api/reservations/:id/release`)
   - Update reservation status → `released`
   - Decrement `reservedUnits` (makes units available again)
   - No change to `totalUnits` (units return to inventory)

### Expiry Mechanism

**Vercel Cron Job** (runs every minute):
```
GET /api/cron/release-expired?authorization=Bearer SECRET
```

This endpoint:
1. Finds all `pending` reservations where `expiresAt < now`
2. For each expired reservation:
   - Updates status → `released`
   - Restores `reservedUnits`
3. Returns count of released reservations

**Lazy Cleanup Fallback:**
When a user attempts to confirm an expired reservation, the confirm endpoint detects the expiry and auto-releases it before returning 410.

## Local Development

### 1. Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase or Neon recommended for free tier)

### 2. Setup

```bash
# Clone and install
git clone https://github.com/ThameemKing/allo-health.git
cd allo-health
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your database URL
# Example: postgresql://user:password@host:5432/allo_health?schema=public
```

### 3. Database Migration

```bash
# Create tables and indexes
npx prisma migrate dev --name init

# Generate Prisma client
npm run prisma:generate

# Seed with sample data
npm run prisma:seed
```

### 4. Run Locally

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## API Endpoints

### Products

```http
GET /api/products
```

Response:
```json
[
  {
    "id": "cuid",
    "name": "Premium Laptop",
    "sku": "LAPTOP-001",
    "stocks": [
      {
        "id": "cuid",
        "warehouse": { "id": "cuid", "name": "NY Warehouse" },
        "totalUnits": 50,
        "reservedUnits": 5,
        "availableUnits": 45
      }
    ]
  }
]
```

### Warehouses

```http
GET /api/warehouses
```

### Create Reservation

```http
POST /api/reservations
Content-Type: application/json

{
  "productId": "cuid",
  "warehouseId": "cuid",
  "quantity": 2
}
```

Responses:
- **201 Created**: Reservation successful
- **409 Conflict**: Insufficient stock
- **400 Bad Request**: Invalid parameters

### Confirm Reservation

```http
POST /api/reservations/:id/confirm
```

Responses:
- **200 OK**: Confirmed
- **410 Gone**: Reservation expired
- **400 Bad Request**: Invalid status

### Release Reservation

```http
POST /api/reservations/:id/release
```

Responses:
- **200 OK**: Released
- **400 Bad Request**: Invalid status

### Get Reservation

```http
GET /api/reservations/:id
```

## Production Deployment

### Vercel + Supabase Setup

1. **Create Supabase project**
   - Go to https://supabase.com
   - Create new project, copy `DATABASE_URL`

2. **Run migrations on Supabase**
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

3. **Deploy to Vercel**
   - Connect GitHub repo to Vercel
   - Add environment variables:
     - `DATABASE_URL` (from Supabase)
     - `CRON_SECRET` (any random string)
   - Deploy

4. **Set up Cron Job**
   - Create `vercel.json`:
   ```json
   {
     "crons": [{
       "path": "/api/cron/release-expired",
       "schedule": "* * * * *"
     }]
   }
   ```
   - Deploy with `vercel deploy`

## Testing Concurrency

Test race conditions with concurrent requests:

```bash
# Terminal 1
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"productId":"...","warehouseId":"...","quantity":1}'

# Terminal 2 (same time)
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"productId":"...","warehouseId":"...","quantity":1}'
```

**Expected**: Exactly one succeeds (201), one fails (409).

## Trade-offs & Future Improvements

### Trade-offs Made

1. **Pessimistic Locking**: Simple but contention at high scale
   - **Alternative**: Optimistic locking with version numbers
   - **When**: > 10k concurrent users

2. **Lazy Cleanup**: Expiry checked on demand + cron
   - **Alternative**: Redis pub/sub with immediate expiry
   - **Benefit**: No external dependency, works at scale with cron

3. **10-minute Expiry**: Hardcoded for simplicity
   - **Future**: Configurable per product, tenant, or A/B tested

4. **No Idempotency Keys**: Transactions are at-most-once
   - **Bonus Feature**: Could add idempotency header support
   - **Storage**: Idempotency key → (status, response) in database

### Performance Notes

- Lock contention is minimal for realistic workloads (thousands of SKUs)
- Row-level locking scales better than table-level
- Database indexes on `productId_warehouseId` and `expiresAt` are critical
- Vercel Cron runs at 1-minute intervals; faster cleanup requires message queue

### Potential Enhancements

- [ ] Idempotency key support for retry safety
- [ ] Redis for distributed locking (if moving to multiple instances)
- [ ] Batch confirmation endpoint for bulk orders
- [ ] Analytics dashboard for reservation success rates
- [ ] Webhook notifications for reservation expiry
- [ ] Inventory hold reasons ("pending payment", "pending fulfillment", etc.)

## Monitoring

In production, monitor:

1. **Reservation success rate**: `successful_confirms / total_reservations`
2. **Expiry rate**: `auto_released / total_pending`
3. **Lock wait time**: Database query performance
4. **P95 latency**: Ensure < 200ms for reserve endpoint

## License

MIT
