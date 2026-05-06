"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StreamEvent } from "@/lib/pipeline";
import type { ExtractedProject } from "@/lib/extract";

type SourceState = {
  url: string;
  title: string;
  label: string;
  status: "pending" | "fetching" | "fetched" | "failed";
  imageCount?: number;
};

export default function SearchForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sources, setSources] = useState<SourceState[]>([]);
  const [thumbs, setThumbs] = useState<{ url: string; alt: string }[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [project, setProject] = useState<ExtractedProject | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function reset() {
    setError(null);
    setSources([]);
    setThumbs([]);
    setExtracting(false);
    setProject(null);
    setSavedId(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || running) return;
    reset();
    setRunning(true);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);
      await consumeStream(res.body, handleEvent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stream failed");
    } finally {
      setRunning(false);
    }
  }

  function handleEvent(ev: StreamEvent) {
    switch (ev.type) {
      case "search_hits":
        setSources(
          ev.hits.slice(0, 6).map((h) => ({
            url: h.url,
            title: h.title,
            label: h.label,
            status: "pending",
          })),
        );
        return;
      case "fetch_started":
        setSources((s) => s.map((src) => (src.url === ev.url ? { ...src, status: "fetching" } : src)));
        return;
      case "fetch_done":
        setSources((s) =>
          s.map((src) =>
            src.url === ev.url ? { ...src, status: "fetched", imageCount: ev.imageCount } : src,
          ),
        );
        return;
      case "fetch_failed":
        setSources((s) => s.map((src) => (src.url === ev.url ? { ...src, status: "failed" } : src)));
        return;
      case "image_found":
        setThumbs((t) => (t.length >= 24 ? t : [...t, { url: ev.url, alt: ev.alt }]));
        return;
      case "extract_started":
        setExtracting(true);
        return;
      case "extract_done":
        setExtracting(false);
        setProject(ev.project);
        return;
      case "saved":
        setSavedId(ev.projectId);
        setTimeout(() => router.push(`/project/${ev.projectId}`), 1500);
        return;
      case "error":
        setError(ev.message);
        return;
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-3 max-w-2xl">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "DLF Camellias", "M3M Golf Estate", "ATS Picturesque Reprieves"'
            className="flex-1 px-4 py-3 rounded-lg bg-[var(--card)] border border-[var(--border)] outline-none focus:border-[var(--accent)] text-base"
            disabled={running}
          />
          <button
            type="submit"
            disabled={running || !query.trim()}
            className="px-5 py-3 rounded-lg bg-[var(--accent)] text-white font-medium disabled:opacity-50"
          >
            {running ? "Building…" : "Search"}
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      {(sources.length > 0 || thumbs.length > 0 || extracting || project) && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-6">
          {sources.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-[var(--muted)]">Sources</div>
              <ul className="space-y-1.5">
                {sources.map((s) => (
                  <li key={s.url} className="flex items-center gap-3 text-sm">
                    <StatusDot status={s.status} />
                    <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--muted)] shrink-0">
                      {s.label}
                    </span>
                    <span className="truncate flex-1">{s.title || s.url}</span>
                    {s.imageCount != null && (
                      <span className="text-xs text-[var(--muted)] shrink-0">{s.imageCount} imgs</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {thumbs.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-[var(--muted)]">
                Images discovered <span className="text-xs">({thumbs.length})</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {thumbs.map((t, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={t.url}
                    alt={t.alt}
                    referrerPolicy="no-referrer"
                    className="h-20 w-20 object-cover rounded-md border border-[var(--border)] shrink-0 bg-black/30"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {extracting && (
            <div className="text-sm text-[var(--muted)] flex items-center gap-2">
              <Spinner /> Asking Claude to consolidate…
            </div>
          )}

          {project && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-[var(--muted)]">Extracted</div>
              <div className="space-y-1">
                <div className="text-xl font-semibold">{project.name}</div>
                <div className="text-sm text-[var(--muted)]">
                  {[project.builder, project.location, project.city].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {project.status && <Pill>{project.status}</Pill>}
                {project.possession && <Pill>Possession: {project.possession}</Pill>}
                {project.rera && <Pill>RERA: {project.rera}</Pill>}
                {project.priceMin != null && (
                  <Pill>
                    ₹{project.priceMin}
                    {project.priceMax != null && project.priceMax !== project.priceMin
                      ? `–${project.priceMax}`
                      : ""}{" "}
                    {project.priceUnit ?? ""}
                  </Pill>
                )}
                {(project.configurations ?? []).map((c) => (
                  <Pill key={c}>{c}</Pill>
                ))}
              </div>
              <ImageBreakdown project={project} />
            </div>
          )}

          {savedId && (
            <div className="text-sm text-emerald-400 flex items-center gap-2">
              ✓ Saved. Opening project page…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImageBreakdown({ project }: { project: ExtractedProject }) {
  const groups = (["floor_plan", "gallery", "amenity", "location", "brochure"] as const).map((kind) => ({
    kind,
    items: (project.images ?? []).filter((i) => i.kind === kind),
  }));
  return (
    <div className="space-y-3 pt-1">
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.kind} className="space-y-1.5">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
              {labelFor(g.kind)} · {g.items.length}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {g.items.slice(0, 12).map((im, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={im.url}
                  alt={im.caption ?? ""}
                  referrerPolicy="no-referrer"
                  className="h-24 w-24 object-cover rounded-md border border-[var(--border)] shrink-0 bg-black/30"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function labelFor(k: string) {
  return (
    {
      floor_plan: "Floor plans",
      gallery: "Gallery",
      amenity: "Amenities",
      location: "Location / map",
      brochure: "Brochures",
    } as Record<string, string>
  )[k] ?? k;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] bg-black/20">
      {children}
    </span>
  );
}

function StatusDot({ status }: { status: SourceState["status"] }) {
  const cls =
    status === "fetched"
      ? "bg-emerald-400"
      : status === "fetching"
        ? "bg-amber-400 animate-pulse"
        : status === "failed"
          ? "bg-red-400"
          : "bg-zinc-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls} shrink-0`} aria-hidden />;
}

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
  );
}

async function consumeStream(body: ReadableStream<Uint8Array>, onEvent: (e: StreamEvent) => void) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        onEvent(JSON.parse(line) as StreamEvent);
      } catch {
        // skip malformed line
      }
    }
  }
  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer) as StreamEvent);
    } catch {
      /* ignore */
    }
  }
}
