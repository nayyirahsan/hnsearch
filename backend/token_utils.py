"""
Shared token normalization for indexer + query engine.

PostgreSQL btree indexes on TEXT primary keys have a practical row-size limit;
very long alphanumeric "tokens" (e.g. pasted hashes/URLs) must be clipped.
"""
MAX_TERM_CHARS = 200


def stem_word(stemmer, word: str) -> str:
    s = stemmer.stem(word)
    return s[:MAX_TERM_CHARS] if len(s) > MAX_TERM_CHARS else s
