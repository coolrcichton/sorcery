const { chromium } = require("/opt/npm-tools/node_modules/playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await (await b.newContext({ viewport: { width: 320, height: 568 }, isMobile: true })).newPage();
  await p.goto(process.argv[2]);
  console.log(await p.evaluate(() => ({
    over: Math.round(document.querySelectorAll("#list .row")[2].getBoundingClientRect().bottom - document.getElementById("bar").getBoundingClientRect().top),
    headerP: [...document.querySelectorAll("header p")].map(e => Math.round(e.getBoundingClientRect().height)),
    h1: Math.round(document.querySelector("h1").getBoundingClientRect().height), row: Math.round(document.querySelector(".row").getBoundingClientRect().height) })));
  await b.close();
})();
