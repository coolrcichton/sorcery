const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs");
(async () => {
  const [url, pub, set] = process.argv.slice(2);
  const pubCsv = fs.readFileSync(pub, "utf8"), setCsv = fs.readFileSync(set, "utf8");
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const run = async (name, handler) => {
    const p = await (await b.newContext({ viewport: { width: 375, height: 700 }, isMobile: true })).newPage();
    const errs = []; p.on("pageerror", e => errs.push(String(e)));
    const snap = []; 
    await p.route("**/docs.google.com/**", handler);
    await p.goto(url, { waitUntil: "domcontentloaded" });
    const before = await p.$$eval("#list .name", n => n.length);
    const strip0 = await p.$$eval(".fcard", n => n.map(x => x.dataset.id).join());
    await p.evaluate(() => { document.querySelector("#list .row").dataset.mark = "kept"; });
    await p.waitForTimeout(1200);
    const strip1 = await p.$$eval(".fcard", n => n.map(x => x.dataset.id).join());
    const rerendered = !(await p.evaluate(() => document.querySelector("#list .row").dataset.mark));
    console.log(name, "strip unchanged:", strip0 === strip1, "| list re-rendered:", rerendered);
    const r = await p.evaluate(() => ({ rows: document.querySelectorAll("#list .row").length, first: document.querySelector("#list .name").textContent, where: document.getElementById("where").textContent, hasPromoArthur: [...document.querySelectorAll("#list .main")].some(e => e.dataset.id === "A035") }));
    console.log(name, JSON.stringify({ atFirstPaint: before, ...r, errs }));
    await p.close();
  };
  await run("same data      ", r => r.fulfill({ body: r.request().url().includes("2131651168") ? pubCsv : setCsv, headers: { "access-control-allow-origin": "*" } }));
  await run("A035 marked Sold", r => r.fulfill({ body: r.request().url().includes("2131651168") ? pubCsv.replace(/^(A035,.*)Available/m, "$1Sold") : setCsv.replace("location_now,", "location_now,Lobby tables until 3pm"), headers: { "access-control-allow-origin": "*" } }));
  await run("Google blocked  ", r => r.abort());
  await run("Google returns junk", r => r.fulfill({ body: "<html>Sorry</html>", headers: { "access-control-allow-origin": "*" } }));
  await b.close();
})();
