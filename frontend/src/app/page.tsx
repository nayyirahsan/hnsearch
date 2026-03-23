"use client";
import { useState, useCallback } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import ResultCard from "@/components/ResultCard";
import Filters from "@/components/Filters";
import { search } from "@/lib/api";
import type { SearchResult, Filters as FiltersType } from "@/lib/types";

export default function Home() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FiltersType>({});
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (q: string, f: FiltersType = filters) => {
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const data = await search(q, f);
      setResults(data.results);
      setTotal(data.total);
      setLatency(data.latency_ms);
    } catch {
      setError("Search failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleFilterChange = (f: FiltersType) => {
    setFilters(f);
    if (query) handleSearch(query, f);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-5xl font-bold text-orange-500 tracking-tight">HNSearch</h1>
            <Link
              href="/analytics"
              className="text-sm font-medium text-gray-400 hover:text-orange-500 transition-colors self-end pb-1"
            >
              Analytics
            </Link>
          </div>
          <p className="text-gray-400 text-sm">Search 100,000+ Hacker News posts · built from scratch</p>
        </div>

        <SearchBar onSearch={handleSearch} />
        <Filters filters={filters} onChange={handleFilterChange} />

        {/* Status line */}
        {hasSearched && !loading && !error && (
          <p className="text-xs text-gray-400 mt-3">
            {total.toLocaleString()} results
            {latency != null && <span> · {latency}ms</span>}
          </p>
        )}

        {/* States */}
        {loading && (
          <div className="text-center mt-16 text-gray-400 text-sm">Searching...</div>
        )}

        {error && (
          <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-xl text-red-500 text-sm text-center">
            {error}
          </div>
        )}

        {!loading && !error && hasSearched && results.length === 0 && (
          <div className="text-center mt-16 text-gray-400 text-sm">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <div className="mt-6 space-y-3">
            {results.map((r) => (
              <ResultCard key={r.id} result={r} query={query} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!hasSearched && (
          <div className="mt-20 text-center text-gray-300 text-sm">
            Try: <span className="text-gray-400 cursor-pointer hover:text-orange-400 transition" onClick={() => handleSearch("rust programming")}>rust programming</span>
            {" · "}
            <span className="text-gray-400 cursor-pointer hover:text-orange-400 transition" onClick={() => handleSearch("machine learning")}>machine learning</span>
            {" · "}
            <span className="text-gray-400 cursor-pointer hover:text-orange-400 transition" onClick={() => handleSearch("ask hn")}>ask hn</span>
          </div>
        )}
      </div>
    </main>
  );
}
