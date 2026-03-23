import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics — HNSearch",
  description: "Search index stats and usage analytics for HNSearch.",
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
