"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useHighlightContext } from "@/hooks/useHighlight";
import type { PixelRect } from "@/hooks/useHighlight";
import type { Location } from "@/types/invoice";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, EyeOff, Eye } from "lucide-react";

// ── Convert ADI inch-based bbox → canvas pixel rect ───────────────
function bboxToPixelRect(
  bbox: [number, number][],
  page: number,
  scale: number,
  dpi = 72,
): PixelRect | null {
  if (!bbox?.length) return null;
  const xs = bbox.map((p) => p[0] * dpi * scale);
  const ys = bbox.map((p) => p[1] * dpi * scale);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  return { x, y, w, h, page, color: "blue" };
}

// ── Highlight overlay (highlights + PII blur rects) ───────────────
function HighlightOverlay({
  rects,
  piiRects,
  currentPage,
  piiBlurred,
}: {
  rects: PixelRect[];
  piiRects: PixelRect[];
  currentPage: number;
  piiBlurred: boolean;
}) {
  const visibleHighlights = rects.filter((r) => r.page === currentPage);
  const visiblePii = piiRects.filter((r) => r.page === currentPage);

  if (!visibleHighlights.length && (!piiBlurred || !visiblePii.length)) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 overflow-visible"
      style={{ width: "100%", height: "100%" }}
    >
      {/* Regular field highlights */}
      {visibleHighlights.map((r, i) => {
        const stroke = r.color === "emerald" ? "#10b981" : "#3b82f6";
        const fill   = r.color === "emerald" ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.12)";
        return (
          <g key={i}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h}
              fill={fill} stroke={stroke} strokeWidth={1.5} rx={2} />
            {r.label && (
              <text x={r.x + 3} y={r.y - 3} fontSize={9} fill={stroke}
                fontFamily="monospace" fontWeight="bold">{r.label}</text>
            )}
          </g>
        );
      })}

      {/* PII redaction — solid black blocks */}
      {piiBlurred && visiblePii.map((r, i) => (
        <rect
          key={`pii-${i}`}
          x={r.x - 2} y={r.y - 2} width={r.w + 4} height={r.h + 4}
          fill="#0a0d14"
          rx={3}
        />
      ))}
    </svg>
  );
}

// ── Main PDFViewer ─────────────────────────────────────────────────
interface Props {
  fileKey: string;
  piiBlurred: boolean;
  onPiiToggle: () => void;
  piiLocations: Location[];
}

export default function PDFViewer({ fileKey, piiBlurred, onPiiToggle, piiLocations }: Props) {
  const { activeHighlights, activePage, renderScale, setRenderScale } =
    useHighlightContext();

  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [numPages, setNumPages]   = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const pdfDocRef = useRef<unknown>(null);
  const pdfUrl    = `/api/pdf?key=${encodeURIComponent(fileKey)}`;

  // ── Pre-compute PII pixel rects from ADI locations ──────────────
  // No canvas ref needed — pixel math only depends on scale
  const piiRects: PixelRect[] = piiLocations.flatMap((loc) => {
    const r = bboxToPixelRect(loc.bbox, loc.page, renderScale);
    return r ? [r] : [];
  });

  // ── Load PDF ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCurrentPage(1);

    async function load() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const doc = await pdfjs.getDocument(pdfUrl).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  // ── Render page ─────────────────────────────────────────────────
  const renderPage = useCallback(async (pageNum: number, scale: number) => {
    const doc = pdfDocRef.current as {
      getPage: (n: number) => Promise<{
        getViewport: (o: { scale: number }) => { width: number; height: number };
        render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
          promise: Promise<void>; cancel: () => void;
        };
      }>;
    } | null;
    if (!doc || !canvasRef.current) return;

    renderTaskRef.current?.cancel();
    const page     = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas   = canvasRef.current;
    const ctx      = canvas.getContext("2d")!;
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;

    const task = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try { await task.promise; } catch { /* cancelled */ }
  }, []);

  useEffect(() => {
    if (!loading) renderPage(currentPage, renderScale);
  }, [loading, currentPage, renderScale, renderPage]);

  useEffect(() => {
    if (activePage !== null && activePage !== currentPage)
      setCurrentPage(activePage);
  }, [activePage]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (p: number) => setCurrentPage(Math.max(1, Math.min(p, numPages)));

  return (
    <div className="flex h-full flex-col bg-[#080b12]">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 border-b border-[#1a1f2e] bg-[#0a0d14] px-4 py-2.5">
        {/* Page nav */}
        <button onClick={() => goTo(currentPage - 1)} disabled={currentPage <= 1}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 disabled:opacity-30 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-slate-400 tabular-nums select-none">
          <span className="text-slate-200 font-semibold">{currentPage}</span>
          {" / "}{numPages || "—"}
        </span>
        <button onClick={() => goTo(currentPage + 1)} disabled={currentPage >= numPages}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 disabled:opacity-30 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="mx-2 h-4 w-px bg-[#1e2435]" />

        {/* PII toggle — before zoom */}
        <button
          onClick={onPiiToggle}
          className={[
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            piiBlurred
              ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 ring-1 ring-amber-500/30"
              : "bg-[#1a1f2e] text-slate-400 hover:bg-[#222840] hover:text-slate-200",
          ].join(" ")}
          title={piiBlurred ? "Show customer PII" : "Blur customer PII"}
        >
          {piiBlurred
            ? <><EyeOff className="h-3.5 w-3.5" /> PII hidden</>
            : <><Eye className="h-3.5 w-3.5" /> Hide PII</>
          }
        </button>

        <div className="mx-2 h-4 w-px bg-[#1e2435]" />

        {/* Zoom */}
        <button onClick={() => setRenderScale(Math.max(0.75, renderScale - 0.25))}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 transition-colors" title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="text-xs text-slate-500 tabular-nums select-none w-10 text-center">
          {Math.round(renderScale * 100)}%
        </span>
        <button onClick={() => setRenderScale(Math.min(3, renderScale + 0.25))}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 transition-colors" title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </button>

        <div className="ml-auto text-[10px] text-slate-600 uppercase tracking-widest hidden sm:block">
          Hover a field to highlight
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto thin-scroll bg-[#060810] flex justify-center py-6 px-4">
        {loading && (
          <div className="flex items-center gap-2 text-slate-500 self-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading PDF…</span>
          </div>
        )}
        {error && <div className="self-center text-sm text-red-400">{error}</div>}
        {!loading && !error && (
          <div className="relative inline-block shadow-2xl shadow-black/60">
            <canvas ref={canvasRef} className="block" />
            <HighlightOverlay
              rects={activeHighlights}
              piiRects={piiRects}
              currentPage={currentPage}
              piiBlurred={piiBlurred}
            />
          </div>
        )}
      </div>
    </div>
  );
}