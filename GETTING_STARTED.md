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

## 5. Start the API

```bash
uvicorn api.main:app --reload
# API running at http://localhost:8000
# Docs at http://localhost:8000/docs
```

## 6. Frontend setup

```bash
cd ../frontend
npm install

cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# App running at http://localhost:3000
```

## Project structure

```
hnsearch/
├── backend/
│   ├── crawler/hn_crawler.py      ← fetches items from HN Firebase API
│   ├── indexer/indexer.py         ← builds inverted index + TF-IDF scores
│   ├── query_engine/query.py      ← AND/OR search, ranking, filters
│   ├── api/main.py                ← FastAPI: /search, /analytics, /health
│   ├── db.py                      ← all database helpers (raw SQL)
│   ├── migrations/001_initial.sql ← schema: documents, inverted_index, search_logs
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx           ← main search UI
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

- **Backend**: [Railway](https://railway.app) — connect your GitHub repo, add `DATABASE_URL` env var, set start command to `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
- **Frontend**: [Vercel](https://vercel.com) — import repo, set `NEXT_PUBLIC_API_URL` to your Railway backend URL
