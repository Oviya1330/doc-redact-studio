"use client";

import type { Invoice } from "@/types/invoice";
import { useHighlightContext } from "@/hooks/useHighlight";
import { hasValidLocation } from "@/hooks/useHighlight";

function fmt(v: number | string | undefined | null, currency = "USD"): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "string") return v;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(v);
}

function ConfidenceDot({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return null;
  const color =
    value >= 0.85 ? "bg-emerald-400" : value >= 0.6 ? "bg-amber-400" : "bg-red-400";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${color} flex-shrink-0`}
      title={`Confidence: ${Math.round(value * 100)}%`}
    />
  );
}

interface TotalRowProps {
  label: string;
  value: string;
  confidence?: number | null;
  highlight?: boolean;
  accentClass?: string;
  onEnter?: () => void;
  onLeave?: () => void;
  hoverable?: boolean;
}

function TotalRow({
  label,
  value,
  confidence,
  accentClass = "text-slate-200",
  onEnter,
  onLeave,
  hoverable,
}: TotalRowProps) {
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors ${
        hoverable ? "cursor-crosshair hover:bg-blue-500/10 hover:ring-1 hover:ring-blue-500/20" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <ConfidenceDot value={confidence} />
        <span className="text-[11px] uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <span className={`font-mono text-sm font-semibold ${accentClass}`}>{value}</span>
    </div>
  );
}

interface Props {
  invoice: Invoice;
}

export default function TotalsSummary({ invoice }: Props) {
  const { setHighlight, clearHighlight, renderScale } = useHighlightContext();
  const cur = invoice.Currency ?? "USD";

  const makeHandler = (field: { location: Location[] } | undefined, color: "blue" | "emerald" = "blue") => {
    if (!field || !hasValidLocation(field.location)) return { onEnter: undefined, onLeave: undefined, hoverable: false };
    return {
      onEnter: () => setHighlight({ locations: field.location, color }, renderScale),
      onLeave: clearHighlight,
      hoverable: true,
    };
  };

  return (
    <div className="rounded-xl border border-[#1e2435] bg-[#0c101a] overflow-hidden">
      <div className="space-y-0.5 px-1 py-2">
        {invoice.SubTotal && (
          <TotalRow
            label="Subtotal"
            value={fmt(invoice.SubTotal.value, cur)}
            confidence={invoice.SubTotal.confidence}
            {...makeHandler(invoice.SubTotal)}
          />
        )}

        {invoice.TotalDiscount && (
          <TotalRow
            label="Discount"
            value={fmt(invoice.TotalDiscount.value, cur)}
            confidence={invoice.TotalDiscount.confidence ?? undefined}
            accentClass="text-amber-300"
            {...makeHandler(invoice.TotalDiscount)}
          />
        )}

        {invoice.TotalTax && (
          <TotalRow
            label="Tax"
            value={fmt(invoice.TotalTax.value, cur)}
            confidence={invoice.TotalTax.confidence}
            accentClass="text-amber-400"
            {...makeHandler(invoice.TotalTax)}
          />
        )}

        {invoice.AmountDue && (
          <TotalRow
            label="Amount Due"
            value={fmt(invoice.AmountDue.value, cur)}
            confidence={invoice.AmountDue.confidence}
            accentClass="text-sky-300"
            {...makeHandler(invoice.AmountDue)}
          />
        )}
      </div>

      {/* Grand total stripe */}
      {invoice.InvoiceTotal && (
        <div
          onMouseEnter={() =>
            hasValidLocation(invoice.InvoiceTotal!.location) &&
            setHighlight({ locations: invoice.InvoiceTotal!.location, color: "emerald", label: "Total" }, renderScale)
          }
          onMouseLeave={clearHighlight}
          className={`flex items-center justify-between border-t border-[#1e2435] bg-[#0f1420] px-4 py-3 ${
            hasValidLocation(invoice.InvoiceTotal.location) ? "cursor-crosshair hover:bg-emerald-500/10" : ""
          } transition-colors`}
        >
          <div className="flex items-center gap-2">
            <ConfidenceDot value={invoice.InvoiceTotal.confidence} />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Invoice Total
            </span>
          </div>
          <span className="font-mono text-lg font-bold text-emerald-300">
            {fmt(invoice.InvoiceTotal.value, cur)}
          </span>
        </div>
      )}
    </div>
  );
}

// Re-export Location for internal use without an extra import
import type { Location } from "@/types/invoice";