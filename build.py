"""Build index.html from the two published CSVs.

Usage: python3 build.py                              (reads the live published sheet)
       python3 build.py PUBLIC_CSV SETTINGS_CSV      (local CSV files instead)
"""
import base64, csv, hashlib, io, json, os, re, sys, urllib.request

from pricing import price_row

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTjTrkoDzN6rdYyS7gDJy51Sj-Zgje6PS-4e9wu5MgMaTDIjAZNI_MYs5bTXr99AW3zQcMlOrXNRwKk/pub?single=true&output=csv&gid="
LIVE = {"items": PUB + "2131651168", "settings": PUB + "1572978540"}


def read_csv(src):
    if src.startswith("http"):
        text = urllib.request.urlopen(src, timeout=30).read().decode("utf-8")
    else:
        text = open(src, encoding="utf-8").read()
    return list(csv.reader(io.StringIO(text)))


def https_url(u):
    """Sheet cells that become links or image sources must be plain https URLs."""
    return u if re.fullmatch(r"https://[^\s\"'<>]+", u, re.I) else ""


def to_item(row, discount):
    """One sheet row to the shape the page renders, or None if it must not show."""
    g = lambda k: (row.get(k) or "").strip()
    p = price_row(row, discount)
    sold = g("Status") == "Sold"  # shown greyed out with a SOLD stamp; Hidden removes a row entirely
    if (not p["visible"] and not sold) or not g("Name"):
        return None
    return {
        "sold": sold,
        "id": g("ID"), "type": g("Type"), "name": g("Name"), "set": g("Set"), "finish": g("Finish"),
        "cond": g("Condition") or "NM",  # owner's call: blank means Near Mint
        "qty": int(float(g("Qty"))) if g("Qty") else 1,
        "link": https_url(g("TCGplayer Link").split("?")[0]),
        "photo": https_url(g("Photo URL")), "notes": g("Notes"),
        "featured": g("Featured").upper() == "Y", "hold": p["hold"],
        "ref": p["reference"], "src": p["source"], "event": p["event"], "saving": p["saving"],
    }


def to_settings(pairs):
    kv = {r[0].strip(): r[1].strip() for r in pairs[1:] if len(r) > 1 and r[0].strip()}
    sellers, n = [], 1
    while kv.get(f"seller{n}_name"):
        sellers.append({k: kv.get(f"seller{n}_{k}", "") for k in ("name", "sms", "whatsapp", "discord")})
        n += 1
    out = {k: kv.get(k, "") for k in ("location_now", "banner", "payment_methods", "trades")}
    out["discount"] = float(kv.get("discount") or 0.10)
    out["sellers"] = sellers
    return out


def main(public_src, settings_src):
    settings = to_settings(read_csv(settings_src))
    rows = read_csv(public_src)
    items = [to_item(dict(zip(rows[0], r)), settings["discount"]) for r in rows[1:]]
    top8 = json.load(open(os.path.join(HERE, "top8.json"), encoding="utf-8"))  # snapshot of Sorcerers Summit Top 8 counts
    data = {"settings": settings, "items": [i for i in items if i], "live": LIVE, "top8": top8}

    read = lambda name: open(os.path.join(HERE, name), encoding="utf-8").read()
    js = read("page.js")
    # Only this exact script may run; sheet data goes in last and with every "<" escaped.
    js_hash = base64.b64encode(hashlib.sha256(js.encode("utf-8")).digest()).decode()
    html = (read("template.html")
            .replace("__PCT__", f"{settings['discount'] * 100:g}")
            .replace("__JS_HASH__", js_hash)
            .replace("__JS__", js)
            .replace("__DATA__", json.dumps(data, separators=(",", ":")).replace("<", "\\u003c")))
    with open(os.path.join(HERE, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print(f"index.html: {len(data['items'])} items, {len(html.encode('utf-8')) / 1024:.1f} KB")


if __name__ == "__main__":
    main(*(sys.argv[1:3] if len(sys.argv) > 2 else (LIVE["items"], LIVE["settings"])))
