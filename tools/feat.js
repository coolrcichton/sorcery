const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs");
(async () => {
  const [url, pub, set, out] = process.argv.slice(2);
  const pubCsv = fs.readFileSync(pub, "utf8").replace(/^(A035,.*)Available/m, "$1Sold"), setCsv = fs.readFileSync(set, "utf8");
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const ctx = await b.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const bad = []; p.on("pageerror", e => bad.push("ERR " + e)); p.on("console", m => /Content Security|Refused/.test(m.text()) && bad.push(m.text().slice(0, 120)));
  await p.route("**/docs.google.com/**", r => r.fulfill({ body: r.request().url().includes("2131651168") ? pubCsv : setCsv, headers: { "access-control-allow-origin": "*" } }));
  await p.route("**/tcgplayer-cdn.tcgplayer.com/**", r => r.fulfill({ path: "/home/claude/sorcery/icon-180.png" })); // stand-in art
  await p.goto(url); await p.waitForTimeout(900);
  const R = {};
  R.live = await p.$eval("#live", e => e.textContent);
  R.sold = await p.evaluate(() => { const m = document.querySelector('.main[data-id="A035"]'); return { stamped: !!m.querySelector(".stamp"), isButton: m.hasAttribute("role"), inFeatured: !!document.querySelector('.fcard[data-id="A035"]') }; });
  R.badges = await p.evaluate(() => ({ staple: document.querySelectorAll("#list .staple").length, chase: document.querySelectorAll("#list .chase").length }));
  await p.click('#chips button:has-text("Staples")'); R.staplesChip = (await p.$$("#list .row")).length; await p.click('#chips button:has-text("Staples")');
  // sold row does nothing when tapped
  await p.click('.main[data-id="A035"]'); R.soldOpens = (await p.$$("#list .row.open")).length;
  // slide open
  await p.click('.main[data-id="A033"]');
  const h0 = await p.$eval('.row.open .more', e => e.getBoundingClientRect().height); await p.waitForTimeout(450);
  const h1 = await p.$eval('.row.open .more', e => e.getBoundingClientRect().height);
  R.slide = { startHeight: Math.round(h0), endHeight: Math.round(h1), animated: h0 < h1 };
  // drag to tilt
  const box = await p.$eval(".card", e => { const r = e.parentNode.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.evaluate(({ x, y }) => { const c = document.querySelector(".card"); c.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x + 60, clientY: y - 40 })); }, box);
  R.tiltHeld = await p.$eval(".card", e => ({ held: e.classList.contains("held"), transform: e.style.transform, shine: e.style.getPropertyValue("--shine") }));
  await p.evaluate(() => document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })));
  R.tiltReleased = await p.$eval(".card", e => !e.classList.contains("held") && e.style.transform === "");
  await p.screenshot({ path: out + "/polish-open.png" });
  // want list
  await p.click('[data-want="A033"]'); await p.click('.main[data-id="A034"]'); await p.waitForTimeout(400); await p.click('[data-want="A034"]');
  R.bar = await p.$eval("#bar", e => e.innerText.replace(/\n/g, " | "));
  R.barHref = decodeURIComponent(await p.$eval("#bar a", a => a.getAttribute("href"))).slice(0, 260);
  R.wantedMarks = (await p.$$("#list .row.wanted")).length;
  await p.screenshot({ path: out + "/polish-want.png" });
  await p.reload(); await p.waitForTimeout(600);
  R.barAfterReload = await p.$eval("#bar", e => e.innerText.replace(/\n/g, " | "));
  await p.click("#clearwant"); R.barCleared = await p.$eval("#bar", e => e.innerText);
  // sticky filter + layout
  await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(200);
  R.stickyTop = await p.$eval("#tools", e => Math.round(e.getBoundingClientRect().top));
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);
  R.layout = await p.evaluate(() => ({ hscroll: document.documentElement.scrollWidth > innerWidth, under16: [...document.querySelectorAll("body *")].filter(e => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 16).length, tapUnder44: [...document.querySelectorAll("#bar a,#bar button,#chips button,.main[role],.fcard,#filter")].filter(e => e.getBoundingClientRect().height < 44).map(e => e.className || e.id) }));
  await p.screenshot({ path: out + "/polish-top.png" });
  R.problems = bad;
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
