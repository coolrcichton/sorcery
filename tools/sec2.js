const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs");
(async () => {
  const [url, pub, set] = process.argv.slice(2);
  // Hostile sheet: an ID that breaks selectors, a look-alike TCGplayer link, a counter URL pointing elsewhere
  const pubCsv = fs.readFileSync(pub, "utf8").replace(/^A033,/m, '"A0""]33",').replace(/^(A034,.*?),https:[^,]*,/m, "$1,https://evil.example/tcgplayer.com/x,");
  const setCsv = fs.readFileSync(set, "utf8") + "views_url,https://evil.example/collect\r\n";
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const ctx = await b.newContext({ viewport: { width: 375, height: 667 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("want", JSON.stringify([{ evil: 1 }, "A034", 7, "x".repeat(5000)])); localStorage.setItem("seen", "not json"); } catch (e) {} });
  const p = await ctx.newPage(); const errs = [], reqs = [];
  p.on("pageerror", e => errs.push(String(e).slice(0, 100))); p.on("request", r => { const h = new URL(r.url()).host; if (!/localhost/.test(h)) reqs.push(h); });
  await p.route("**/docs.google.com/**", r => r.fulfill({ body: r.request().url().includes("2131651168") ? pubCsv : setCsv, headers: { "access-control-allow-origin": "*" } }));
  await p.route("**/script.google.com/**", r => r.fulfill({ body: JSON.stringify({ A034: 999999, A006: 12, A007: "9", A008: -4, A009: 1e400 }), contentType: "application/json", headers: { "access-control-allow-origin": "*" } }));
  await p.route("**/tcgplayer-cdn.tcgplayer.com/**", r => r.abort());
  await p.goto(url); await p.waitForTimeout(900);
  await p.click('.main[data-id="A034"]'); await p.waitForTimeout(450);
  const odd = await p.$('.main[data-id="A0\\"]33"]'); await odd.click(); await p.waitForTimeout(450);
  await p.click(".row.open [data-want]"); await p.waitForTimeout(100);
  const R = await p.evaluate(() => ({ bar: document.getElementById("bar").innerText.replace(/\n/g, " | "), wantedRows: document.querySelectorAll(".row.wanted").length, lookalikeLinkShown: !!document.querySelector('a[href*="evil.example"]'), views: Object.fromEntries([...document.querySelectorAll("[data-views]")].filter(e => e.textContent).map(e => [e.dataset.views, e.textContent.trim()])) }));
  console.log(JSON.stringify(R), "| hosts contacted:", [...new Set(reqs)].join(", "), "| page errors:", errs.length ? errs : "none");
  // framed copy refuses to run
  const f = await ctx.newPage(); await f.setContent('<iframe src="' + url + '" width=375 height=600></iframe>'); await f.waitForTimeout(700);
  console.log("inside a frame:", JSON.stringify(await f.frames()[1].evaluate(() => ({ rows: document.querySelectorAll(".row").length, text: document.body.innerText.slice(0, 40) }))));
  await b.close();
})();
