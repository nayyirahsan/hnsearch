import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";

type SearchLogRow = {
  query: string | null;
  latency_ms: number | null;
  created_at: string | null;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Analytics failed";
  }
}

async function countDocuments(supabase: ReturnType<typeof getSupabase>): Promise<number> {
  const { count, error } = await supabase.from("documents").select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function countUniqueTerms(supabase: ReturnType<typeof getSupabase>): Promise<number> {
  const pageSize = 10000;
  let from = 0;
  const terms = new Set<string>();

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("inverted_index")
      .select("term")
      .order("term", { ascending: true })
      .range(from, to);

    if (error) throw error;
    const rows = (data ?? []) as { term: string | null }[];
    for (const row of rows) {
      if (row.term) terms.add(row.term);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return terms.size;
}

async function fetchSearchLogs(supabase: ReturnType<typeof getSupabase>, days: number): Promise<SearchLogRow[]> {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);

  const pageSize = 5000;
  let from = 0;
  const allRows: SearchLogRow[] = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("search_logs")
      .select("query,latency_ms,created_at")
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) throw error;
    const rows = (data ?? []) as SearchLogRow[];
    allRows.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const [totalDocs, totalTerms, logs] = await Promise.all([
      countDocuments(supabase),
      countUniqueTerms(supabase),
      fetchSearchLogs(supabase, 30),
    ]);

    const topQueryCounts = new Map<string, number>();
    const dailyCounts = new Map<string, number>();
    let latencyTotal = 0;
    let latencyRows = 0;

    for (const row of logs) {
      if (row.query) {
        topQueryCounts.set(row.query, (topQueryCounts.get(row.query) ?? 0) + 1);
      }
      if (row.created_at) {
        const day = `${row.created_at.slice(0, 10)}T00:00:00.000Z`;
        dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
      }
      if (row.latency_ms != null) {
        latencyTotal += row.latency_ms;
        latencyRows += 1;
      }
    }

    const topQueries = [...topQueryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    const dailyVolume = [...dailyCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, searches]) => ({ day, searches }));

    const avgLatencyMs = latencyRows ? Math.round((latencyTotal / latencyRows) * 10) / 10 : 0;

    return NextResponse.json({
      total_docs: totalDocs,
      total_terms: totalTerms,
      top_queries: topQueries,
      daily_volume: dailyVolume,
      avg_latency_ms: avgLatencyMs,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
