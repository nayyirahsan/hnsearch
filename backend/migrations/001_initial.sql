-- 001_initial.sql
-- Run this once against your PostgreSQL database before crawling.

CREATE TABLE IF NOT EXISTS documents (
    id      INTEGER PRIMARY KEY,
    type    TEXT,
    title   TEXT,
    text    TEXT,
    url     TEXT,
    score   INTEGER,
    by      TEXT,
    time    BIGINT
);

-- Inverted index: one row per (term, document) pair
CREATE TABLE IF NOT EXISTS inverted_index (
    term    TEXT,
    doc_id  INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    score   FLOAT NOT NULL,
    PRIMARY KEY (term, doc_id)
);

-- Critical: fast term lookups are the hot path for every query
CREATE INDEX IF NOT EXISTS idx_inverted_index_term ON inverted_index(term);

-- Search logs for the analytics dashboard
CREATE TABLE IF NOT EXISTS search_logs (
    id           SERIAL PRIMARY KEY,
    query        TEXT NOT NULL,
    result_count INTEGER,
    latency_ms   INTEGER,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);
