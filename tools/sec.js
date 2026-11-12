const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs");
(async () => {
  const [url, pub, set] = process.argv.slice(2);
  let pubCsv = fs.readFileSync(pub, "utf8"); const setCsv = fs.readFileSync(set, "utf8");
  // Hostile sheet: script in a name, javascript: link, script-y notes and settings
  pubCsv = pubCsv.replace(/^A035,Card,King Arthur,(.*?),https:[^,]*,/m, 'A035,Card,"<img src=x onerror=window.pwned=1><script>window.pwned=2</script>",$1,javascript:window.pwned=3,');
  const evilSet = setCsv.replace("location_now,", 'location_now,"<script>window.pwned=4</script>"').replace("+18022942383", '"+1802""><script>window.pwned=5</script>"');
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await (await b.newContext({ viewport: { width: 375, height: 700 } })).newPage();
  const csp = []; p.on("console", m => /Content Security Policy|Refused/.test(m.text()) && csp.push(m.text().slice(0, 140)));
  let dialog = false; p.on("dialog", d => { dialog = true; d.dismiss(); });
  await p.route("**/docs.google.com/**", r => r.fulfill({ body: r.request().url().includes("2131651168") ? pubCsv : evilSet, headers: { "access-control-allow-origin": "*" } }));
  await p.route("**/tcgplayer-cdn.tcgplayer.com/**", r => r.abort());
  await p.goto(url); await p.waitForTimeout(800);
  await p.click("#list .main >> nth=0"); await p.waitForTimeout(300);
  console.log(JSON.stringify(await p.evaluate(() => ({
    rows: document.querySelectorAll("#list .row").length, pwned: window.pwned === undefined ? "no" : window.pwned,
    firstName: document.querySelector("#list .name").textContent.slice(0, 60), injectedTags: document.querySelectorAll("#list script, #list img[onerror], header script").length,
    links: [...document.querySelectorAll("#list .row.open a")].map(a => a.getAttribute("href").slice(0, 40)), where: document.getElementById("where").textContent, bar: document.getElementById("bar").innerHTML.slice(0, 60),
  })), null, 1), { dialog, csp });
  // And: does CSP stop an injected inline script even if escaping had failed?
  const blocked = await p.evaluate(() => { const s = document.createElement("script"); s.textContent = "window.pwned='inline ran'"; document.body.appendChild(s); const i = document.createElement("img"); i.setAttribute("onerror", "window.pwned='handler ran'"); i.src = "data:image/png;base64,xx"; document.body.appendChild(i); return new Promise(r => setTimeout(() => r(window.pwned === undefined ? "blocked" : window.pwned), 300)); });
  console.log("injected script under CSP:", blocked);
  await b.close();
})();
