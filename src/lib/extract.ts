import Anthropic from "@anthropic-ai/sdk";
import type { PageContent } from "./fetch";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export type ExtractedProject = {
  name: string;
  builder: string | null;
  location: string | null;
  city: string | null;
  rera: string | null;
  configurations: string[] | null;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: "L" | "Cr" | null;
  status: "Ready to Move" | "Under Construction" | "New Launch" | null;
  possession: string | null;
  amenities: string[] | null;
  description: string | null;
  images: { url: string; kind: "gallery" | "floor_plan" | "amenity" | "location" | "brochure"; caption: string | null }[];
};

const SYSTEM = `You extract structured real-estate project data from Delhi NCR (Gurugram, Noida, Greater Noida, Delhi, Faridabad, Ghaziabad) web pages.

You will receive raw text and image references from one or more pages. Return a SINGLE JSON object describing the primary project that matches the user's query. Use null for unknown fields. Do not invent values.

Schema (return EXACTLY this JSON, no markdown, no commentary):
{
  "name": string,
  "builder": string | null,
  "location": string | null,
  "city": "Gurugram" | "Noida" | "Greater Noida" | "Delhi" | "Faridabad" | "Ghaziabad" | null,
  "rera": string | null,
  "configurations": string[] | null,
  "priceMin": number | null,
  "priceMax": number | null,
  "priceUnit": "L" | "Cr" | null,
  "status": "Ready to Move" | "Under Construction" | "New Launch" | null,
  "possession": string | null,
  "amenities": string[] | null,
  "description": string | null,
  "images": [{ "url": string, "kind": "gallery"|"floor_plan"|"amenity"|"location"|"brochure", "caption": string | null }]
}

Image classification rules:
- kind="floor_plan" if alt/caption/url contains "floor plan", "layout", "unit plan", "2BHK plan", "typical floor", "site plan".
- kind="brochure" for any item explicitly labelled brochure.
- kind="amenity" if mentions clubhouse, pool, gym, spa, etc.
- kind="location" if mentions map, location, master plan.
- otherwise kind="gallery".

Keep at most 30 images, prioritising floor plans and brochures, then gallery. Reject decorative icons (favicons, logos, sprite sheets, very small images, dummy placeholders).`;

export async function extractProject(query: string, pages: PageContent[]): Promise<ExtractedProject | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const anthropic = new Anthropic({ apiKey });

  const condensed = pages
    .map((p, i) => {
      const imgList = p.images
        .slice(0, 40)
        .map((im) => `  - ${im.url}  alt="${im.alt}" near="${im.near}"`)
        .join("\n");
      const pdfList = p.pdfs.map((d) => `  - ${d.url}  text="${d.text}"`).join("\n");
      return [
        `=== Source ${i + 1}: ${p.url} ===`,
        `TITLE: ${p.title}`,
        `TEXT: ${p.text.slice(0, 6000)}`,
        imgList ? `IMAGES:\n${imgList}` : "",
        pdfList ? `PDFS:\n${pdfList}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `User query: ${query}\n\nSources:\n\n${condensed}`,
      },
    ],
  });

  const text = message.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();

  const json = stripFence(text);
  try {
    const parsed = JSON.parse(json) as ExtractedProject;
    if (!parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

function stripFence(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) return m[1].trim();
  return s;
}
