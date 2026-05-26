export interface Location {
  page: number;
  bbox: [number, number][];
}

/** Generic extracted field — T is the value type */
export interface Field<T = string> {
  value: T;
  confidence: number | null;
  location: Location[];
  raw?: string;
  currency?: string;
}

export interface AddressData {
  houseNumber?: string;
  road?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  countryRegion?: string;
  streetAddress?: string;
  unit?: string;
  level?: string;
}

/** Address field — value may be a structured object or a plain string */
export type AddressField = Field<{ _data: AddressData } | string>;

// ── Line Item — all sub-fields optional ───────────────────────────
export interface LineItem {
  location: Location[];
  Description?: Field<string>;
  ProductCode?: Field<string>;
  Unit?: Field<string>;
  Quantity?: Field<number>;
  UnitPrice?: Field<number>;
  Tax?: Field<number>;
  TaxRate?: Field<string>;
  Amount?: Field<number>;
  Discount?: Field<number>;
  [key: string]: Field<unknown> | Location[] | undefined;
}

// ── Payment / Tax detail arrays — open-ended ─────────────────────

export interface PaymentDetailItem {
  location: Location[];
  IBAN?: Field<string>;
  SWIFT?: Field<string>;
  BankAccountNumber?: Field<string>;
  BPayBillerCode?: Field<string>;
  BPayReference?: Field<string>;
  [key: string]: Field<unknown> | Location[] | undefined;
}

export interface TaxDetailItem {
  location: Location[];
  Amount?: Field<number>;
  Rate?: Field<string>;
  TaxRate?: Field<string>;
  [key: string]: Field<unknown> | Location[] | undefined;
}

// ── Root Invoice — every field optional ──────────────────────────
export interface Invoice {
  Currency?: string;

  // Vendor
  VendorName?: Field<string>;
  VendorAddressRecipient?: Field<string>;
  VendorAddress?: AddressField;
  VendorTaxId?: Field<string>;

  // Customer
  CustomerName?: Field<string>;
  CustomerId?: Field<string>;
  CustomerEmail?: Field<string>;
  CustomerTaxId?: Field<string>;
  CustomerAddressRecipient?: Field<string>;

  // Billing / Shipping / Remittance
  BillingAddressRecipient?: Field<string>;
  BillingAddress?: AddressField;
  ShippingAddressRecipient?: Field<string>;
  ShippingAddress?: AddressField;
  RemittanceAddressRecipient?: Field<string>;
  RemittanceAddress?: AddressField;
  ServiceAddressRecipient?: Field<string>;
  ServiceAddress?: AddressField;

  // Invoice meta
  InvoiceId?: Field<string>;
  InvoiceDate?: Field<string>;
  DueDate?: Field<string>;
  ServiceStartDate?: Field<string>;
  ServiceEndDate?: Field<string>;
  PurchaseOrder?: Field<string>;
  PaymentTerm?: Field<string>;

  // Totals
  SubTotal?: Field<number>;
  TotalDiscount?: Field<string | number>;
  TotalTax?: Field<number>;
  InvoiceTotal?: Field<number>;
  AmountDue?: Field<number>;
  PreviousUnpaidBalance?: Field<number>;

  // Arrays
  PaymentDetails?: PaymentDetailItem[];
  TaxDetails?: TaxDetailItem[];
  Items?: LineItem[];
}

// ── Shared highlight types ────────────────────────────────────────
export type HighlightColor = "blue" | "emerald";

export interface HighlightTarget {
  locations: Location[];
  color: HighlightColor;
  label?: string;
}