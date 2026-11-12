const { chromium } = require("/opt/npm-tools/node_modules/playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await (await b.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto(process.argv[2]);
  const info = () => p.evaluate(() => { const f = document.getElementById("feat"); return { x: Math.round(f.scrollLeft), cards: f.children.length, loopW: f.children[f.children.length / 2].offsetLeft - f.children[0].offsetLeft, max: f.scrollWidth - f.clientWidth }; });
  const a = await info(); await p.waitForTimeout(2000); const c = await info();
  console.log("start", a, "after 2s", c.x, "-> drifting:", c.x > a.x + 30);
  // jump near the end of the first copy and watch it wrap
  await p.evaluate(() => { const f = document.getElementById("feat"); f.dispatchEvent(new Event("pointerdown")); f.scrollLeft = (f.children[f.children.length / 2].offsetLeft - f.children[0].offsetLeft) - 20; });
  await p.waitForTimeout(3500); const d1 = await info(); await p.waitForTimeout(1500); const d2 = await info();
  console.log("near end after pause:", d1.x, "then:", d2.x, "-> wrapped:", d2.x < 100, "| room to wrap:", a.max >= a.loopW);
  // tap pauses
  await p.evaluate(() => document.getElementById("feat").dispatchEvent(new Event("touchstart")));
  const e1 = await info(); await p.waitForTimeout(1000); const e2 = await info();
  console.log("paused on touch:", e1.x === e2.x, "| hscroll page:", await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), "| errors:", errs.length);
  await b.close();
})();
