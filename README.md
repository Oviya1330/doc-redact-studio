# Invoice Field Mapping — Azure Document Intelligence

This document maps the **business requirements** to the **Azure Document Intelligence prebuilt-invoice schema fields** extracted in the pipeline.

---

## Field Mapping Table

| # | Required Field | ADI Schema Field | Type | Notes |
|---|---|---|---|---|
| 1 | Vendor Name | `VendorName` | string | ✅ Direct match |
| 2 | Vendor Address | `VendorAddress` | address | ✅ Direct match — returns structured object: `houseNumber`, `road`, `city`, `state`, `postalCode`, `countryRegion` |
| 3 | Invoice Number | `InvoiceId` | string | ✅ Direct match — labeled "Invoice Number" on most invoices |
| 4 | Invoice Date | `InvoiceDate` | date | ✅ Direct match — returned in ISO format `YYYY-MM-DD` |
| 5 | Due Date | `DueDate` | date | ✅ Direct match |
| 6 | PO Number | `PurchaseOrder` | string | ✅ Direct match |
| 7 | Payment Terms | `PaymentTerm` | string | ✅ Direct match — e.g. `Net30`, `Net90` |
| 8 | Currency | `InvoiceTotal.valueCurrency.currencyCode` | string | ⚠️ No standalone currency field — extracted from any currency field's `currencyCode` property (e.g. `USD`, `EUR`) |
| 9 | Line Items — Descriptions | `Items.*.Description` | string | ✅ Direct match — per line item |
| 10 | Line Items — Quantities | `Items.*.Quantity` | number | ✅ Direct match — per line item |
| 11 | Line Items — Unit Prices | `Items.*.UnitPrice` | currency | ✅ Direct match — per line item |
| 12 | Line Items (all) | `Items` | array | ✅ Full array with all sub-fields below |
| 13 | Subtotal | `SubTotal` | currency | ✅ Direct match |
| 14 | Tax Amount | `TotalTax` | currency | ✅ Top-level total tax — also available per line item via `Items.*.Tax` and broken down in `TaxDetails[].Amount` with rate in `TaxDetails[].Rate` |
| 15 | Discount | `TotalDiscount` | currency | ✅ Direct match — may not appear on all invoices |
| 16 | Total Amount | `InvoiceTotal` | currency | ✅ Direct match — total new charges |
| 17 | Bank Details — IBAN | `PaymentDetails.*.IBAN` | string | ✅ Direct match — inside `PaymentDetails` array |
| 18 | Bank Details — Routing Number | `PaymentDetails.*.BankAccountNumber` | string | ⚠️ Partial match — ADI extracts `BankAccountNumber`; US routing numbers may appear here or alongside SWIFT/IBAN depending on invoice format |
| 19 | GL Codes | ❌ Not available | — | ❌ Not supported by ADI prebuilt-invoice — GL codes are internal accounting references not present on invoice documents. Requires custom model or post-processing mapping |

---

## Coverage Summary

| Status | Count | Fields |
|---|---|---|
| ✅ Direct match | 16 | VendorName, VendorAddress, InvoiceId, InvoiceDate, DueDate, PurchaseOrder, PaymentTerm, Items (Description, Quantity, UnitPrice), SubTotal, TotalTax, TotalDiscount, InvoiceTotal, IBAN |
| ⚠️ Partial / derived | 2 | Currency (from `currencyCode`), Routing Number (from `BankAccountNumber`) |
| ❌ Not supported | 1 | GL Codes |

---

## Notes

### Currency
There is no standalone `Currency` field in the ADI schema. Extract it from any currency-type field:
```python
currency_code = invoice.fields.get("InvoiceTotal").value_currency.currency_code
# e.g. "USD", "EUR", "GBP"
```

### Routing Number
ADI does not distinguish between IBAN, SWIFT, and routing numbers by label — it extracts whatever bank identifiers appear in the `PaymentDetails` section. US routing numbers typically appear in `BankAccountNumber`. Verify against your invoice format.

### GL Codes
GL (General Ledger) codes are internal to the buyer's accounting system and are **never present on the invoice document itself**. Options to handle this:
- Maintain a lookup table mapping `Items.*.Description` or `Items.*.ProductCode` → GL code
- Use an LLM (local or API) to classify line item descriptions into GL categories
- Build a custom ADI model trained on invoices that include GL codes in a custom field

---

## ADI Additional Fields Captured (Beyond Requirements)

These fields are extracted by the pipeline but not in the original requirements — useful for downstream processing:

| ADI Field | Description |
|---|---|
| `AmountDue` | Total amount due including previous unpaid balance |
| `PreviousUnpaidBalance` | Any outstanding balance from prior invoices |
| `VendorTaxId` | Vendor's government tax ID |
| `CustomerTaxId` | Customer's government tax ID |
| `CustomerId` | Customer reference ID |
| `CustomerName` | Name of the customer being invoiced |
| `BillingAddress` | Explicit billing address |
| `ShippingAddress` | Explicit shipping address |
| `RemittanceAddress` | Payment/remittance address |
| `ServiceStartDate` / `ServiceEndDate` | Service period dates |
| `TaxDetails[].Rate` | Tax rate percentage per tax entry |
| `Items.*.ProductCode` | SKU or product code per line item |
| `PaymentDetails.*.SWIFT` | SWIFT/BIC code for bank transfers |