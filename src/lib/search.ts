import * as cheerio from "cheerio";
import { scoreUrl } from "./sources";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";

export type SearchHit = {
  url: string;
  title: string;
  snippet: string;
  score: number;
  label: string;
};

// DuckDuckGo HTML endpoint — no API key required.
export async function webSearch(query: string, limit = 12): Promise<SearchHit[]> {
  const q = encodeURIComponent(`${query} Delhi NCR property`);
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`DDG returned ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const hits: SearchHit[] = [];
  $("a.result__a").each((_, el) => {
    const a = $(el);
    const raw = a.attr("href") ?? "";
    const url = unwrapDdgRedirect(raw);
    if (!url) return;
    const title = a.text().trim();
    const snippet = a.closest(".result").find(".result__snippet").text().trim();
    const { score, label } = scoreUrl(url);
    hits.push({ url, title, snippet, score, label });
  });

  hits.sort((a, b) => b.score - a.score);
  // dedupe by hostname keeping highest score, cap to limit.
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of hits) {
    const host = new URL(h.url).hostname.replace(/^www\./, "");
    if (seen.has(host)) continue;
    seen.add(host);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}

function unwrapDdgRedirect(href: string): string | null {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const target = u.searchParams.get("uddg");
    if (target) return decodeURIComponent(target);
    if (/^https?:/.test(href)) return href;
    return null;
  } catch {
    return null;
  }
}
