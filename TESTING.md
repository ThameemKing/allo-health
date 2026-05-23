# Concurrency Testing Guide

This document explains how to test the race condition protection in Allo Health's reservation system.

## What We're Testing

The core requirement: **If two customers try to reserve the last unit simultaneously, exactly one succeeds and one gets a 409 (Conflict) error.**

## Prerequisites

1. App running locally: `npm run dev`
2. Database seeded with products
3. One product with exactly 1 unit available in a warehouse

### Setup Test Product

Create a test product with 1 unit:

```bash
# Connect to your database
psql $DATABASE_URL

-- Find a product
SELECT id, name FROM "Product" LIMIT 1;  -- Note the ID

-- Find a warehouse  
SELECT id, name FROM "Warehouse" LIMIT 1;  -- Note the ID

-- Set stock to exactly 1 unit
UPDATE "Stock" 
SET "totalUnits" = 1, "reservedUnits" = 0
WHERE "productId" = 'YOUR_PRODUCT_ID' 
  AND "warehouseId" = 'YOUR_WAREHOUSE_ID';
```

## Test Method 1: Bash Script (Recommended)

### Race Condition Test

Create `test-race-condition.sh`:

```bash
#!/bin/bash

# Configuration
API_URL="http://localhost:3000"
PRODUCT_ID="YOUR_PRODUCT_ID"     # Replace with actual ID
WAREHOUSE_ID="YOUR_WAREHOUSE_ID" # Replace with actual ID

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Starting race condition test..."
echo "Reserving last unit with 2 concurrent requests"

# Send two requests simultaneously
curl -X POST $API_URL/api/reservations \
  -H "Content-Type: application/json" \
  -d "{\"productId\":\"$PRODUCT_ID\",\"warehouseId\":\"$WAREHOUSE_ID\",\"quantity\":1}" \
  -w "\nRequest 1 - Status: %{http_code}\n" &

# Small delay to simulate concurrent requests
sleep 0.1

curl -X POST $API_URL/api/reservations \
  -H "Content-Type: application/json" \
  -d "{\"productId\":\"$PRODUCT_ID\",\"warehouseId\":\"$WAREHOUSE_ID\",\"quantity\":1}" \
  -w "\nRequest 2 - Status: %{http_code}\n" &

# Wait for both requests to complete
wait

echo ""
echo "Expected results:"
echo -e "${GREEN}✓ One request: 201 Created${NC}"
echo -e "${GREEN}✓ Other request: 409 Conflict${NC}"
echo ""
echo "If both succeeded or both failed, the race condition is NOT protected."
```

Run the test:

```bash
chmod +x test-race-condition.sh
./test-race-condition.sh
```

## Test Method 2: Python Script (More Reliable)

Create `test_concurrency.py`:

```python
import requests
import concurrent.futures
import time

API_URL = "http://localhost:3000"
PRODUCT_ID = "YOUR_PRODUCT_ID"
WAREHOUSE_ID = "YOUR_WAREHOUSE_ID"

def make_reservation():
    """Make a single reservation request."""
    try:
        response = requests.post(
            f"{API_URL}/api/reservations",
            json={
                "productId": PRODUCT_ID,
                "warehouseId": WAREHOUSE_ID,
                "quantity": 1,
            },
            timeout=10,
        )
        return {
            "status": response.status_code,
            "body": response.json(),
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

def test_race_condition(num_requests=10):
    """Test race condition with concurrent requests."""
    print(f"\n{'='*60}")
    print(f"Testing race condition with {num_requests} concurrent requests")
    print(f"Target: 1 success (201), {num_requests - 1} failures (409)")
    print(f"{'='*60}\n")
    
    results = {}
    
    # Make requests concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_requests) as executor:
        futures = [executor.submit(make_reservation) for _ in range(num_requests)]
        
        for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
            result = future.result()
            status = result.get("status")
            
            if status not in results:
                results[status] = 0
            results[status] += 1
            
            if status == 201:
                print(f"✓ Request {i}: {status} CREATED (Got reservation!)")
            elif status == 409:
                print(f"✗ Request {i}: {status} CONFLICT (Insufficient stock - expected)")
            else:
                print(f"? Request {i}: {status} ERROR (Unexpected)")
    
    print(f"\n{'='*60}")
    print("RESULTS:")
    print(f"{'='*60}")
    
    for status, count in sorted(results.items()):
        print(f"{status}: {count} request(s)")
    
    # Verify results
    if results.get(201) == 1 and results.get(409) == num_requests - 1:
        print(f"\n✓ PASS: Race condition is protected!")
        print(f"  Exactly 1 reservation succeeded, {num_requests - 1} were rejected.")
        return True
    else:
        print(f"\n✗ FAIL: Race condition not protected!")
        if results.get(201, 0) > 1:
            print(f"  ERROR: {results.get(201)} requests were accepted (should be 1)")
        if results.get(409, 0) == 0:
            print(f"  ERROR: No requests were rejected with 409")
        return False

if __name__ == "__main__":
    print("\nAllo Health - Concurrency Test Suite")
    print("\nMake sure:")
    print("1. App is running: npm run dev")
    print("2. Database has exactly 1 unit of test product")
    print(f"3. Product ID: {PRODUCT_ID}")
    print(f"4. Warehouse ID: {WAREHOUSE_ID}")
    
    input("\nPress Enter to start testing...\n")
    
    # Test with 10 concurrent requests
    success = test_race_condition(num_requests=10)
    
    # Test multiple times
    print(f"\n{'='*60}")
    print("Running 5 iterations to ensure consistency...")
    print(f"{'='*60}\n")
    
    all_passed = True
    for iteration in range(1, 6):
        print(f"\nIteration {iteration}/5:")
        print("-" * 60)
        
        # Reset stock
        print("Resetting stock to 1 unit...")
        # Note: You might need to add a reset endpoint or do this manually
        
        if not test_race_condition(num_requests=5):
            all_passed = False
    
    print(f"\n\n{'='*60}")
    if all_passed:
        print("✓ ALL TESTS PASSED!")
        print("Race condition protection is working correctly.")
    else:
        print("✗ SOME TESTS FAILED!")
        print("Race condition protection may have issues.")
    print(f"{'='*60}\n")
```

Run the test:

```bash
pip install requests
python test_concurrency.py
```

## Test Method 3: Artillery Load Testing (Advanced)

Create `load-test.yml`:

```yaml
config:
  target: http://localhost:3000
  phases:
    - duration: 10
      arrivalRate: 50
      ramp: 200

scenarios:
  - name: Concurrent Reservations
    flow:
      - post:
          url: /api/reservations
          json:
            productId: YOUR_PRODUCT_ID
            warehouseId: YOUR_WAREHOUSE_ID
            quantity: 1
          capture:
            - json: $.id
              as: reservation_id
          expect:
            - statusCode: [201, 409]
```

Run:

```bash
npm install -g artillery
artillery run load-test.yml
```

## Manual Browser Testing

### Step 1: Open Two Browser Tabs

Tab 1: http://localhost:3000
Tab 2: http://localhost:3000

### Step 2: Ensure 1 Unit Available

Both tabs should show the same product with 1 available unit.

### Step 3: Click Reserve (Nearly Simultaneously)

1. Click "Reserve" on Tab 1
2. Immediately click "Reserve" on Tab 2 (within 1-2 seconds)

### Step 4: Expected Outcome

- **Tab 1**: Success → "Reservation Created" → Countdown timer
- **Tab 2**: Error → "409: Not enough stock available"

If both show success, the race condition is NOT protected.

## What to Look For

### ✓ Correct Behavior

```
[1] 201 Created - Reservation ID: abc123
[2] 409 Conflict - "Insufficient stock available"
```

### ✗ Race Condition (Bug)

```
[1] 201 Created - Reservation ID: abc123
[2] 201 Created - Reservation ID: def456  ← WRONG! Should be 409
```

## Debugging Failed Tests

### Check Database Directly

```sql
-- See current stock
SELECT * FROM "Stock" 
WHERE "productId" = 'YOUR_PRODUCT_ID' 
AND "warehouseId" = 'YOUR_WAREHOUSE_ID';

-- See all reservations for this product
SELECT id, status, "quantity", "expiresAt" 
FROM "Reservation"
WHERE "productId" = 'YOUR_PRODUCT_ID'
ORDER BY "createdAt" DESC
LIMIT 10;
```

### Enable Database Logging

In `src/lib/prisma.ts`, change:

```typescript
const prisma = new PrismaClient({
  log: ['query'], // Add query logging
});
```

Then check your terminal for SQL queries:

```
Prisma Client:0 Starting transaction
Prisma Client:1 SELECT ... FOR UPDATE
Prisma Client:2 ... (query execution)
```

## Performance Baseline

After testing, measure:

| Metric | Target | Actual |
|--------|--------|--------|
| Single reservation latency | < 100ms | __ |
| Success rate under 50 req/s | > 99.9% | __ |
| 409 error rate | 1-5% | __ |
| p95 latency | < 200ms | __ |

## Troubleshooting

### "All requests are getting 409"

- Check stock level: `SELECT "totalUnits", "reservedUnits" FROM "Stock"...`
- Maybe stock is already reserved from a previous test
- Run seed again: `npm run prisma:seed`

### "Some requests are timing out"

- Database may be slow
- Check Prisma connection pool
- Reduce concurrent requests

### "I keep getting different results"

- Reset stock between tests
- Ensure no other processes are making requests
- Stop background cron jobs (disable `vercel.json` temporarily)

## Success Criteria

✓ **Passed**: 10+ consecutive tests with exactly 1 success per test
✓ **Failed**: Any test with 0 or 2+ successes

## Next Steps

After confirming race condition protection:

1. Test 409 error handling in frontend
2. Test 410 (expired) error handling
3. Test concurrent confirm/release operations
4. Run load test with 100+ concurrent users
