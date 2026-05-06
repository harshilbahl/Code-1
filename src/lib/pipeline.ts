import { prisma } from "./db";
import { webSearch } from "./search";
import { fetchPage, type PageContent } from "./fetch";
import { extractProject } from "./extract";
import { domainOf } from "./sources";

export async function findProject(query: string): Promise<{ projectId: string }> {
  const hits = await webSearch(query, 12);
  if (hits.length === 0) throw new Error("No search results found");

  const pages: PageContent[] = [];
  // Hits are already sorted by source priority. Fetch top 6.
  const targets = hits.slice(0, 6);
  const fetched = await Promise.all(targets.map((h) => fetchPage(h.url)));
  for (let i = 0; i < fetched.length; i++) {
    const page = fetched[i];
    if (page && page.text.length > 200) pages.push(page);
  }
  if (pages.length === 0) throw new Error("Could not fetch any source pages");

  const extracted = await extractProject(query, pages);
  if (!extracted) throw new Error("Extraction failed");

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
          .map((im) => ({
            url: im.url,
            kind: im.kind,
            caption: im.caption,
          })),
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

  return { projectId: project.id };
}
