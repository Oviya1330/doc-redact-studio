"use client";

import type { Field, HighlightColor } from "@/types/invoice";
import { useHighlightContext, hasValidLocation } from "@/hooks/useHighlight";

// ── Confidence dot ─────────────────────────────────────────────────
function ConfidenceDot({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return null;
  const pct = Math.round(value * 100);
  const color =
    value >= 0.85 ? "bg-emerald-400" : value >= 0.6 ? "bg-amber-400" : "bg-red-400";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${color} flex-shrink-0 mt-0.5`}
      title={`Confidence: ${pct}%`}
    />
  );
}

// ── Single KV row ──────────────────────────────────────────────────
interface KVRowProps {
  label: string;
  field: Field<unknown> | undefined;
  color?: HighlightColor;
  mono?: boolean;
  /** span 2 columns in the parent grid */
  cols?: 1 | 2;
}

export function KVRow({ label, field, color = "blue", cols }: KVRowProps) {
  const { setHighlight, clearHighlight, renderScale } = useHighlightContext();

  if (!field || field.value === undefined || field.value === null || field.value === "") return null;

  const displayVal =
    typeof field.value === "object"
      ? (field as unknown as { raw?: string }).raw ?? JSON.stringify(field.value)
      : String(field.value);

  const hoverable = hasValidLocation(field.location);

  return (
    <div
      onMouseEnter={() =>
        hoverable && setHighlight({ locations: field.location, color, label }, renderScale)
      }
      onMouseLeave={clearHighlight}
      className={[
        "group flex items-start gap-2 rounded-lg px-3 py-2 transition-colors",
        hoverable
          ? "cursor-crosshair hover:bg-blue-500/10 hover:ring-1 hover:ring-blue-500/30"
          : "",
        cols === 2 ? "col-span-2" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ConfidenceDot value={field.confidence} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">
          {label}
        </div>
        <div className="text-sm break-words whitespace-pre-wrap leading-snug text-slate-200">
          {displayVal}
        </div>
      </div>
    </div>
  );
}

// ── Grid container ─────────────────────────────────────────────────
interface KeyValueGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
}

export function KeyValueGrid({ children, cols = 2 }: KeyValueGridProps) {
  const colClass =
    cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : "grid-cols-1";
  return <div className={`grid ${colClass} gap-1`}>{children}</div>;
}

// ── Section wrapper ────────────────────────────────────────────────
interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function Section({ title, icon, children, defaultOpen = true }: SectionProps) {
  return (
    <details open={defaultOpen} className="group/section">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 hover:bg-white/5 transition-colors select-none">
        {icon && <span className="text-slate-400">{icon}</span>}
        <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {title}
        </span>
        <svg
          className="h-3.5 w-3.5 text-slate-600 transition-transform group-open/section:rotate-90"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </summary>
      <div className="px-2 pb-4 pt-1">{children}</div>
    </details>
  );
}