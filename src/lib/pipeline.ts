import { prisma } from "./db";
import { webSearch, type SearchHit } from "./search";
import { fetchPage, type PageContent } from "./fetch";
import { extractProject, type ExtractedProject } from "./extract";
import { domainOf } from "./sources";

export type StreamEvent =
  | { type: "search_started"; query: string }
  | { type: "search_hits"; hits: SearchHit[] }
  | { type: "fetch_started"; url: string; idx: number; total: number }
  | { type: "fetch_done"; url: string; imageCount: number; pdfCount: number }
  | { type: "fetch_failed"; url: string }
  | { type: "image_found"; url: string; alt: string; sourceUrl: string }
  | { type: "extract_started"; sourceCount: number }
  | { type: "extract_done"; project: ExtractedProject }
  | { type: "saved"; projectId: string }
  | { type: "error"; message: string };

export async function* findProjectStream(query: string): AsyncGenerator<StreamEvent> {
  yield { type: "search_started", query };

  let hits: SearchHit[];
  try {
    hits = await webSearch(query, 12);
  } catch (e) {
    yield { type: "error", message: e instanceof Error ? e.message : "Search failed" };
    return;
  }
  if (hits.length === 0) {
    yield { type: "error", message: "No search results found" };
    return;
  }
  yield { type: "search_hits", hits };

  const targets = hits.slice(0, 6);
  const pages: PageContent[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    yield { type: "fetch_started", url: target.url, idx: i, total: targets.length };
    const page = await fetchPage(target.url);
    if (!page || page.text.length < 200) {
      yield { type: "fetch_failed", url: target.url };
      continue;
    }
    yield {
      type: "fetch_done",
      url: target.url,
      imageCount: page.images.length,
      pdfCount: page.pdfs.length,
    };
    for (const im of page.images.slice(0, 8)) {
      yield { type: "image_found", url: im.url, alt: im.alt, sourceUrl: target.url };
    }
    pages.push(page);
  }

  if (pages.length === 0) {
    yield { type: "error", message: "Could not fetch any source pages" };
    return;
  }

  yield { type: "extract_started", sourceCount: pages.length };

  let extracted: ExtractedProject | null;
  try {
    extracted = await extractProject(query, pages);
  } catch (e) {
    yield { type: "error", message: e instanceof Error ? e.message : "Extraction failed" };
    return;
  }
  if (!extracted) {
    yield { type: "error", message: "Could not parse a structured project from the sources" };
    return;
  }
  yield { type: "extract_done", project: extracted };

  const project = await prisma.project.create({
    data: {
      name: extracted.name,
      builder: extracted.builder,
      location: extracted.location,
      city: extracted.city,
      rera: extracted.rera,
      configurations: extracted.configurations ? JSON.stringify(extracted.configurations) : null,
      priceMin: extracted.priceMin ?? null,
      priceMax: extracted.priceMax ?? null,
      priceUnit: extracted.priceUnit,
      status: extracted.status,
      possession: extracted.possession,
      amenities: extracted.amenities ? JSON.stringify(extracted.amenities) : null,
      description: extracted.description,
      images: {
        create: (extracted.images ?? [])
          .filter((im) => /^https?:\/\//.test(im.url))
          .map((im) => ({ url: im.url, kind: im.kind, caption: im.caption })),
      },
      sources: {
        create: pages.map((p) => ({
          url: p.url,
          domain: domainOf(p.url),
          title: p.title.slice(0, 200),
        })),
      },
    },
  });

  yield { type: "saved", projectId: project.id };
}
