import { NextResponse } from "next/server";
import { findProject } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { query?: string };
    const query = (body.query ?? "").trim();
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });
    const { projectId } = await findProject(query);
    return NextResponse.json({ projectId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
