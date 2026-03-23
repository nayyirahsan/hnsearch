"""
Builds an inverted index with TF-IDF scores over crawled HN documents.

Pipeline:
  raw document → tokenize → remove stopwords → stem → compute TF-IDF → store index

TF-IDF:
  TF(t, d)  = occurrences of t in d / total tokens in d
  IDF(t)    = log(N / df(t))   where N = total docs, df = docs containing t
  score     = TF * IDF

Title tokens are weighted 2x over body tokens.
"""
import math
import logging
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from collections import defaultdict
from nltk.stem import PorterStemmer
from nltk.corpus import stopwords
from db import (
    get_all_documents,
    get_document_count,
    save_index_entries_bulk,
    truncate_inverted_index,
)
from token_utils import stem_word

logger = logging.getLogger(__name__)
stemmer = PorterStemmer()
STOP_WORDS = set(stopwords.words("english"))
TITLE_WEIGHT = 2  # title tokens repeated 2x to boost score


def tokenize(text: str) -> list[str]:
    """Lowercase, strip punctuation, remove stopwords, stem."""
    if not text:
        return []
    text = text.lower()
    text = "".join(c if c.isalnum() or c.isspace() else " " for c in text)
    tokens = text.split()
    return [stem_word(stemmer, t) for t in tokens if t not in STOP_WORDS and len(t) > 1]


def build_index():
    """
    Reads all documents from the DB, builds an inverted index,
    computes TF-IDF scores, and writes entries back to the DB.
    """
    truncate_inverted_index()
    documents = get_all_documents()
    total_docs = get_document_count()
    logger.info(f"Building index over {total_docs} documents...")

    # term -> {doc_id: raw_tf}
    index: dict[str, dict[int, float]] = defaultdict(dict)

    for doc in documents:
        doc_id = doc["id"]

        # weight title tokens more heavily by repeating them
        title_tokens = tokenize(doc.get("title") or "") * TITLE_WEIGHT
        body_tokens = tokenize(doc.get("text") or "")
        all_tokens = title_tokens + body_tokens

        if not all_tokens:
            continue

        term_counts: dict[str, int] = defaultdict(int)
        for token in all_tokens:
            term_counts[token] += 1

        for term, count in term_counts.items():
            tf = count / len(all_tokens)
            index[term][doc_id] = tf

    logger.info(f"Vocabulary size: {len(index)} unique terms. Writing to DB...")

    batch: list[tuple[str, int, float]] = []
    batch_size = 8000

    for term, doc_tfs in index.items():
        df = len(doc_tfs)
        idf = math.log((total_docs + 1) / (df + 1))  # smoothed to avoid div-by-zero
        for doc_id, tf in doc_tfs.items():
            tfidf = tf * idf
            batch.append((term, doc_id, tfidf))
            if len(batch) >= batch_size:
                save_index_entries_bulk(batch)
                batch.clear()

    if batch:
        save_index_entries_bulk(batch)

    logger.info("Index build complete.")


if __name__ == "__main__":
    import ssl
    import nltk

    # macOS / some envs: SSL cert issues when downloading NLTK data
    ssl._create_default_https_context = ssl._create_unverified_context
    nltk.download("stopwords", quiet=True)

    logging.basicConfig(level=logging.INFO)
    build_index()
