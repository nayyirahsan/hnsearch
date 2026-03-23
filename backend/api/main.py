"""
FastAPI application — exposes search, analytics, and health endpoints.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from query_engine.query import search
from db import get_analytics

app = FastAPI(title="HNSearch API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["GET"],
    allow_headers=["*"],
)


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
