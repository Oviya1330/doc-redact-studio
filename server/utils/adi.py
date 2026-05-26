import os, re, json, logging
from openai import OpenAI, OpenAIError
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────
# ADI FIELD HELPERS
# ─────────────────────────────────────────────────────────────────

def get_bounding_info(field):
    regions = getattr(field, "bounding_regions", None) or []
    result = []
    for r in regions:
        p = r.polygon
        coords = [(p[i], p[i + 1]) for i in range(0, len(p), 2)]
        result.append({"page": r.page_number, "bbox": coords})
    return result


def field_to_dict(f, getter):
    return {
        "value":      getter(f),
        "confidence": f.confidence,
        "location":   get_bounding_info(f),
    }

def string_to_dict(f):
    return field_to_dict(f, lambda x: x.value_string)

def date_to_dict(f):
    return field_to_dict(f, lambda x: str(x.value_date))

def currency_to_dict(f):
    return {
        "value":      f.value_currency.amount,
        "currency":   f.value_currency.currency_code,
        "confidence": f.confidence,
        "location":   get_bounding_info(f),
    }

def address_to_dict(f):
    addr       = f.value_address
    structured = vars(addr) if hasattr(addr, "__dict__") else {}
    return {
        "value":      structured,
        "raw":        getattr(f, "content", None),
        "confidence": f.confidence,
        "location":   get_bounding_info(f),
    }

def get_currency_code(invoice):
    for field_name in ["InvoiceTotal", "SubTotal", "TotalTax", "AmountDue", "PreviousUnpaidBalance"]:
        f = invoice.fields.get(field_name)
        if f and f.value_currency and f.value_currency.currency_code:
            return f.value_currency.currency_code
    return None


# ─────────────────────────────────────────────────────────────────
# ENRICHMENT HELPERS
# ─────────────────────────────────────────────────────────────────

REQUIRED_FIELDS = {
    "Currency":      None,
    "VendorName":    None,
    "VendorAddress": None,
    "InvoiceId":     None,
    "InvoiceDate":   None,
    "DueDate":       None,
    "PurchaseOrder": None,
    "PaymentTerm":   None,
    "SubTotal":      None,
    "TotalTax":      None,
    "TotalDiscount": None,
    "InvoiceTotal":  None,
    "IBAN":          None,
    "SWIFT":         None,
    "CustomerEmail": None,
}


def wrap(value, confidence=None, location=None):
    return {"value": value, "confidence": confidence, "location": location or []}


def is_present(inv: dict, key: str) -> bool:
    v = inv.get(key)
    if v is None:
        return False
    if isinstance(v, dict):
        return v.get("value") is not None
    return True  # plain scalar e.g. Currency = "USD"


def promote_payment_details(inv: dict) -> None:
    """Hoist first IBAN / SWIFT from PaymentDetails[] to top level."""
    for detail in inv.get("PaymentDetails", []):
        for key in ("IBAN", "SWIFT"):
            if not is_present(inv, key) and key in detail:
                inv[key] = detail[key]

def demote_payment_keys(inv: dict) -> None:
    """Remove IBAN and SWIFT from top level — they live in PaymentDetails only."""
    for key in ("IBAN", "SWIFT"):
        inv.pop(key, None)


def find_missing(inv: dict) -> set[str]:
    promote_payment_details(inv)
    return {k for k in REQUIRED_FIELDS if not is_present(inv, k)}


def ask_openai_enrichment(missing_fields: set[str], adi_result: dict,
                           openai_client: OpenAI) -> dict:
    """
    Send the raw ADI JSON to OpenAI.
    OpenAI finds each missing field using the ADI JSON's own
    boundingRegions for coordinates — it never invents values or bboxes.
    """
    target = {k: None for k in missing_fields}
    prompt = f"""You are an invoice data extraction assistant.

You will receive the raw JSON from Azure Document Intelligence (ADI) for an invoice.
Find each field in TARGET FIELDS using ONLY data already present in the ADI JSON.

Rules:
1. Search everywhere: top-level fields, nested objects, Items[], PaymentDetails[], content strings.
2. Use the FIRST occurrence of each field only.
3. Return the ADI field's own `confidence` value if available, else null.
4. Return coordinates from the ADI field's own `boundingRegions` converted to:
   "location": [{{"page": <pageNumber>, "bbox": [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]}}]
   Polygon in ADI is a flat list [x0,y0,x1,y1,...] — convert to pairs.
   If no boundingRegions exist, return "location": [].
5. DO NOT invent values or coordinates. If a field is absent, set value to null.
6. Field-specific hints:
   - Currency     → find any valueCurrency.currencyCode (e.g. "USD")
   - CustomerEmail → look for BillingEmail or any email associated with the customer
   - IBAN / SWIFT → look inside PaymentDetails array
7. Return ONLY valid JSON. No explanation, no markdown, no code fences.

### TARGET FIELDS:
{json.dumps(target, indent=2)}

### ADI RESULT:
{json.dumps(adi_result, indent=2, default=str)}
"""

    logger.debug(
        "Sending enrichment request to OpenAI | missing_fields=%s | prompt_chars=%d",
        sorted(missing_fields), len(prompt)
    )

    try:
        resp = openai_client.chat.completions.create(
            model="gpt-5.1",
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
    except OpenAIError as e:
        logger.error(
            "OpenAI API call failed | missing_fields=%s | error_type=%s | error=%s",
            sorted(missing_fields), type(e).__name__, e,
            exc_info=True,
        )
        raise

    raw   = resp.choices[0].message.content
    logger.debug("OpenAI raw response (first 500 chars): %.500s", raw)

    clean = re.sub(r"```(?:json)?|```", "", raw).strip()

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        logger.error(
            "Failed to parse OpenAI response as JSON | error=%s | raw_response=%.1000s",
            e, clean,
        )
        raise

    logger.info(
        "OpenAI enrichment succeeded | fields_returned=%s",
        sorted(parsed.keys()),
    )
    return parsed


def merge_enrichment(inv: dict, openai_result: dict) -> None:
    for field_name, data in openai_result.items():
        if not isinstance(data, dict):
            inv[field_name] = wrap(data)
            continue

        value      = data.get("value")
        confidence = data.get("confidence")
        location   = [
            {
                "page": loc.get("page"),
                "bbox": [tuple(pt) if isinstance(pt, list) else pt
                         for pt in loc.get("bbox", [])],
            }
            for loc in data.get("location", [])
        ]

        entry = wrap(value, confidence, location)
        print(f"  [OpenAI] {field_name} = {value}  (conf={confidence})")

        if field_name in ("IBAN", "SWIFT") and value:
            if not inv.get("PaymentDetails"):
                inv["PaymentDetails"] = [{}]
            inv["PaymentDetails"][0].setdefault(field_name, entry)

        inv[field_name] = entry


def enrich_required_fields(inv: dict, adi_result: dict, openai_client: OpenAI) -> None:
    """Fill any missing REQUIRED_FIELDS in-place using the raw ADI JSON."""
    missing = find_missing(inv)
    print(f"  Present : {sorted(REQUIRED_FIELDS.keys() - missing)}")
    print(f"  Missing : {sorted(missing)}")

    if not missing:
        print("  All required fields present — skipping OpenAI call.")
        return

    print("  Calling OpenAI for missing fields …")
    try:
        result = ask_openai_enrichment(missing, adi_result, openai_client)
    except (OpenAIError, json.JSONDecodeError) as e:
        logger.error(
            "Enrichment aborted — could not retrieve missing fields=%s | reason=%s",
            sorted(missing), e,
        )
        # Populate missing fields with null wrappers so downstream code
        # never encounters a KeyError on REQUIRED_FIELDS.
        for field_name in missing:
            inv.setdefault(field_name, wrap(None))
        return

    merge_enrichment(inv, result)


# ─────────────────────────────────────────────────────────────────
# MAIN EXTRACTION FUNCTION
# ─────────────────────────────────────────────────────────────────

def extract_invoice_data(formUrl: str) -> dict:
    endpoint        = os.getenv("FORM_RECOGNIZER_ENDPOINT")
    key             = os.getenv("FORM_RECOGNIZER_KEY")
    openai_client   = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    client = DocumentIntelligenceClient(
        endpoint=endpoint, credential=AzureKeyCredential(key)
    )
    poller   = client.begin_analyze_document(
        "prebuilt-invoice", AnalyzeDocumentRequest(url_source=formUrl)
    )
    invoices = poller.result()
    print("Document analysis completed. Extracting fields...")

    invoice    = invoices.documents[0]
    adi_result = invoices.as_dict()   # raw dict — source of truth for enrichment
    inv        = {}

    # ── Currency ──────────────────────────────────────────────────
    inv["Currency"] = get_currency_code(invoice)

    # ── String fields ─────────────────────────────────────────────
    for field_name in [
        "VendorName", "VendorAddressRecipient",
        "CustomerName", "CustomerId", "CustomerAddressRecipient",
        "BillingAddressRecipient", "ShippingAddressRecipient",
        "RemittanceAddressRecipient", "ServiceAddressRecipient",
        "PurchaseOrder", "InvoiceId",
        "VendorTaxId", "CustomerTaxId",
        "PaymentTerm",
    ]:
        f = invoice.fields.get(field_name)
        if f:
            inv[field_name] = string_to_dict(f)

    # ── Address fields ────────────────────────────────────────────
    for field_name in [
        "VendorAddress", "CustomerAddress",
        "BillingAddress", "ShippingAddress",
        "RemittanceAddress", "ServiceAddress",
    ]:
        f = invoice.fields.get(field_name)
        if f:
            inv[field_name] = address_to_dict(f)

    # ── Date fields ───────────────────────────────────────────────
    for field_name in ["InvoiceDate", "DueDate", "ServiceStartDate", "ServiceEndDate"]:
        f = invoice.fields.get(field_name)
        if f:
            inv[field_name] = date_to_dict(f)

    # ── Currency fields ───────────────────────────────────────────
    for field_name in [
        "SubTotal", "TotalDiscount", "TotalTax",
        "InvoiceTotal", "AmountDue", "PreviousUnpaidBalance",
    ]:
        f = invoice.fields.get(field_name)
        if f:
            inv[field_name] = currency_to_dict(f)

    # ── PaymentDetails[] ──────────────────────────────────────────
    payment_details = invoice.fields.get("PaymentDetails")
    if payment_details:
        inv["PaymentDetails"] = []
        for detail in payment_details.value_array:
            obj   = detail.value_object
            entry = {"location": get_bounding_info(detail)}
            for sub_field in ["IBAN", "SWIFT", "BankAccountNumber", "BPayBillerCode", "BPayReference"]:
                f = obj.get(sub_field)
                if f:
                    entry[sub_field] = string_to_dict(f)
            inv["PaymentDetails"].append(entry)

    # ── TaxDetails[] ─────────────────────────────────────────────
    tax_details = invoice.fields.get("TaxDetails")
    if tax_details:
        inv["TaxDetails"] = []
        for detail in tax_details.value_array:
            obj   = detail.value_object
            entry = {"location": get_bounding_info(detail)}
            amount = obj.get("Amount")
            if amount:
                entry["Amount"] = currency_to_dict(amount)
            rate = obj.get("Rate")
            if rate:
                entry["Rate"] = string_to_dict(rate)
            inv["TaxDetails"].append(entry)

    # ── PaidInFourInstallments[] ──────────────────────────────────
    installments = invoice.fields.get("PaidInFourInstallements")
    if installments:
        inv["PaidInFourInstallements"] = []
        for installment in installments.value_array:
            obj   = installment.value_object
            entry = {"location": get_bounding_info(installment)}
            amount = obj.get("Amount")
            if amount:
                entry["Amount"] = currency_to_dict(amount)
            due_date = obj.get("DueDate")
            if due_date:
                entry["DueDate"] = date_to_dict(due_date)
            inv["PaidInFourInstallements"].append(entry)

    # ── Items[] ───────────────────────────────────────────────────
    items = invoice.fields.get("Items")
    if items:
        inv["Items"] = []
        item_fields = {
            "Description": lambda f: f.value_string,
            "ProductCode": lambda f: f.value_string,
            "Unit":        lambda f: f.value_string,
            "TaxRate":     lambda f: f.value_string,
            "Quantity":    lambda f: f.value_number,
            "Date":        lambda f: str(f.value_date),
            "UnitPrice":   lambda f: f.value_currency.amount,
            "Tax":         lambda f: f.value_currency.amount,
            "Amount":      lambda f: f.value_currency.amount,
        }
        for item in items.value_array:
            obj      = item.value_object
            item_dict = {"location": get_bounding_info(item)}
            for sub_field, getter in item_fields.items():
                f = obj.get(sub_field)
                if f:
                    item_dict[sub_field] = {
                        "value":      getter(f),
                        "confidence": f.confidence,
                        "location":   get_bounding_info(f),
                    }
            inv["Items"].append(item_dict)

    # ── Enrichment: required scalar fields ───────────────────────
    print("Checking required fields …")
    enrich_required_fields(inv, adi_result, openai_client)
    demote_payment_keys(inv)
    return inv