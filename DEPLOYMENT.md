# Deployment Guide

This guide covers production deployment of HNSearch using:
- **Supabase** for PostgreSQL
- **Vercel** for both UI + API routes
- **UptimeRobot** for health monitoring

## 1) Supabase database setup + migration

1. Create a new project in [Supabase](https://supabase.com/).
2. In Supabase, open **Project Settings -> Database**.
3. Copy the **Connection string** (URI format). It should look like:
   - `postgresql://postgres:<password>@<host>:5432/postgres?sslmode=require`
4. Open Supabase **SQL Editor** and run the migration SQL from:
   - `backend/migrations/001_initial.sql`
5. Confirm these tables exist:
   - `documents`
   - `inverted_index`
   - `search_logs`

## 2) Run crawler + indexer locally against Supabase

1. In `backend/`, create/update `.env`:

```env
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres?sslmode=require
FRONTEND_URL=http://localhost:3000
HN_API_BASE=https://hacker-news.firebaseio.com/v0
```

2. Set up Python env and deps:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -c "import nltk; nltk.download('stopwords')"
```

3. Run crawler (start with smaller limit if needed):

```bash
python crawler/hn_crawler.py
```

4. Build search index:

```bash
python indexer/indexer.py
```

5. Optional sanity checks:
   - `SELECT COUNT(*) FROM documents;`
   - `SELECT COUNT(*) FROM inverted_index;`

## 3) Deploy frontend + API routes to Vercel

1. In [Vercel](https://vercel.com/), import the same repo.
2. Set **Root Directory** to `frontend` if needed.
3. Add environment variables:
   - `SUPABASE_URL` = your Supabase project URL (`https://<project-ref>.supabase.co`)
   - `SUPABASE_ANON_KEY` = your Supabase anon key
   - Optional: `NEXT_PUBLIC_API_URL` (leave empty to use same-origin `/api/*` routes)
4. Deploy.
5. Verify:
   - Home page loads
   - Search works
   - Analytics page loads (`/analytics`)
   - API routes respond:
     - `https://<your-vercel-app>.vercel.app/api/search?q=python`
     - `https://<your-vercel-app>.vercel.app/api/analytics`

## 4) Data refresh workflow (local)

1. Keep using local Python scripts to refresh data in Supabase:
   - `python backend/crawler/hn_crawler.py`
   - `python backend/indexer/indexer.py`
2. Because Vercel API routes read Supabase directly, new data is live immediately after index updates.

## 5) UptimeRobot health checks every 14 minutes

1. Create a monitor in [UptimeRobot](https://uptimerobot.com/):
   - **Monitor Type**: HTTP(s)
   - **URL**: `https://<your-vercel-app>.vercel.app/api/analytics`
   - **Monitoring Interval**: 14 minutes
2. Save the monitor.
3. Verify status becomes **Up**.

This keeps the backend endpoint actively checked and helps detect downtime quickly.
