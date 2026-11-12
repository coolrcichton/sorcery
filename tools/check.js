// Usage: node check.js URL OUTDIR
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
(async () => {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e))); page.on("console", m => m.type() === "error" && errors.push(m.text()));
  // Slow 4G (Chrome DevTools preset) + 4x CPU slowdown
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562.5, downloadThroughput: 1.6e6 / 8 * 0.9, uploadThroughput: 750e3 / 8 * 0.9 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(url, { waitUntil: "load" });
  const r = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    const rows = [...document.querySelectorAll("#list .row")];
    const barTop = document.getElementById("bar").getBoundingClientRect().top;
    const small = [...document.querySelectorAll("body *")].filter(e => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.tagName + ":" + e.textContent.trim().slice(0, 20));
    const taps = [...document.querySelectorAll("a,button,input,.main")].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.tagName + ":" + e.textContent.trim().slice(0, 20) + ":" + Math.round(e.getBoundingClientRect().height));
    return {
      fcp_ms_after_response: fcp ? Math.round(fcp.startTime - nav.responseStart) : null, fcp_ms_total: fcp ? Math.round(fcp.startTime) : null,
      requests: performance.getEntriesByType("resource").length + 1,
      rows: rows.length, rowsFullyAboveBar: rows.filter(x => x.getBoundingClientRect().bottom <= barTop).length,
      hscroll: document.documentElement.scrollWidth > window.innerWidth, scrollWidth: document.documentElement.scrollWidth,
      textUnder16px: small, tapUnder44px: taps, firstRows: rows.slice(0, 4).map(x => x.innerText.replace(/\n/g, " | ")),
      bar: document.getElementById("bar").innerHTML, placeholder: document.getElementById("filter").placeholder,
      chips: [...document.querySelectorAll("#chips button")].map(b => b.textContent),
    };
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.screenshot({ path: out + "/first-screen.png" });
  const type = async q => { await page.fill("#filter", ""); await page.type("#filter", q); return page.$$eval("#list .name", n => n.map(x => x.textContent)); };
  r.filter_arthr = await type("arthr");
  r.filter_empty = await type("black lotus");
  r.emptyText = await page.$eval("#empty", e => e.innerText.replace(/\n+/g, " | ").slice(0, 300));
  await page.screenshot({ path: out + "/empty.png" });
  await page.fill("#filter", "");
  await page.click('#chips button:has-text("Foil")'); r.chipFoil = (await page.$$("#list .row")).length;
  await page.click('#chips button:has-text("Foil")'); r.chipFoilCleared = (await page.$$("#list .row")).length;
  await page.click("#list .main >> nth=1");
  r.expanded = await page.$eval("#list .row.open .more", e => ({ text: e.innerText.replace(/\n+/g, " | "), hrefs: [...e.querySelectorAll("a")].map(a => a.getAttribute("href")) }));
  r.hscrollExpanded = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.screenshot({ path: out + "/expanded.png" });
  r.errors = errors;
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
