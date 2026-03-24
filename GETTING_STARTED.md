# Getting Started

## Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ running locally

## 1. Database setup

```bash
createdb hnsearch
psql hnsearch < backend/migrations/001_initial.sql
```

## 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Download NLTK data (one-time)
python -c "import nltk; nltk.download('stopwords')"

# Configure environment
cp .env.example .env
# Edit .env and set DATABASE_URL=postgresql://user:password@localhost:5432/hnsearch
```

## 3. Crawl HN data

```bash
# From backend/ with venv active
python crawler/hn_crawler.py
# This pulls ~100k items from the HN Firebase API. Takes 10-20 minutes.
# Reduce the limit for faster testing: edit crawl(limit=5000) in the file
```

## 4. Build the index

```bash
python indexer/indexer.py
# Tokenizes all documents and builds the inverted index with TF-IDF scores.
# Takes ~5-10 minutes for 100k documents.
```

## 5. Frontend + API (Next.js) setup

```bash
cd ../frontend
npm install

cp .env.example .env.local
# Add Supabase credentials for Next.js API routes:
# SUPABASE_URL=https://<project-ref>.supabase.co
# SUPABASE_ANON_KEY=<your-anon-key>
#
# Optional:
# NEXT_PUBLIC_API_URL= (leave empty for same-origin /api routes)

npm run dev
# App running at http://localhost:3000
# API routes at:
# - http://localhost:3000/api/search?q=python
# - http://localhost:3000/api/analytics
```

## Project structure

```
hnsearch/
├── backend/
│   ├── crawler/hn_crawler.py      ← fetches items from HN Firebase API
│   ├── indexer/indexer.py         ← builds inverted index + TF-IDF scores
│   ├── query_engine/query.py      ← legacy Python search logic reference
│   ├── api/main.py                ← legacy FastAPI app (no longer required for Vercel deploy)
│   ├── db.py                      ← all database helpers (raw SQL)
│   ├── migrations/001_initial.sql ← schema: documents, inverted_index, search_logs
│   └── requirements.txt
└── frontend/
    ├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── search/route.ts    ← Next.js API search endpoint
│   │   │   └── analytics/route.ts ← Next.js API analytics endpoint
│   │   ├── layout.tsx
│   │   ├── page.tsx               ← main search UI
│   │   └── globals.css
    │   ├── components/
    │   │   ├── SearchBar.tsx      ← debounced live search
    │   │   ├── ResultCard.tsx     ← result with highlighting
    │   │   └── Filters.tsx        ← type filter pills
    │   └── lib/
    │       ├── api.ts             ← fetch wrappers
    │       └── types.ts           ← shared TypeScript types
    ├── tailwind.config.js
    ├── tsconfig.json
    └── package.json
```

## Deployment

- **App + API**: [Vercel](https://vercel.com) — deploy `frontend/` and set `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- **Data pipeline**: run `backend/crawler/hn_crawler.py` and `backend/indexer/indexer.py` locally against Supabase when you want to refresh data
