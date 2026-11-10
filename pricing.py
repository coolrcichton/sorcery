"""Pricing rules for the event list. The page's JavaScript port must match this line for line;
both run tests/pricing_cases.json."""
import math


def num(v):
    """Sheet cell to a positive float, or None for blank, zero or junk."""
    try:
        n = float(str(v).replace("$", "").replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def price_row(row, discount):
    status = (row.get("Status") or "").strip()
    qty = str(row.get("Qty", "")).strip()
    visible = status in ("Available", "Hold") and qty != "0"
    market = num(row.get("Market Price"))
    ebay = num(row.get("eBay Sold"))
    asking = num(row.get("Asking Price"))

    # Reference: the higher of the two real online prices, named by source.
    if market and ebay:
        reference, source = (ebay, "eBay") if ebay > market else (market, "TCG")
    elif market:
        reference, source = market, "TCG"
    elif ebay:
        reference, source = ebay, "eBay"
    else:
        reference, source = None, None

    base = asking or reference
    if base is None:
        event = None  # page shows "Ask"
    else:
        event = math.floor(base * (1 - discount) + 0.5)  # nearest dollar, halves up

    saving = None
    if reference is not None and event is not None:
        s = math.floor(reference - event)
        if s >= 1:
            saving = s

    return {"visible": visible, "hold": status == "Hold", "reference": reference,
            "source": source, "event": event, "saving": saving}
