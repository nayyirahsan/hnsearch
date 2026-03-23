"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAnalytics } from "@/lib/api";
import type { AnalyticsData } from "@/lib/types";

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getAnalytics();
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setError("Could not load analytics. Is the backend running?");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const daily = data?.daily_volume ?? [];
  const maxSearches = Math.max(1, ...daily.map((d) => d.searches));

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <Link
            href="/"
            className="inline-block text-sm text-orange-500 hover:text-orange-600 font-medium mb-4 transition-colors"
          >
            ← Back to search
          </Link>
          <h1 className="text-4xl font-bold text-orange-500 tracking-tight mb-2">Analytics</h1>
          <p className="text-gray-400 text-sm">Index stats and search activity</p>
        </div>

        {loading && (
          <p className="text-center text-gray-400 text-sm py-12">Loading analytics…</p>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-500 text-sm text-center">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-10">
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                  Documents indexed
                </p>
                <p className="text-2xl font-semibold text-gray-800 tabular-nums">
                  {data.total_docs.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                  Unique terms
                </p>
                <p className="text-2xl font-semibold text-gray-800 tabular-nums">
                  {data.total_terms.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                  Avg query latency
                </p>
                <p className="text-2xl font-semibold text-gray-800 tabular-nums">
                  {data.avg_latency_ms.toLocaleString()} <span className="text-base font-normal text-gray-500">ms</span>
                </p>
              </div>
            </section>

            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">Top searches</h2>
                <p className="text-xs text-gray-400 mt-0.5">Most common queries (all time)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="text-left py-3 px-5 font-medium text-gray-500">Query</th>
                      <th className="text-right py-3 px-5 font-medium text-gray-500 w-28">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_queries.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-8 px-5 text-center text-gray-400">
                          No search logs yet — run a few searches on the home page.
                        </td>
                      </tr>
                    ) : (
                      data.top_queries.map((row) => (
                        <tr key={row.query} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="py-3 px-5 text-gray-800 font-medium">{row.query}</td>
                          <td className="py-3 px-5 text-right text-gray-600 tabular-nums">
                            {row.count.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Daily search volume</h2>
              <p className="text-xs text-gray-400 mb-6">Searches per day (last 30 days)</p>

              {daily.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No volume data in this window yet.</p>
              ) : (
                <div className="flex h-48 gap-1 sm:gap-1.5 border-b border-gray-200 pb-1">
                  {daily.map((d) => {
                    const pct = (d.searches / maxSearches) * 100;
                    const barPct = d.searches > 0 ? Math.max(pct, 2) : 0;
                    return (
                      <div
                        key={d.day}
                        className="flex flex-1 flex-col justify-end min-w-0 min-h-0"
                        title={`${formatDay(d.day)}: ${d.searches} searches`}
                      >
                        <div
                          className="w-full max-w-[32px] mx-auto rounded-t-md bg-orange-400 hover:bg-orange-500 transition-colors"
                          style={{ height: `${barPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {daily.length > 0 && (
                <div className="flex gap-1 sm:gap-1.5 mt-2 overflow-x-auto pb-1">
                  {daily.map((d) => (
                    <div
                      key={`label-${d.day}`}
                      className="flex-1 min-w-0 text-center text-[10px] sm:text-xs text-gray-400 truncate"
                    >
                      {formatDay(d.day)}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
