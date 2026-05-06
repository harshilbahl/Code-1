import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { domainOf } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { images: true, sources: true },
  });
  if (!project) notFound();

  const gallery = project.images.filter((i) => i.kind === "gallery");
  const floorPlans = project.images.filter((i) => i.kind === "floor_plan");
  const amenities = project.images.filter((i) => i.kind === "amenity");
  const brochures = project.images.filter((i) => i.kind === "brochure");

  const configs = safeJson<string[]>(project.configurations) ?? [];
  const amenityList = safeJson<string[]>(project.amenities) ?? [];

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
        <div className="text-[var(--muted)]">
          {[project.builder, project.location, project.city].filter(Boolean).join(" · ")}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {project.status && <Badge>{project.status}</Badge>}
          {project.possession && <Badge>Possession: {project.possession}</Badge>}
          {project.rera && <Badge>RERA: {project.rera}</Badge>}
          {project.priceMin != null && (
            <Badge>
              ₹{project.priceMin}
              {project.priceMax != null && project.priceMax !== project.priceMin ? `–${project.priceMax}` : ""} {project.priceUnit ?? ""}
            </Badge>
          )}
          {configs.map((c) => (
            <Badge key={c}>{c}</Badge>
          ))}
        </div>
      </header>

      {project.description && <p className="max-w-3xl text-[var(--muted)]">{project.description}</p>}

      {gallery.length > 0 && (
        <Section title="Gallery">
          <Grid items={gallery} />
        </Section>
      )}

      {floorPlans.length > 0 && (
        <Section title={`Floor plans (${floorPlans.length})`}>
          <Grid items={floorPlans} />
        </Section>
      )}

      {amenities.length > 0 && (
        <Section title="Amenities">
          <Grid items={amenities} />
        </Section>
      )}

      {amenityList.length > 0 && (
        <Section title="Amenities listed">
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {amenityList.map((a) => (
              <li key={a} className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                {a}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brochures.length > 0 && (
        <Section title="Brochures">
          <ul className="space-y-2">
            {brochures.map((b) => (
              <li key={b.id}>
                <a className="text-[var(--accent)] underline" href={b.url} target="_blank" rel="noopener noreferrer">
                  {b.caption ?? b.url}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Sources">
        <ul className="space-y-2">
          {project.sources.map((s) => (
            <li key={s.id} className="text-sm">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline break-all">
                {s.title || s.url}
              </a>
              <span className="ml-2 text-[var(--muted)]">{domainOf(s.url)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--card)]">
      {children}
    </span>
  );
}

function Grid({ items }: { items: { id: string; url: string; caption: string | null }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((im) => (
        <a
          key={im.id}
          href={im.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--card)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={im.url} alt={im.caption ?? ""} loading="lazy" className="w-full aspect-square object-cover" />
          {im.caption && <div className="p-2 text-xs text-[var(--muted)] line-clamp-2">{im.caption}</div>}
        </a>
      ))}
    </div>
  );
}

function safeJson<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
