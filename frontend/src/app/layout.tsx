import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HNSearch — Search Hacker News",
  description: "Full-text search over 100,000+ Hacker News posts, built from scratch with a custom inverted index and TF-IDF ranking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
