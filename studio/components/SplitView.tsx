"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHighlight, HighlightContext } from "@/hooks/useHighlight";
import type { Invoice } from "@/types/invoice";
import InvoicePanel from "@/components/InvoicePanel";
import PDFViewer from "@/components/PDFViewer";


interface Props {
  invoice: Invoice;
  fileKey: string;
}

export default function SplitView({ invoice, fileKey }: Props) {
  const highlightState = useHighlight();
  const router = useRouter();
  const [leftPct, setLeftPct] = useState(42);
  const [piiBlurred, setPiiBlurred] = useState(true);

  // Pre-compute PII locations once — customer name + email bboxes
  const piiLocations = [
    ...(invoice.CustomerName?.location ?? invoice.BillingAddressRecipient?.location ?? []),
    ...(invoice.CustomerEmail?.location ?? []),
  ];
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - left) / width) * 100;
    setLeftPct(Math.min(Math.max(pct, 22), 72));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  return (
    <HighlightContext.Provider value={highlightState}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0a0d14]">

        {/* ── Top bar ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center gap-3 border-b border-[#1a1f2e] bg-[#080b12] px-4 py-2">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <span className="text-sm font-semibold tracking-tight text-slate-200">
            Doc Redact Studio
          </span>
        </div>

        {/* ── Split panes ─────────────────────────────────────────── */}
        <div ref={containerRef} className="flex flex-1 overflow-hidden">
          {/* Left — Invoice data */}
          <div
            className="h-full overflow-hidden flex-shrink-0"
            style={{ width: `${leftPct}%`, minWidth: 280 }}
          >
            <InvoicePanel invoice={invoice} piiBlurred={piiBlurred} />

          </div>

          {/* Drag handle */}
          <div
            onMouseDown={onMouseDown}
            className="group relative z-10 flex w-[5px] flex-shrink-0 cursor-col-resize items-center justify-center bg-[#1a1f2e] hover:bg-blue-500/50 transition-colors"
          >
            <div className="h-16 w-[3px] rounded-full bg-[#2a3050] group-hover:bg-blue-400 transition-colors" />
          </div>

          {/* Right — PDF */}
          <div className="h-full flex-1 overflow-hidden">
            <PDFViewer
            fileKey={fileKey}
            piiBlurred={piiBlurred}
            onPiiToggle={() => setPiiBlurred((v) => !v)}
            piiLocations={piiLocations}
          />
          </div>
        </div>

      </div>
    </HighlightContext.Provider>
  );
}