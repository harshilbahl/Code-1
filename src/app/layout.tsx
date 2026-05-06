import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NCR Property Finder",
  description: "Search any Delhi NCR project — get images, floor plans, and details aggregated from across the web.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <a href="/" className="font-semibold text-lg tracking-tight">
              NCR Property Finder
            </a>
            <span className="text-xs text-[var(--muted)]">Delhi NCR · aggregated</span>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
