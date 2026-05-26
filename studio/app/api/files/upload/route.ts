import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE = "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const upstream = await fetch(`${FASTAPI_BASE}/file/upload`, {
      method: "POST",
      body: formData,
      // Do NOT set Content-Type — fetch sets it with the correct boundary
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