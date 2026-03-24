import type { Filters, SearchResponse, AnalyticsData } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function search(
  query: string,
  filters: Filters = {},
  limit = 20,
  offset = 0
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) });
  if (filters.type) params.set("type", filters.type);
  if (filters.minScore) params.set("min_score", String(filters.minScore));
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);

  const r = await fetch(`${API}/search?${params}`);
  if (!r.ok) throw new Error("Search request failed");
  return r.json();
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const r = await fetch(`${API}/analytics`);
  if (!r.ok) throw new Error("Analytics request failed");
  return r.json();
}
