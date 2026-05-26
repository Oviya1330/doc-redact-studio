"use client";

import { useState, useCallback, createContext, useContext } from "react";
import type { HighlightTarget, Location } from "@/types/invoice";

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
  color: "blue" | "emerald";
  label?: string;
}

/**
 * PDF.js renders pages at (viewport.width / page.view[2]) scale internally.
 * The bboxes in the JSON are in inches. At 72 pt/inch, PDF user space = 72 units/inch.
 * We convert: pixel = inch_value * 72 * renderScale  (where renderScale comes from
 * the viewport scale passed to PDF.js, typically 96/72 * zoom).
 */
const PDF_POINTS_PER_INCH = 72;

export function bboxToPixelRect(
  bbox: [number, number][],
  renderScale: number
): { x: number; y: number; w: number; h: number } {
  const ppi = PDF_POINTS_PER_INCH * renderScale;
  const xs = bbox.map((p) => p[0] * ppi);
  const ys = bbox.map((p) => p[1] * ppi);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  return { x, y, w, h };
}

/** Returns true if a location has a non-empty, non-trivial bbox */
export function hasValidLocation(locations: Location[]): boolean {
  return locations.some((l) => Array.isArray(l.bbox) && l.bbox.length >= 2);
}

export interface UseHighlightReturn {
  activeHighlights: PixelRect[];
  activePage: number | null;
  setHighlight: (target: HighlightTarget | null, renderScale: number) => void;
  clearHighlight: () => void;
  renderScale: number;
  setRenderScale: (s: number) => void;
}

export function useHighlight(): UseHighlightReturn {
  const [activeHighlights, setActiveHighlights] = useState<PixelRect[]>([]);
  const [activePage, setActivePage] = useState<number | null>(null);
  const [renderScale, setRenderScale] = useState(1.5);

  const setHighlight = useCallback(
    (target: HighlightTarget | null, scale: number) => {
      if (!target || !hasValidLocation(target.locations)) {
        setActiveHighlights([]);
        setActivePage(null);
        return;
      }

      const rects: PixelRect[] = [];
      let firstPage: number | null = null;

      for (const loc of target.locations) {
        if (!loc.bbox?.length) continue;
        const { x, y, w, h } = bboxToPixelRect(loc.bbox, scale);
        rects.push({ x, y, w, h, page: loc.page, color: target.color, label: target.label });
        if (firstPage === null) firstPage = loc.page;
      }

      setActiveHighlights(rects);
      setActivePage(firstPage);
    },
    []
  );

  const clearHighlight = useCallback(() => {
    setActiveHighlights([]);
    setActivePage(null);
  }, []);

  return { activeHighlights, activePage, setHighlight, clearHighlight, renderScale, setRenderScale };
}

// ── Context — shared across SplitView tree ────────────────────────
export const HighlightContext = createContext<UseHighlightReturn | null>(null);

export function useHighlightContext(): UseHighlightReturn {
  const ctx = useContext(HighlightContext);
  if (!ctx) throw new Error("useHighlightContext must be inside HighlightContext.Provider");
  return ctx;
}