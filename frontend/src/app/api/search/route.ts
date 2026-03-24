import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseServer";
import { tokenizeAndStem } from "@/lib/nlp";

type Posting = { doc_id: number; score: number };
type SearchDoc = {
  id: number;
  type: string;
  title: string | null;
  text: string | null;
  url: string | null;
  score: number | null;
  by: string | null;
  time: number;
};

function toInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchPostings(term: string, supabase: ReturnType<typeof getSupabase>): Promise<Map<number, number>> {
  const { data, error } = await supabase
    .from("inverted_index")
    .select("doc_id,score")
    .eq("term", term);

  if (error) throw error;
  const postings = (data ?? []) as Posting[];
  return new Map(postings.map((p) => [p.doc_id, p.score]));
}

async function fetchFilteredDocuments(
  supabase: ReturnType<typeof getSupabase>,
  rankedIds: number[],
  contentType: string | null,
  minScore: number | null,
  dateFrom: number | null,
  dateTo: number | null
): Promise<SearchDoc[]> {
  if (!rankedIds.length) return [];

  const chunkSize = 1000;
  const docs: SearchDoc[] = [];

  for (let i = 0; i < rankedIds.length; i += chunkSize) {
    const chunk = rankedIds.slice(i, i + chunkSize);

    let query = supabase.from("documents").select("*").in("id", chunk);
    if (contentType) query = query.eq("type", contentType);
    if (minScore != null) query = query.gte("score", minScore);
    if (dateFrom != null) query = query.gte("time", dateFrom);
    if (dateTo != null) query = query.lte("time", dateTo);

    const { data, error } = await query;
    if (error) throw error;
    docs.push(...((data ?? []) as SearchDoc[]));
  }

  const byId = new Map(docs.map((d) => [d.id, d]));
  return rankedIds.map((id) => byId.get(id)).filter((d): d is SearchDoc => Boolean(d));
}

export async function GET(request: NextRequest) {
  const started = Date.now();
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(Math.max(toInt(request.nextUrl.searchParams.get("limit"), 20), 1), 100);
  const offset = Math.max(toInt(request.nextUrl.searchParams.get("offset"), 0), 0);
  const type = request.nextUrl.searchParams.get("type");
  const minScoreRaw = request.nextUrl.searchParams.get("min_score");
  const dateFromRaw = request.nextUrl.searchParams.get("date_from");
  const dateToRaw = request.nextUrl.searchParams.get("date_to");

  if (!q.trim()) {
    return NextResponse.json({ error: "Missing query param: q" }, { status: 400 });
  }

  const minScore = minScoreRaw != null ? toInt(minScoreRaw, Number.NaN) : null;
  const dateFrom = dateFromRaw != null ? toInt(dateFromRaw, Number.NaN) : null;
  const dateTo = dateToRaw != null ? toInt(dateToRaw, Number.NaN) : null;
  const minScoreVal = Number.isNaN(minScore as number) ? null : minScore;
  const dateFromVal = Number.isNaN(dateFrom as number) ? null : dateFrom;
  const dateToVal = Number.isNaN(dateTo as number) ? null : dateTo;

  try {
    const supabase = getSupabase();
    const tokens = tokenizeAndStem(q);
    if (!tokens.length) {
      return NextResponse.json({ results: [], total: 0, query_tokens: [], latency_ms: Date.now() - started });
    }

    const postingMaps = await Promise.all(tokens.map((t) => fetchPostings(t, supabase)));
    const docScores = new Map<number, number>();

    // AND first: intersection across all posting lists.
    const firstIds = postingMaps[0] ? [...postingMaps[0].keys()] : [];
    for (const id of firstIds) {
      if (postingMaps.every((m) => m.has(id))) {
        const sum = postingMaps.reduce((acc, m) => acc + (m.get(id) ?? 0), 0);
        docScores.set(id, sum);
      }
    }

    // OR fallback when intersection is empty.
    if (!docScores.size) {
      for (const postings of postingMaps) {
        for (const [id, score] of postings.entries()) {
          docScores.set(id, (docScores.get(id) ?? 0) + score);
        }
      }
    }

    const rankedIds = [...docScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    const documents = await fetchFilteredDocuments(
      supabase,
      rankedIds,
      type,
      minScoreVal,
      dateFromVal,
      dateToVal
    );
    const total = documents.length;
    const results = documents.slice(offset, offset + limit);
    const latencyMs = Date.now() - started;

    // Non-fatal logging to match backend behavior.
    await supabase.from("search_logs").insert({
      query: q,
      result_count: total,
      latency_ms: latencyMs,
    });

    return NextResponse.json({
      results,
      total,
      query_tokens: tokens,
      latency_ms: latencyMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
