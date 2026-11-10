"""Run: python3 tests/test_pricing.py"""
import json, os, sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from pricing import price_row

cases = json.load(open(os.path.join(os.path.dirname(__file__), "pricing_cases.json")))
failed = 0
for c in cases:
    got = price_row(c["row"], 0.10)
    ok = got == c["want"]
    failed += not ok
    print(("PASS  " if ok else "FAIL  ") + c["name"] + ("" if ok else f"\n      got  {got}\n      want {c['want']}"))
from build import to_item
evil = to_item({"Status": "Available", "Name": "x", "TCGplayer Link": "javascript:alert(1)", "Photo URL": "data:text/html,x"}, 0.1)
assert evil["link"] == "" and evil["photo"] == ""
assert to_item({"Status": "Available", "Name": "x", "TCGplayer Link": "https://evil.example/tcgplayer.com/"}, 0.1)["link"] == ""
assert to_item({"Status": "Available", "Name": "x", "TCGplayer Link": "https://www.tcgplayer.com/product/1/x?utm=1"}, 0.1)["link"] == "https://www.tcgplayer.com/product/1/x"
print("PASS  non-https links and photos from the sheet are dropped")
print(f"\n{len(cases) - failed} of {len(cases)} passed")
sys.exit(1 if failed else 0)
