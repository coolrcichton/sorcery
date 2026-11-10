// Run: node tests/test_pricing.js
const assert = require("assert");
const path = require("path");
const { priceRow, search, parseCsv, toItem, pickFeatured } = require(path.join(__dirname, "..", "page.js"));
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

const evil = toItem({ Status: "Available", Name: "<img src=x onerror=alert(1)>", "TCGplayer Link": "javascript:alert(1)", "Photo URL": "data:text/html,x" }, 0.1);
assert.strictEqual(evil.link, ""); assert.strictEqual(evil.photo, "");
console.log("PASS  non-https links and photos from the sheet are dropped");

const stock = [];
for (let i = 1; i <= 30; i++) stock.push({ id: "F" + i, event: 1000 - i, link: "https://www.tcgplayer.com/product/" + i + "/x" });
const orders = {};
for (let run = 0; run < 50; run++) {
  const ids = pickFeatured(stock).map((i) => i.id);
  assert.strictEqual(ids.length, 10);
  ["F1", "F2", "F3", "F4", "F5"].forEach((id) => assert.ok(ids.includes(id), "top 5 always present"));
  ids.forEach((id) => assert.ok(Number(id.slice(1)) <= 20, "nothing outside the top 20"));
  orders[ids.join()] = 1;
}
assert.ok(Object.keys(orders).length > 40, "order and picks vary between loads");
console.log("PASS  featured: top 5 always in, 5 random from the next 15, varies each load");

console.log("\n" + (failed ? failed + " failed" : "all passed"));
process.exit(failed ? 1 : 0);
