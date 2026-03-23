import type { SearchResult } from "@/lib/types";

interface Props {
  result: SearchResult;
  query: string;
}

function highlight(text: string, tokens: string[]): string {
  if (!tokens.length) return text;
  const pattern = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return text.replace(new RegExp(`(${pattern})`, "gi"), "<mark class='bg-yellow-100 rounded px-0.5'>$1</mark>");
}

function timeAgo(unix: number): string {
  const diff = Date.now() / 1000 - unix;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Plain text: strip tags and collapse whitespace (HN text can include HTML). */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function headlineForResult(result: SearchResult, plainText: string): string {
  if (result.type === "comment") {
    if (!plainText) return "(comment)";
    return plainText.slice(0, 120);
  }
  return result.title ?? "";
}

export default function ResultCard({ result, query }: Props) {
  const tokens = query.toLowerCase().split(" ").filter(Boolean);
  const plainBody = stripHtml(result.text ?? "");
  const headline = headlineForResult(result, plainBody);
  const snippet =
    result.type === "comment"
      ? plainBody.length > 120
        ? plainBody.slice(120, 120 + 220)
        : ""
      : plainBody.slice(0, 220);
  const hnUrl = `https://news.ycombinator.com/item?id=${result.id}`;

  return (
    <article className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
        <span className="bg-orange-50 text-orange-600 font-medium px-2 py-0.5 rounded-full border border-orange-100">
          {result.type}
        </span>
        <span>{timeAgo(result.time)}</span>
        {result.score != null && <span>· {result.score} pts</span>}
        {result.by && <span>· by <span className="text-gray-600">{result.by}</span></span>}
      </div>

      <a
        href={result.url ?? hnUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-base font-semibold text-gray-800 hover:text-orange-500 transition-colors leading-snug"
        dangerouslySetInnerHTML={{ __html: highlight(headline, tokens) }}
      />

      {snippet && (
        <p
          className="mt-1.5 text-sm text-gray-500 line-clamp-2 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlight(snippet, tokens) }}
        />
      )}

      <a
        href={hnUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs text-gray-400 hover:text-orange-400 transition-colors"
      >
        discussion →
      </a>
    </article>
  );
}
