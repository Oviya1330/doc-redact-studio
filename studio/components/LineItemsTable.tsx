"use client";

import type { LineItem } from "@/types/invoice";
import { useHighlightContext, hasValidLocation } from "@/hooks/useHighlight";

function fmt(v: number | undefined | null, currency = "USD"): string {
  if (v === undefined || v === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(v);
}

function Dot({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return null;
  const c = v >= 0.85 ? "bg-emerald-400" : v >= 0.6 ? "bg-amber-400" : "bg-red-400";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${c}`} title={`${Math.round(v * 100)}%`} />;
}

// Determine which columns are present across all items
function detectColumns(items: LineItem[]) {
  return {
    hasProductCode: items.some((i) => i.ProductCode?.value),
    hasUnit: items.some((i) => i.Unit?.value),
    hasTax: items.some((i) => i.Tax?.value !== undefined && i.Tax?.value !== null),
  };
}

interface Props {
  items: LineItem[];
  currency?: string;
}

export default function LineItemsTable({ items, currency = "USD" }: Props) {
  const { setHighlight, clearHighlight, renderScale } = useHighlightContext();
  if (!items.length) return null;

  const { hasProductCode, hasUnit, hasTax } = detectColumns(items);

  return (
    <div className="overflow-x-auto rounded-xl border border-[#1e2435]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1e2435] bg-[#0f1420]">
            <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              Description
            </th>
            {hasProductCode && (
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-500 font-semibold whitespace-nowrap">
                Code
              </th>
            )}
            <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              Qty
            </th>
            {hasUnit && (
              <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                Unit
              </th>
            )}
            <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest text-slate-500 font-semibold whitespace-nowrap">
              Unit Price
            </th>
            {hasTax && (
              <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                Tax
              </th>
            )}
            <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            // Collect all non-empty locations from sub-fields
            const subLocs = [
              ...(item.Description?.location ?? []),
              ...(item.Quantity?.location ?? []),
              ...(item.UnitPrice?.location ?? []),
              ...(item.Amount?.location ?? []),
            ].filter((l) => l.bbox?.length);

            const highlightLocs =
              subLocs.length > 0
                ? subLocs
                : (item.location ?? []).filter((l) => l.bbox?.length);

            const hoverable = hasValidLocation(highlightLocs);

            return (
              <tr
                key={idx}
                onMouseEnter={() =>
                  hoverable &&
                  setHighlight({ locations: highlightLocs, color: "emerald", label: `Item[${idx + 1}]` }, renderScale)
                }
                onMouseLeave={clearHighlight}
                className={`border-b border-[#1a1f2e] transition-colors ${
                  idx % 2 === 0 ? "bg-[#0c101a]" : "bg-[#0e1220]"
                } ${hoverable ? "cursor-crosshair hover:bg-emerald-500/10 hover:ring-1 hover:ring-inset hover:ring-emerald-500/20" : ""}`}
              >
                {/* Description */}
                <td className="px-3 py-2.5 max-w-[200px]">
                  <div className="flex items-start gap-1.5">
                    <Dot v={item.Description?.confidence} />
                    <span className="text-slate-200 leading-tight whitespace-pre-wrap break-words">
                      {item.Description?.value ?? "—"}
                    </span>
                  </div>
                </td>

                {/* Product Code */}
                {hasProductCode && (
                  <td className="px-3 py-2.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                    {item.ProductCode?.value ?? "—"}
                  </td>
                )}

                {/* Quantity */}
                <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                  <span className="inline-flex items-center justify-end gap-1">
                    <Dot v={item.Quantity?.confidence} />
                    {item.Quantity?.value ?? "—"}
                  </span>
                </td>

                {/* Unit */}
                {hasUnit && (
                  <td className="px-3 py-2.5 text-right text-slate-400 uppercase text-[10px] tracking-wider">
                    {item.Unit?.value ?? "—"}
                  </td>
                )}

                {/* Unit Price */}
                <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                  <span className="inline-flex items-center justify-end gap-1">
                    <Dot v={item.UnitPrice?.confidence} />
                    {fmt(item.UnitPrice?.value, currency)}
                  </span>
                </td>

                {/* Tax */}
                {hasTax && (
                  <td className="px-3 py-2.5 text-right font-mono text-amber-400/80">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Dot v={item.Tax?.confidence} />
                      {fmt(item.Tax?.value, currency)}
                    </span>
                  </td>
                )}

                {/* Amount */}
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-300">
                  <span className="inline-flex items-center justify-end gap-1">
                    <Dot v={item.Amount?.confidence} />
                    {fmt(item.Amount?.value, currency)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}