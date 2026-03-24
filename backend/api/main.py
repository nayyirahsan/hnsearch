"""
FastAPI application — exposes search, analytics, and health endpoints.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from query_engine.query import search
from db import get_analytics

app = FastAPI(title="HNSearch API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
def root():
    """Avoid 404 when opening http://localhost:8000/ in a browser; UI runs on the frontend port."""
    ui = os.getenv("FRONTEND_URL", "http://localhost:3000")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>HNSearch API</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 36rem; margin: 3rem auto; padding: 0 1rem; color: #374151; }}
    h1 {{ color: #f97316; font-size: 1.5rem; }}
    a {{ color: #f97316; }}
    p {{ line-height: 1.5; }}
    ul {{ line-height: 1.8; }}
  </style>
</head>
<body>
  <h1>HNSearch API</h1>
  <p>This is the backend. The search UI is served separately.</p>
  <p><a href="{ui}">Open the app →</a></p>
  <p><strong>Endpoints:</strong></p>
  <ul>
    <li><a href="/docs">/docs</a> — interactive API docs</li>
    <li><a href="/health">/health</a> — health check</li>
    <li><a href="/analytics">/analytics</a> — index and usage stats (JSON)</li>
    <li><a href="/search?q=python&limit=10&offset=0">/search?q=python&limit=10&offset=0</a> — sample search (JSON)</li>
  </ul>
</body>
</html>"""


@app.get("/search")
def search_endpoint(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    type: str | None = Query(None, description="Filter by content type: story, comment, ask, show, job"),
    min_score: int | None = Query(None, description="Minimum HN score"),
    date_from: str | None = Query(None, description="Unix timestamp — results after this date"),
    date_to: str | None = Query(None, description="Unix timestamp — results before this date"),
):
    return search(q, limit, offset, type, min_score, date_from, date_to)


@app.get("/analytics")
def analytics_endpoint():
    """Returns index stats and top search queries."""
    return get_analytics()


@app.get("/health")
def health():
    return {"status": "ok"}
