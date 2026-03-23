"""
Database helpers — raw SQL, no ORM magic.
Keeps the data layer explicit and easy to reason about in interviews.
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")


def get_conn():
    # Force SSL regardless of whether DATABASE_URL already contains sslmode.
    return psycopg2.connect(
        DATABASE_URL,
        cursor_factory=RealDictCursor,
        sslmode="require",
    )


def save_item(item: dict):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO documents (id, type, title, text, url, score, by, time)
                VALUES (%(id)s, %(type)s, %(title)s, %(text)s, %(url)s, %(score)s, %(by)s, %(time)s)
                ON CONFLICT (id) DO NOTHING
            """, {
                "id": item.get("id"),
                "type": item.get("type"),
                "title": item.get("title"),
                "text": item.get("text"),
                "url": item.get("url"),
                "score": item.get("score"),
                "by": item.get("by"),
                "time": item.get("time"),
            })


def get_all_documents():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, title, text FROM documents")
            return cur.fetchall()


def get_document_count() -> int:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as count FROM documents")
            return cur.fetchone()["count"]


def save_index_entry(term: str, doc_id: int, score: float):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO inverted_index (term, doc_id, score)
                VALUES (%s, %s, %s)
                ON CONFLICT (term, doc_id) DO UPDATE SET score = EXCLUDED.score
            """, (term, doc_id, score))


def truncate_inverted_index():
    """Full rebuild: clear posting lists before re-indexing."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE inverted_index")


def save_index_entries_bulk(
    rows: list[tuple[str, int, float]],
    *,
    page_size: int = 5000,
) -> None:
    """Batch insert TF-IDF rows (one connection, many rows)."""
    if not rows:
        return
    with get_conn() as conn:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO inverted_index (term, doc_id, score)
                VALUES %s
                ON CONFLICT (term, doc_id) DO UPDATE SET score = EXCLUDED.score
                """,
                rows,
                page_size=page_size,
            )
        conn.commit()


def lookup_term(term: str) -> dict[int, float]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT doc_id, score FROM inverted_index WHERE term = %s",
                (term,)
            )
            return {row["doc_id"]: row["score"] for row in cur.fetchall()}


def fetch_documents_by_ids(
    doc_ids: list[int],
    content_type: str | None = None,
    min_score: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict]:
    if not doc_ids:
        return []
    with get_conn() as conn:
        with conn.cursor() as cur:
            # preserve ranking order from TF-IDF via array position
            query = """
                SELECT d.*
                FROM documents d
                JOIN unnest(%s::int[]) WITH ORDINALITY AS t(id, ord) ON d.id = t.id
                WHERE 1=1
            """
            params: list = [doc_ids]

            if content_type:
                query += " AND d.type = %s"
                params.append(content_type)
            if min_score is not None:
                query += " AND d.score >= %s"
                params.append(min_score)
            if date_from:
                query += " AND d.time >= %s"
                params.append(date_from)
            if date_to:
                query += " AND d.time <= %s"
                params.append(date_to)

            query += " ORDER BY t.ord"
            cur.execute(query, params)
            return [dict(row) for row in cur.fetchall()]


def log_search(query: str, result_count: int, latency_ms: int):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO search_logs (query, result_count, latency_ms)
                VALUES (%s, %s, %s)
            """, (query, result_count, latency_ms))


def get_analytics() -> dict:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as total_docs FROM documents")
            total_docs = cur.fetchone()["total_docs"]

            cur.execute("SELECT COUNT(DISTINCT term) as total_terms FROM inverted_index")
            total_terms = cur.fetchone()["total_terms"]

            cur.execute("""
                SELECT query, COUNT(*) as count
                FROM search_logs
                GROUP BY query
                ORDER BY count DESC
                LIMIT 10
            """)
            top_queries = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT DATE_TRUNC('day', created_at) as day, COUNT(*) as searches
                FROM search_logs
                WHERE created_at > NOW() - INTERVAL '30 days'
                GROUP BY day
                ORDER BY day
            """)
            daily_volume = [dict(r) for r in cur.fetchall()]

            cur.execute("SELECT AVG(latency_ms) as avg_latency FROM search_logs")
            avg_latency = cur.fetchone()["avg_latency"]

            return {
                "total_docs": total_docs,
                "total_terms": total_terms,
                "top_queries": top_queries,
                "daily_volume": daily_volume,
                "avg_latency_ms": round(avg_latency or 0, 1),
            }
