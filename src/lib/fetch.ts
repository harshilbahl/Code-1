import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";

export type PageContent = {
  url: string;
  title: string;
  text: string;
  images: { url: string; alt: string; near: string }[];
  pdfs: { url: string; text: string }[];
};

export async function fetchPage(url: string, timeoutMs = 15000): Promise<PageContent | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return null;
    const html = await res.text();
    return parseHtml(url, html);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function parseHtml(baseUrl: string, html: string): PageContent {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe").remove();

  const title = $("title").first().text().trim() || $("h1").first().text().trim();

  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);

  const images: PageContent["images"] = [];
  $("img").each((_, el) => {
    const $el = $(el);
    const src = abs(baseUrl, $el.attr("src") ?? $el.attr("data-src") ?? $el.attr("data-lazy-src") ?? "");
    if (!src) return;
    if (!/\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(src) && !src.includes("/image/")) return;
    const alt = ($el.attr("alt") ?? "").trim();
    const near = $el.parent().text().replace(/\s+/g, " ").trim().slice(0, 160);
    images.push({ url: src, alt, near });
  });

  const pdfs: PageContent["pdfs"] = [];
  $("a[href$='.pdf'], a[href*='.pdf?']").each((_, el) => {
    const $a = $(el);
    const href = abs(baseUrl, $a.attr("href") ?? "");
    if (!href) return;
    pdfs.push({ url: href, text: $a.text().trim() });
  });

  return { url: baseUrl, title, text, images, pdfs };
}

function abs(base: string, ref: string): string {
  if (!ref) return "";
  try {
    return new URL(ref, base).toString();
  } catch {
    return "";
  }
}
