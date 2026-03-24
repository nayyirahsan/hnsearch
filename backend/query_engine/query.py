"""
Query engine: tokenizes a search string, looks up the inverted index,
aggregates TF-IDF scores, applies filters, and returns ranked results.

Query semantics:
  - Multi-term AND (intersection of posting lists)
  - OR fallback when AND yields no results
  - Filters: content type, min HN score, date range
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nltk.stem import PorterStemmer
from nltk.corpus import stopwords
from db import lookup_term, fetch_documents_by_ids, log_search
from token_utils import stem_word

stemmer = PorterStemmer()
STOP_WORDS = set(stopwords.words("english"))


def tokenize_query(query: str) -> list[str]:
    query = query.lower()
    query = "".join(c if c.isalnum() or c.isspace() else " " for c in query)
    tokens = query.split()
    return [stem_word(stemmer, t) for t in tokens if t not in STOP_WORDS and len(t) > 1]


def search(
    query: str,
    limit: int = 20,
    offset: int = 0,
    content_type: str | None = None,
    min_score: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    import time
    start = time.monotonic()

    tokens = tokenize_query(query)
    if not tokens:
        return {"results": [], "total": 0, "query_tokens": []}

    # fetch posting lists for each token
    term_postings: list[dict[int, float]] = [lookup_term(token) for token in tokens]

    # AND: intersect all posting lists
    doc_scores: dict[int, float] = {}
    if term_postings:
        common_ids = set(term_postings[0].keys())
        for postings in term_postings[1:]:
            common_ids &= set(postings.keys())

        for doc_id in common_ids:
            doc_scores[doc_id] = sum(p.get(doc_id, 0) for p in term_postings)

    # OR fallback: union all posting lists
    if not doc_scores:
        for postings in term_postings:
            for doc_id, score in postings.items():
                doc_scores[doc_id] = doc_scores.get(doc_id, 0) + score

    # rank descending by score
    ranked_ids = [doc_id for doc_id, _ in sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)]

    # fetch full docs and apply filters
    documents = fetch_documents_by_ids(ranked_ids, content_type, min_score, date_from, date_to)
    total = len(documents)
    paginated = documents[offset: offset + limit]

    latency_ms = int((time.monotonic() - start) * 1000)
    log_search(query, total, latency_ms)

    return {
        "results": paginated,
        "total": total,
        "query_tokens": tokens,
        "latency_ms": latency_ms,
    }
