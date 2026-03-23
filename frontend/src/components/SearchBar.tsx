"use client";
import { useState, useEffect, useRef } from "react";

interface Props {
  onSearch: (q: string) => void;
  initialValue?: string;
}

export default function SearchBar({ onSearch, initialValue = "" }: Props) {
  const [value, setValue] = useState(initialValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim()) {
      debounceRef.current = setTimeout(() => onSearch(value.trim()), 300);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, onSearch]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search Hacker News..."
        autoFocus
        className="w-full px-5 py-3 pr-12 text-lg border border-gray-200 rounded-full shadow-sm
                   focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent
                   bg-white transition"
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 text-2xl select-none">
        🔍
      </span>
    </div>
  );
}
