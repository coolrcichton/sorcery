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
print(f"\n{len(cases) - failed} of {len(cases)} passed")
sys.exit(1 if failed else 0)
