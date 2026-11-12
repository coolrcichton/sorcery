const { chromium } = require("/opt/npm-tools/node_modules/playwright");
(async () => {
  const [url, out] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  for (const [w, h] of [[390, 844], [375, 667], [320, 568]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true })).newPage();
    await p.goto(url);
    const r = await p.evaluate(() => { const bar = document.getElementById("bar").getBoundingClientRect().top; return { rowsAboveFold: [...document.querySelectorAll("#list .row")].filter(x => x.getBoundingClientRect().bottom <= bar).length, hscroll: document.documentElement.scrollWidth > innerWidth, tapUnder44: [...document.querySelectorAll("a,button,input,.main")].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).length }; });
    console.log(w + "x" + h, JSON.stringify(r));
    await p.screenshot({ path: `${out}/top-${w}.png` });
  }
  await b.close();
})();
