import { NextResponse } from "next/server";

const FASTAPI_BASE = "http://localhost:8000";

export async function GET() {
  try {
    const upstream = await fetch(`${FASTAPI_BASE}/file/list`, {
      // Opt out of Next.js fetch caching so the list is always fresh
      cache: "no-store",
    });

    const json = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(json, { status: upstream.status });
    }

    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}