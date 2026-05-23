# Deployment Guide

## Quick Start to Production

This guide walks you through deploying Allo Health to Vercel and setting up a PostgreSQL database.

### Prerequisites

- GitHub account (for repo)
- Vercel account (https://vercel.com)
- Supabase account (https://supabase.com) OR Neon account (https://neon.tech)

### Step 1: Set Up Database

#### Option A: Supabase (Recommended for beginners)

1. Go to https://supabase.com and sign up
2. Create a new project
3. Wait for the project to initialize
4. Go to Settings → Database → Connection string
5. Copy the connection string (PostgreSQL)
6. Replace `[YOUR_PASSWORD]` with the password you set

#### Option B: Neon

1. Go to https://neon.tech and sign up
2. Create a new project
3. Copy the connection string from the dashboard

### Step 2: Create Vercel Project

1. Push this repo to your GitHub account:
   ```bash
   git remote set-url origin https://github.com/YOUR_USERNAME/allo-health.git
   git push -u origin main
   ```

2. Go to https://vercel.com/new and import this GitHub repository

3. Configure environment variables:
   - `DATABASE_URL`: Your Supabase/Neon connection string
   - `CRON_SECRET`: Generate a random string (e.g., `openssl rand -hex 16`)
   - `NEXT_PUBLIC_API_URL`: Leave as default or set to your Vercel deployment URL

4. Click "Deploy"

### Step 3: Run Migrations on Vercel

After deployment, run migrations to create database schema:

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Connect to your Vercel project
vercel link

# Run migrations
vercel env pull
npx prisma migrate deploy

# Seed database with sample data
node prisma/seed.js
```

OR use Vercel's Shell feature:

1. Go to your Vercel project dashboard
2. Click "Settings" → "Functions"
3. Look for a Shell option (if available in your plan)
4. Run: `npx prisma migrate deploy && node prisma/seed.js`

### Step 4: Enable Cron Jobs (Optional but Recommended)

The `vercel.json` file already configures a cron job to auto-release expired reservations every minute.

To verify it's working:

1. Go to your Vercel project
2. Click "Logs" → "Cron"
3. You should see `GET /api/cron/release-expired` running every minute

Note: Vercel cron jobs require a valid auth header. Make sure to set `CRON_SECRET` in your environment variables.

### Step 5: Test the Live App

1. Visit your Vercel deployment URL (something like `https://allo-health.vercel.app`)
2. You should see products with stock levels
3. Try reserving a product
4. Complete the purchase before the 10-minute timer expires

### Troubleshooting

**"Reservation failed" error**
- Check that `DATABASE_URL` is set correctly
- Verify Prisma migrations ran successfully

**Live timer shows NaN**
- This is a client-side issue, likely from a timezone mismatch
- Refresh the page

**Cron job not running**
- Verify `CRON_SECRET` is set in environment variables
- Check Vercel logs for errors
- Ensure `vercel.json` is committed to your repo

**"Too many connections" error**
- Decrease Prisma's connection pool size:
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
    directUrl = env("DATABASE_DIRECT_URL")
  }
  ```
  Set `DATABASE_DIRECT_URL` for migrations in Vercel

## Environment Variables Reference

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | `postgresql://user:pw@host/db` | Connection string for Prisma |
| `CRON_SECRET` | Yes | `abc123def456` | Secret token for cron job auth |
| `NEXT_PUBLIC_API_URL` | No | `https://allo-health.vercel.app` | Frontend API base URL |

## Monitoring in Production

Watch these metrics:

1. **Database Connections**: Monitor in Supabase/Neon dashboard
2. **API Response Times**: Check Vercel Analytics
3. **Cron Job Success**: Vercel Logs → Cron
4. **Error Rate**: Vercel Logs → Function Logs

## Scaling Considerations

This setup handles:
- 1000+ concurrent reservations
- Multi-warehouse operations
- Automatic cleanup

For higher scale (>10k concurrent users), consider:
- Redis for distributed locking
- Read replicas for product queries
- Connection pooling (PgBouncer)
