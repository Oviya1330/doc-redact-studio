import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE = "http://localhost:8000";

async function fetchArtifact(id: string): Promise<{ success: boolean; data: unknown } | null> {
  const res = await fetch(`${FASTAPI_BASE}/file/artifacts/${id}/data.json`, {
    cache: "no-store",
  });
  if (res.status === 404) return null; // not found — needs extraction
  if (!res.ok) throw new Error(`Artifact fetch failed: ${res.status}`);
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing file id" },
        { status: 400 }
      );
    }

    // Return cached artifact without re-running the pipeline
    const cached = await fetchArtifact(id);    if (cached) {
      return NextResponse.json({ success: true, id, cached: true });
    }

    // Run extraction pipeline
    const upstream = await fetch(`${FASTAPI_BASE}/file/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const json = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(json, { status: upstream.status });
    }

    return NextResponse.json({ ...json, cached: false });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}