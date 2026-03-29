"use client";

import type { Invoice, AddressField, Field } from "@/types/invoice";
import { KVRow, KeyValueGrid, Section } from "@/components/KeyValueGrid";
import LineItemsTable from "@/components/LineItemsTable";
import TotalsSummary from "@/components/TotalsSummary";
import {
  FileText,
  Building2,
  Users,
  Package,
  Receipt,
  CreditCard,
} from "lucide-react";

/** Resolve display string for address fields */
function resolveAddress(f: AddressField | undefined): string {
  if (!f) return "—";
  if (f.raw) return f.raw;
  if (typeof f.value === "string") return f.value;
  const d = (f.value as { _data: Record<string, string> })._data;
  return [
    d.streetAddress,
    d.city && `${d.city}${d.state ? ", " + d.state : ""}`,
    d.postalCode,
    d.countryRegion,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Wrap an AddressField so KVRow can consume it */
function addressAsField(f: AddressField | undefined): Field<string> | undefined {
  if (!f) return undefined;
  return { value: resolveAddress(f), confidence: f.confidence, location: f.location, raw: f.raw };
}

interface Props {
  invoice: Invoice;
  piiBlurred?: boolean;
}

export default function InvoicePanel({ invoice, piiBlurred = false }: Props) {
  const cur = invoice.Currency ?? "USD";
  const blur = piiBlurred ? "blur-sm select-none pointer-events-none" : "";

  return (
    <div className="flex flex-col h-full bg-[#0a0d14]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#1a1f2e] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
            <FileText className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Extracted Data</p>
            <p className="text-sm font-semibold text-slate-200">
              {invoice.InvoiceId?.value ?? "Invoice"}
            </p>
          </div>
          {invoice.Currency && (
            <span className="ml-auto rounded-md bg-[#1a1f2e] px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-widest">
              {invoice.Currency}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto thin-scroll divide-y divide-[#1a1f2e]">

        {/* ── Invoice Info ─────────────────────────────────────────── */}
        <Section title="Invoice Info" icon={<FileText className="h-3.5 w-3.5" />}>
          <KeyValueGrid cols={2}>
            <KVRow label="Invoice #" field={invoice.InvoiceId} />
            <KVRow label="PO #" field={invoice.PurchaseOrder} />
            <KVRow label="Invoice Date" field={invoice.InvoiceDate} />
            <KVRow label="Due Date" field={invoice.DueDate} />
            <KVRow label="Payment Terms" field={invoice.PaymentTerm} />
            <KVRow label="Service Start" field={invoice.ServiceStartDate} />
            <KVRow label="Service End" field={invoice.ServiceEndDate} />
          </KeyValueGrid>
        </Section>

        {/* ── Vendor ───────────────────────────────────────────────── */}
        <Section title="Vendor" icon={<Building2 className="h-3.5 w-3.5" />}>
          <KeyValueGrid cols={2}>
            <KVRow label="Vendor Name" field={invoice.VendorName ?? invoice.VendorAddressRecipient} />
            <KVRow label="Tax ID" field={invoice.VendorTaxId} />
            <KVRow
              label="Address"
              field={addressAsField(invoice.VendorAddress)}
              cols={2}
            />
            <KVRow label="Remittance Recipient" field={invoice.RemittanceAddressRecipient} />
            <KVRow
              label="Remittance Address"
              field={addressAsField(invoice.RemittanceAddress)}
              cols={2}
            />
          </KeyValueGrid>
        </Section>

        {/* ── Customer / Billing ───────────────────────────────────── */}
        <Section title="Bill To" icon={<Users className="h-3.5 w-3.5" />}>
          <KeyValueGrid cols={2}>
            <div className={blur}>
              <KVRow label="Customer" field={invoice.CustomerName ?? invoice.BillingAddressRecipient} />
            </div>
            <div className={blur}>
              <KVRow label="Email" field={invoice.CustomerEmail} />
            </div>
            <KVRow label="Customer ID" field={invoice.CustomerId} />
            <KVRow label="Tax ID" field={invoice.CustomerTaxId} />
            <KVRow
              label="Billing Address"
              field={addressAsField(invoice.BillingAddress)}
              cols={2}
            />
          </KeyValueGrid>
        </Section>

        {/* ── Ship To (only if present) ────────────────────────────── */}
        {(invoice.ShippingAddressRecipient || invoice.ShippingAddress) && (
          <Section title="Ship To" icon={<Package className="h-3.5 w-3.5" />} defaultOpen={false}>
            <KeyValueGrid cols={2}>
              <KVRow label="Recipient" field={invoice.ShippingAddressRecipient} />
              <KVRow
                label="Shipping Address"
                field={addressAsField(invoice.ShippingAddress)}
                cols={2}
              />
            </KeyValueGrid>
          </Section>
        )}

        {/* ── Line Items ───────────────────────────────────────────── */}
        {invoice.Items && invoice.Items.length > 0 && (
          <Section title={`Line Items (${invoice.Items.length})`} icon={<Receipt className="h-3.5 w-3.5" />}>
            <LineItemsTable items={invoice.Items} currency={cur} />
          </Section>
        )}

        {/* ── Totals ───────────────────────────────────────────────── */}
        {(invoice.SubTotal || invoice.InvoiceTotal || invoice.TotalTax) && (
          <Section title="Totals" icon={<Receipt className="h-3.5 w-3.5" />}>
            <TotalsSummary invoice={invoice} />
          </Section>
        )}

        {/* ── Payment Details ──────────────────────────────────────── */}
        {invoice.PaymentDetails && invoice.PaymentDetails.length > 0 && (
          <Section title="Payment Details" icon={<CreditCard className="h-3.5 w-3.5" />} defaultOpen={false}>
            <div className="space-y-3">
              {invoice.PaymentDetails.map((pd, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[#1e2435] bg-[#0c101a] px-3 py-2"
                >
                  <KeyValueGrid cols={1}>
                    {pd.IBAN && (
                      <KVRow label="IBAN" field={pd.IBAN} mono />
                    )}
                    {pd.SWIFT && (
                      <KVRow label="SWIFT / BIC" field={pd.SWIFT} mono />
                    )}
                    {pd.BankAccountNumber && (
                      <KVRow label="Account Number" field={pd.BankAccountNumber} mono />
                    )}
                    {pd.BPayBillerCode && (
                      <KVRow label="BPay Biller Code" field={pd.BPayBillerCode} mono />
                    )}
                    {pd.BPayReference && (
                      <KVRow label="BPay Reference" field={pd.BPayReference} mono />
                    )}
                  </KeyValueGrid>
                </div>
              ))}
            </div>
          </Section>
        )}

        <div className="h-6" /> {/* bottom breathing room */}
      </div>
    </div>
  );
}