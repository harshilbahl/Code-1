import Link from "next/link";
import { prisma } from "@/lib/db";
import SearchForm from "./SearchForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const recent = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { images: { where: { kind: "gallery" }, take: 1 } },
  });

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Find any NCR project</h1>
        <p className="text-[var(--muted)] max-w-2xl">
          Type a project, builder, or sector. We aggregate images, floor plans, RERA, and pricing from builder
          sites, RERA registries, and major portals.
        </p>
        <SearchForm />
      </section>

      {recent.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--muted)]">Recently searched</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map((p) => {
              const cover = p.images[0]?.url;
              return (
                <Link
                  key={p.id}
                  href={`/project/${p.id}`}
                  className="block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden hover:border-[var(--accent)] transition-colors"
                >
                  {cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt={p.name} className="w-full aspect-[16/10] object-cover" />
                  )}
                  <div className="p-4 space-y-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-[var(--muted)]">
                      {[p.builder, p.location].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
