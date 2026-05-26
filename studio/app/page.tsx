"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { S3File } from "@/types/file";
import {
  FileText,
  Upload,
  Loader2,
  CloudUpload,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";

function parseKey(key: string) {
  const segment = key.split("/").pop() ?? key;
  const dot = segment.lastIndexOf(".");
  const id = dot !== -1 ? segment.slice(0, dot) : segment;
  const ext = dot !== -1 ? segment.slice(dot + 1) : "";
  return { id, filename: segment, ext };
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
  }).format(new Date(iso));
}

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function upload(file: File) {
    if (!file.name.endsWith(".pdf")) {
      setStatus("error");
      setMessage("Only PDF files are supported.");
      return;
    }
    setStatus("uploading");
    setMessage(file.name);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/files/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.detail ?? json.error ?? "Upload failed");
      setStatus("success");
      setMessage(`${file.name} uploaded`);
      onUploaded();
    } catch (e) {
      setStatus("error");
      setMessage(String(e));
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={[
        "group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-10 cursor-pointer select-none transition-all",
        dragging
          ? "border-blue-500 bg-blue-500/10"
          : "border-[#1e2435] bg-[#0c101a] hover:border-blue-500/50 hover:bg-blue-500/5",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
      />
      <div className={[
        "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
        dragging ? "bg-blue-500/20" : "bg-[#1a1f2e] group-hover:bg-blue-500/10",
      ].join(" ")}>
        <CloudUpload className="h-6 w-6 text-blue-400" />
      </div>
      {status === "uploading" ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Uploading <span className="text-slate-200">{message}</span>…</span>
        </div>
      ) : status === "success" ? (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      ) : status === "error" ? (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          {message}
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-slate-300">
            Drop a PDF here, or <span className="text-blue-400">browse</span>
          </p>
          <p className="text-xs text-slate-600">PDF files only</p>
        </>
      )}
    </div>
  );
}

// ── File row — now calls onExtract(id, ext) ────────────────────────
function FileRow({
  file,
  onExtract,
}: {
  file: S3File;
  onExtract: (id: string, ext: string) => void; // 👈 ext added
}) {
  const { id, filename, ext } = parseKey(file.key);

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-[#1e2435] bg-[#0c101a] px-4 py-3 transition-colors hover:border-blue-500/30 hover:bg-blue-500/5">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#1a1f2e]">
        <FileText className="h-4 w-4 text-blue-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-200">{filename}</p>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {fmtDate(file.last_modified)}
          </span>
          <span>{fmtBytes(file.size)}</span>
          <span className="font-mono uppercase tracking-widest">{ext}</span>
          <span className="font-mono text-slate-600 truncate max-w-[140px]" title={id}>{id}</span>
        </div>
      </div>
      <button
        onClick={() => onExtract(id, ext)} // 👈 pass ext
        className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-500/25 hover:text-blue-300"
      >
        Extract
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────
export default function FilesPage() {
  const router = useRouter();
  const [files, setFiles] = useState<S3File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<{ id: string; message: string } | null>(null);
  const [, startTransition] = useTransition();

  async function fetchFiles() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/files/list");
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load files");
      setFiles(json.data as S3File[]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchFiles(); }, []);

  // 👇 now receives ext and appends it as ?ext=
  async function handleExtract(id: string, ext: string) {
    setExtracting(id);
    setExtractError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ext }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? "Extraction failed");
      const invoiceId: string = json.id ?? id;
      startTransition(() =>
        router.push(`/invoice/${encodeURIComponent(invoiceId)}?ext=${ext}`)
      );
    } catch (e) {
      setExtractError({ id, message: String(e) });
      setExtracting(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-200">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
              <Upload className="h-4 w-4 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Invoice Extractor
            </h1>
          </div>
          <p className="ml-12 text-sm text-slate-500">
            Upload a PDF invoice or pick an existing file to run extraction.
          </p>
        </div>

        <section className="mb-10">
          <UploadZone onUploaded={fetchFiles} />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Files in S3 {!loading && `(${files.length})`}
            </h2>
            <button
              onClick={fetchFiles}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading files…</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          ) : files.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#1e2435] py-16 text-center text-sm text-slate-600">
              No files yet. Upload one above.
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((f) => {
                const { id, filename } = parseKey(f.key);
                return extracting === id ? (
                  <div
                    key={f.key}
                    className="flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3"
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400 flex-shrink-0" />
                    <span className="text-sm text-blue-300">
                      Running extraction on <span className="font-medium">{filename}</span>…
                    </span>
                  </div>
                ) : extractError?.id === id ? (
                  <div
                    key={f.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3"
                  >
                    <div className="flex items-center gap-2 text-sm text-red-400 min-w-0">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{extractError.message}</span>
                    </div>
                    <button
                      onClick={() => { setExtractError(null); }}
                      className="text-xs text-slate-500 hover:text-slate-300 flex-shrink-0 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <FileRow key={f.key} file={f} onExtract={handleExtract} />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}