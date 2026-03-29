import { notFound } from "next/navigation";
import type { Invoice } from "@/types/invoice";
import SplitView from "@/components/SplitView";

const FASTAPI_BASE = process.env.FASTAPI_URL ?? "http://localhost:8000";

export async function fetchInvoice(id: string): Promise<Invoice> {
  const res = await fetch(
    `${FASTAPI_BASE}/file/artifacts/${encodeURIComponent(id)}/data.json`,
    { cache: "no-store" }
  );

  if (!res.ok) notFound();

  const json = await res.json();
  const data = json.data ?? json;
  return Array.isArray(data) ? (data[0] as Invoice) : (data as Invoice);
}

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ext?: string }>;
}

export default async function InvoicePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { ext = "pdf" } = await searchParams;

  const invoice = await fetchInvoice(id);
  console.log("Fetched invoice:", invoice);
  const fileKey = `uploads/${id}.${ext}`;

  return <SplitView invoice={invoice} fileKey={fileKey} />;
}