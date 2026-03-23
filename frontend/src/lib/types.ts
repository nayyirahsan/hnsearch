export interface SearchResult {
  id: number;
  type: string;
  title?: string;
  text?: string;
  url?: string;
  score?: number;
  by: string;
  time: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query_tokens: string[];
  latency_ms: number;
}

export interface Filters {
  type?: string;
  minScore?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface AnalyticsData {
  total_docs: number;
  total_terms: number;
  avg_latency_ms: number;
  top_queries: { query: string; count: number }[];
  daily_volume: { day: string; searches: number }[];
}
