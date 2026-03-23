# Deployment Guide

This guide covers production deployment of HNSearch using:
- **Supabase** for PostgreSQL
- **Render** for the FastAPI backend
- **Vercel** for the Next.js frontend
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

## 3) Deploy backend to Render

1. Push your code to GitHub.
2. In [Render](https://render.com/), create a new **Web Service** from your repo.
3. Configure:
   - **Root Directory**: `backend` (if prompted)
   - **Runtime**: Python
   - **Build Command**:
     - `pip install -r requirements.txt && python -c "import nltk; nltk.download('stopwords')"`
   - **Start Command**:
     - `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables in Render:
   - `DATABASE_URL` = your Supabase connection URI
   - `FRONTEND_URL` = `http://localhost:3000` (temporary; update in step 5)
5. Deploy and verify:
   - `https://<your-render-service>.onrender.com/health` returns `{"status":"ok"}`

## 4) Deploy frontend to Vercel

1. In [Vercel](https://vercel.com/), import the same repo.
2. Set **Root Directory** to `frontend` if needed.
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://<your-render-service>.onrender.com`
4. Deploy.
5. Verify:
   - Home page loads
   - Search works
   - Analytics page loads (`/analytics`)

## 5) Update FRONTEND_URL in Render after Vercel is live

1. Copy your Vercel production URL (for example `https://your-app.vercel.app`).
2. In Render backend service settings, update:
   - `FRONTEND_URL` = your Vercel URL
3. Redeploy/restart the Render service.
4. Confirm CORS works by running a search from the Vercel-hosted frontend.

## 6) UptimeRobot health checks every 14 minutes

1. Create a monitor in [UptimeRobot](https://uptimerobot.com/):
   - **Monitor Type**: HTTP(s)
   - **URL**: `https://<your-render-service>.onrender.com/health`
   - **Monitoring Interval**: 14 minutes
2. Save the monitor.
3. Verify status becomes **Up**.

This keeps the backend endpoint actively checked and helps detect downtime quickly.
