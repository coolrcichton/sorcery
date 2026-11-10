// Run: node tests/test_pricing.js
const assert = require("assert");
const path = require("path");
const { priceRow, search, parseCsv } = require(path.join(__dirname, "..", "page.js"));
const cases = require("./pricing_cases.json");

let failed = 0;
for (const c of cases) {
  let ok = true;
  try { assert.deepStrictEqual(priceRow(c.row, 0.10), c.want); } catch (e) { ok = false; }
  failed += !ok;
  console.log((ok ? "PASS  " : "FAIL  ") + c.name);
}

// Filter checks
const items = [
  { id: "1", name: "King Arthur", set: "Promo", finish: "Foil", type: "Card", notes: "Dust Reward Promo" },
  { id: "2", name: "Ring of Morrigan", set: "Arthurian Legends", finish: "Standard", type: "Card", notes: "" },
  { id: "3", name: "Lifewish", set: "Gothic", finish: "Foil", type: "Card", notes: "" }
];
const names = (q) => search(items, q).hits.map((i) => i.name);
const filterCases = [
  ["arthr", ["King Arthur", "Ring of Morrigan"]], // second hit is in the Arthurian Legends set
  ["king arthur", ["King Arthur"]],
  ["KING-ARTHUR!", ["King Arthur"]],
  ["gothic foil", ["Lifewish"]],
  ["dust", ["King Arthur"]],
  ["morigan", ["Ring of Morrigan"]],
  ["zzzzzz", []]
];
for (const [q, want] of filterCases) {
  let ok = true;
  try { assert.deepStrictEqual(names(q), want); } catch (e) { ok = false; }
  failed += !ok;
  console.log((ok ? "PASS  " : "FAIL  ") + 'filter "' + q + '" -> ' + JSON.stringify(names(q)));
}
assert.strictEqual(search(items, "zzzzzz").closest.length, 3);

assert.deepStrictEqual(parseCsv('a,b\r\n"x, ""y""",2\n"line\nbreak",\n'), [["a", "b"], ['x, "y"', "2"], ["line\nbreak", ""]]);
console.log("PASS  parseCsv handles quotes, commas and line breaks");

console.log("\n" + (failed ? failed + " failed" : "all passed"));
process.exit(failed ? 1 : 0);
