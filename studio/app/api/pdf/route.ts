import { NextRequest, NextResponse } from "next/server";

const BUCKET_BASE = "https://s3-jetl.s3.us-east-2.amazonaws.com";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "Missing ?key= param" }, { status: 400 });
  }

  // Sanitize: prevent path traversal
  const safeKey = key.replace(/\.\.[/\\]/g, "").replace(/^\/+/, "");
  const s3Url = `${BUCKET_BASE}/${safeKey}`;

  const res = await fetch(s3Url);

  if (!res.ok) {
    return NextResponse.json(
      { error: `S3 fetch failed: ${res.status}` },
      { status: res.status }
    );
  }

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("Content-Type") ?? "application/pdf";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "private, max-age=300",
    },
  });
}