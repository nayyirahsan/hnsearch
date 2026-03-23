import type { Filters } from "@/lib/types";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

const TYPES = ["story", "comment", "ask", "show", "job"];

export default function Filters({ filters, onChange }: Props) {
  return (
    <div className="flex gap-2 mt-3 flex-wrap items-center">
      <span className="text-xs text-gray-400 mr-1">Filter:</span>
      {TYPES.map((t) => (
        <button
          key={t}
          onClick={() => onChange({ ...filters, type: filters.type === t ? undefined : t })}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
            filters.type === t
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-500"
          }`}
        >
          {t}
        </button>
      ))}
      {filters.type && (
        <button
          onClick={() => onChange({ ...filters, type: undefined })}
          className="text-xs text-gray-400 hover:text-red-400 transition ml-1"
        >
          clear ×
        </button>
      )}
    </div>
  );
}
