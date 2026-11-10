"use strict";

// ---- Pricing: port of pricing.py, keep the two in step. Both run tests/pricing_cases.json. ----
function num(v) {
  const n = Number(String(v == null ? "" : v).replace(/[$,]/g, "").trim());
  return n > 0 ? n : null;
}

function priceRow(row, discount) {
  const status = String(row["Status"] || "").trim();
  const qty = String(row["Qty"] == null ? "" : row["Qty"]).trim();
  const visible = (status === "Available" || status === "Hold") && qty !== "0";
  const market = num(row["Market Price"]);
  const ebay = num(row["eBay Sold"]);
  const asking = num(row["Asking Price"]);

  // Reference: the higher of the two real online prices, named by source.
  let reference = null, source = null;
  if (market && ebay) {
    if (ebay > market) { reference = ebay; source = "eBay"; } else { reference = market; source = "TCG"; }
  } else if (market) { reference = market; source = "TCG"; }
  else if (ebay) { reference = ebay; source = "eBay"; }

  const base = asking || reference;
  const event = base == null ? null : Math.floor(base * (1 - discount) + 0.5); // nearest dollar, halves up

  let saving = null;
  if (reference != null && event != null) {
    const s = Math.floor(reference - event);
    if (s >= 1) saving = s;
  }
  return { visible: visible, hold: status === "Hold", reference: reference, source: source, event: event, saving: saving };
}

// ---- Sheet rows to page data: ports of to_item and to_settings in build.py ----
// Sheet cells that become links or image sources must be plain https URLs (blocks javascript: and the like).
function httpsUrl(u) { return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ""; }

function toItem(row, discount) {
  const g = function (k) { return String(row[k] == null ? "" : row[k]).trim(); };
  const p = priceRow(row, discount);
  const sold = g("Status") === "Sold"; // shown greyed out with a SOLD stamp; Hidden removes a row entirely
  if ((!p.visible && !sold) || !g("Name")) return null;
  return {
    sold: sold,
    id: g("ID"), type: g("Type"), name: g("Name"), set: g("Set"), finish: g("Finish"),
    cond: g("Condition") || "NM", // owner's call: blank means Near Mint
    qty: g("Qty") ? Math.trunc(Number(g("Qty"))) : 1,
    link: httpsUrl(g("TCGplayer Link").split("?")[0]),
    photo: httpsUrl(g("Photo URL")), notes: g("Notes"),
    featured: g("Featured").toUpperCase() === "Y", hold: p.hold,
    ref: p.reference, src: p.source, event: p.event, saving: p.saving
  };
}

function toSettings(pairs) {
  const kv = {};
  pairs.slice(1).forEach(function (r) { if (r.length > 1 && r[0].trim()) kv[r[0].trim()] = r[1].trim(); });
  const sellers = [];
  for (let n = 1; kv["seller" + n + "_name"]; n++) {
    const s = {};
    ["name", "sms", "whatsapp", "discord"].forEach(function (k) { s[k] = kv["seller" + n + "_" + k] || ""; });
    sellers.push(s);
  }
  const out = { discount: Number(kv.discount) || 0.10, sellers: sellers };
  ["location_now", "banner", "payment_methods", "trades"].forEach(function (k) { out[k] = kv[k] || ""; });
  return out;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---- Filter ----
function norm(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function lev(a, b) {
  let prev = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function hay(it) {
  return it._h || (it._h = norm([it.name, it.set, it.finish, it.type, it.notes].join(" ")));
}

// Substring match first, then a typo allowance per word: 1 edit for 5 letters, 2 for longer.
// Words are also compared by prefix so a half-typed word still matches.
function match(it, tokens) {
  const h = hay(it), words = h.split(" ");
  let ok = true, dist = 0;
  for (const t of tokens) {
    if (h.includes(t)) continue;
    let best = 99;
    for (const w of words) best = Math.min(best, lev(t, w), lev(t, w.slice(0, t.length)));
    dist += best;
    if (t.length < 5 || best > (t.length < 6 ? 1 : 2)) ok = false;
  }
  return { ok: ok, dist: dist };
}

function search(items, query) {
  const tokens = norm(query).split(" ").filter(Boolean);
  if (!tokens.length) return { hits: items, closest: [] };
  // Name matches rank above matches that only hit the set, finish, type or notes.
  const scored = items.map(function (it, i) {
    const m = match(it, tokens);
    return { it: it, i: i, ok: m.ok, dist: m.dist, inName: match({ _h: norm(it.name) }, tokens).ok ? 0 : 1 };
  });
  const byDist = function (a, b) { return a.inName - b.inName || a.dist - b.dist || a.i - b.i; };
  const hits = scored.filter(function (s) { return s.ok; }).sort(byDist).map(function (s) { return s.it; });
  const closest = hits.length ? [] : scored.sort(byDist).slice(0, 3).map(function (s) { return s.it; });
  return { hits: hits, closest: closest };
}

function defaultSort(items) {
  return items.slice().sort(function (a, b) {
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.event == null ? -1 : b.event) - (a.event == null ? -1 : a.event);
  });
}

const STAPLE = 100; // Top 8 decks needed for the "Staple" badge
const CHASE = 100;  // event price needed for the "Chase" badge

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Featured strip: always the 5 priciest items, plus 5 picked at random from the next 15, in a fresh order each load.
function pickFeatured(items) {
  const byPrice = items.filter(function (i) { return !i.sold && i.event != null && artUrl(i, 200); })
    .sort(function (a, b) { return b.event - a.event; });
  return shuffle(byPrice.slice(0, 5).concat(shuffle(byPrice.slice(5, 20)).slice(0, 5)));
}

function chipDefs(items) {
  const defs = [
    { key: "staples", label: "Staples", test: function (i) { return i.top8 >= STAPLE; } },
    { key: "playmats", label: "Playmats", test: function (i) { return i.type === "Playmat"; } },
    { key: "foil", label: "Foil", test: function (i) { return /foil/i.test(i.finish); } },
    { key: "promo", label: "Promo", test: function (i) { return i.set === "Promo"; } },
    { key: "100plus", label: "$100+", test: function (i) { return i.event != null && i.event >= 100; } }
  ];
  const sets = {};
  items.forEach(function (i) { if (i.set && i.set !== "Promo") sets[i.set] = 1; });
  Object.keys(sets).sort().forEach(function (s) {
    defs.push({ key: "set:" + s, label: s, test: function (i) { return i.set === s; } });
  });
  return defs.filter(function (d) { return items.some(d.test); });
}

// ---- Contact ----
function contact(settings) { return (settings.sellers || [])[0] || {}; }

function describe(it) {
  const bits = [it.set, it.finish && it.finish !== "Standard" ? it.finish : "", it.cond].filter(Boolean).join(", ");
  return it.name + (bits ? " (" + bits + ")" : "") + (it.event != null ? " at $" + it.event : "");
}

function wantText(it) {
  return "Hi, I saw your Sorcery list and I'm interested in: " + describe(it) + " [" + it.id + "]. Where can we meet off the event floor?";
}

const GENERIC_TEXT = "Hi, I saw your Sorcery list. I'm looking for: ";

function smsHref(number, text) { return "sms:" + number + "?&body=" + encodeURIComponent(text); }
function waHref(number, text) { return "https://wa.me/" + String(number).replace(/\D/g, "") + "?text=" + encodeURIComponent(text); }

// Card art: the seller's own photo if there is one, else TCGplayer's product image for that exact printing.
function artUrl(it, size) {
  if (it.photo) return it.photo;
  const m = /\/product\/(\d+)/.exec(it.link || "");
  return m ? "https://tcgplayer-cdn.tcgplayer.com/product/" + m[1] + "_" + size + "w.jpg" : "";
}

// ---- Page ----
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function prettyPhone(n) {
  const d = String(n).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6) : n;
}

function contactButtons(settings, text, label) {
  const s = contact(settings);
  const sms = /^\+?\d{7,15}$/.test(String(s.sms || "").replace(/[\s().-]/g, "")) ? String(s.sms).replace(/[\s().-]/g, "") : "";
  let h = "";
  if (sms) h += '<a class="btn" href="' + esc(smsHref(sms, text)) + '">' + esc(label) + "</a>";
  if (s.whatsapp) h += '<a class="btn alt" href="' + esc(waHref(s.whatsapp, text)) + '">WhatsApp</a>';
  return h;
}

function top8Text(it) {
  return "\uD83C\uDFC6 In <b>" + it.top8 + "</b> Top 8 deck" + (it.top8 > 1 ? "s" : "") + "!";
}

function badges(it) {
  return (it.top8 >= STAPLE ? ' <span class="badge staple">Staple</span>' : "") +
    (it.event != null && it.event >= CHASE ? ' <span class="badge chase">Chase</span>' : "");
}

function wantLabel(wanted) { return wanted ? "✓ On my list" : "+ Add to my list"; }

// The panel under an opened row.
function moreHtml(it, settings, wanted) {
  let h = '<div class="more"><div class="morein">';
  const art = artUrl(it, 400);
  if (art) h += '<div class="stage"><div class="card' + (/foil/i.test(it.finish) ? " shiny" : "") + '"><img src="' + esc(art) +
    '" alt="' + esc(it.name) + '" draggable="false"></div></div>';
  if (it.notes) h += "<p>" + esc(it.notes) + "</p>";
  if (it.top8 && settings.top8) h += '<p class="t8big">' + top8Text(it) + '<span class="credit">Tracked by <a href="' + esc(settings.top8.source) +
    '" target="_blank" rel="noopener noreferrer">Sorcerers Summit</a></span></p>';
  h += '<p class="acts">' + contactButtons(settings, wantText(it), "I want this") +
    '<button type="button" class="btn ghost" data-want="' + esc(it.id) + '">' + wantLabel(wanted) + "</button></p>";
  if (it.link) h += '<p class="links"><a href="' + esc(it.link) + '" target="_blank" rel="noopener noreferrer">Check on TCGplayer</a></p>';
  return h + "</div></div>";
}

function rowHtml(it, settings, open, wanted) {
  const shiny = /foil/i.test(it.finish);
  const meta = [esc(it.set), shiny ? '<span class="foil">' + esc(it.finish) + "</span>" : "", esc(it.cond), it.qty > 1 ? "×" + it.qty : ""]
    .filter(Boolean).join(" · ");
  const small = artUrl(it, 200);
  let price = "";
  if (it.sold) price = '<span class="stamp">SOLD</span>';
  else {
    if (it.ref != null) price += '<div class="ref">' + esc(it.src) + " $" + it.ref.toFixed(2) + "</div>";
    price += '<div class="ev">' + (it.event != null ? "$" + it.event : "Ask") + "</div>";
    if (it.saving != null) price += '<div class="save">Save $' + it.saving + "</div>";
  }
  // Sold rows are not buttons: there is nothing to open.
  const attrs = it.sold ? "" : ' role="button" tabindex="0" aria-expanded="' + (open ? "true" : "false") + '"';
  return '<li class="row' + (open ? " open" : "") + (it.sold ? " sold" : "") + (wanted ? " wanted" : "") + '">' +
    '<div class="main"' + attrs + ' data-id="' + esc(it.id) + '">' +
    (small ? '<img class="thumb" src="' + esc(small) + '" alt="" width="52" height="52" loading="lazy">' : '<span class="thumb"></span>') +
    '<div class="info"><div class="name">' + esc(it.name) + (it.sold ? "" : badges(it)) + '</div><div class="meta">' + meta +
    (it.hold ? ' <span class="hold">On hold</span>' : "") + "</div>" +
    (it.top8 ? '<div class="t8">' + top8Text(it) + "</div>" : "") + "</div>" +
    '<div class="price">' + price + "</div></div>" + (open && !it.sold ? moreHtml(it, settings, wanted) : "") + "</li>";
}

// clone: a second copy of the strip that makes the loop seamless; hidden from screen readers and the tab key.
function featuredHtml(picks, clone) {
  return picks.map(function (it) {
    return "<li" + (clone ? ' aria-hidden="true"' : "") + '><button type="button" class="fcard" data-id="' + esc(it.id) + '"' + (clone ? ' tabindex="-1"' : "") + ">" +
      '<span class="fart' + (/foil/i.test(it.finish) ? " shiny" : "") + '"><img src="' + esc(artUrl(it, 200)) + '" alt="" width="100" height="140" loading="lazy"></span>' +
      '<span class="fname">' + esc(it.name) + '</span><span class="fprice">$' + it.event + "</span></button></li>";
  }).join("");
}

function init() {
  const data = JSON.parse(document.getElementById("data").textContent);
  // Tournament counts are per card name, so every printing of a card shares one number.
  const top8 = {};
  Object.keys((data.top8 || {}).cards || {}).forEach(function (n) { top8[norm(n)] = data.top8.cards[n]; });
  function tag(list, st) {
    list.forEach(function (it) { it.top8 = top8[norm(it.name)] || 0; });
    st.top8 = data.top8;
    return list;
  }
  let settings = data.settings;
  let items = defaultSort(tag(data.items, settings));
  let chip = "", query = "", openId = "", liveOk = false;
  const avail = function () { return items.filter(function (i) { return !i.sold; }); };
  const byId = function (id) { return items.filter(function (i) { return i.id === id; })[0]; };

  // Want list: ids the buyer picked, kept across reloads on their own phone when the browser allows it.
  let want = [];
  try { want = JSON.parse(localStorage.getItem("want") || "[]"); } catch (e) {}
  if (!Array.isArray(want)) want = [];
  const wanted = function (id) { return want.indexOf(id) >= 0; };
  function saveWant() { try { localStorage.setItem("want", JSON.stringify(want)); } catch (e) {} }

  const $ = function (id) { return document.getElementById(id); };
  const list = $("list"), chipsEl = $("chips"), filter = $("filter"), empty = $("empty");

  function renderChips() {
    const defs = chipDefs(avail());
    chipsEl.innerHTML = '<button type="button" data-chip=""' + (chip === "" ? ' aria-pressed="true"' : "") + ">All</button>" +
      defs.map(function (d) {
        return '<button type="button" data-chip="' + esc(d.key) + '"' + (chip === d.key ? ' aria-pressed="true"' : "") + ">" + esc(d.label) + "</button>";
      }).join("");
  }

  function render() {
    const def = chipDefs(avail()).filter(function (d) { return d.key === chip; })[0];
    const pool = def ? items.filter(def.test) : items;
    const res = search(pool, query);
    list.innerHTML = res.hits.map(function (it) { return rowHtml(it, settings, it.id === openId, wanted(it.id)); }).join("");
    if (res.hits.length) {
      empty.hidden = true;
    } else {
      const closest = query ? search(avail(), query).closest : [];
      empty.hidden = false;
      empty.innerHTML = "<p>Not on the list. We have more in the binder, text us what you need.</p>" +
        '<p class="acts">' + contactButtons(settings, GENERIC_TEXT + query, "Text us") + "</p>" +
        (closest.length ? "<p>Closest matches:</p><ul>" +
          closest.map(function (it) { return rowHtml(it, settings, false, wanted(it.id)); }).join("") + "</ul>" : "");
    }
    const n = avail().length;
    filter.placeholder = "Filter " + n + " items" + (items[0] ? ", e.g. " + items[0].name : "");
    $("live").innerHTML = '<span class="dot' + (liveOk ? " on" : "") + '"></span>' + n + " item" + (n === 1 ? "" : "s") + (liveOk ? ", updated live" : "");
  }

  // Bottom bar: a plain "Text us", or one message covering everything on the want list.
  function renderBar() {
    const w = avail().filter(function (i) { return wanted(i.id); });
    if (!w.length) { $("bar").innerHTML = contactButtons(settings, GENERIC_TEXT, "Text us"); return; }
    const total = w.reduce(function (n, i) { return n + (i.event || 0); }, 0);
    const text = "Hi, I saw your Sorcery list and I'm interested in: " +
      w.map(function (i) { return describe(i) + " [" + i.id + "]"; }).join("; ") +
      (w.length > 1 ? ". Total $" + total : "") + ". Where can we meet off the event floor?";
    $("bar").innerHTML = contactButtons(settings, text, "Message about " + w.length + " item" + (w.length > 1 ? "s" : "") + " · $" + total) +
      '<button type="button" class="btn ghost" id="clearwant">Clear</button>';
  }

  function toggleWant(id) {
    want = wanted(id) ? want.filter(function (x) { return x !== id; }) : want.concat(id);
    saveWant();
    Array.prototype.forEach.call(document.querySelectorAll('.main[data-id="' + id + '"]'), function (m) {
      m.parentNode.classList.toggle("wanted", wanted(id));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-want="' + id + '"]'), function (b) { b.textContent = wantLabel(wanted(id)); });
    renderBar();
  }

  // The featured strip drifts sideways and loops forever. Touching it pauses the drift for a few seconds.
  const feat = $("feat");
  const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let loopW = 0, pos = 0, pausedUntil = 0, featSeen = true, lastTick = 0;

  function renderFeatured() {
    const picks = pickFeatured(items);
    $("featwrap").hidden = picks.length < 3;
    feat.innerHTML = featuredHtml(picks, false) + featuredHtml(picks, true);
    loopW = picks.length < 3 ? 0 : feat.children[picks.length].offsetLeft - feat.children[0].offsetLeft;
    pos = feat.scrollLeft = 0;
  }

  function drift(now) {
    const dt = Math.min(now - lastTick, 100);
    lastTick = now;
    if (loopW && featSeen) {
      const held = now < pausedUntil;
      if (held) pos = feat.scrollLeft;      // follow the finger
      else if (!still) pos += dt * 0.03;    // about 30 px a second
      if (pos >= loopW) pos -= loopW;       // wrap forwards
      else if (held && pos <= 0) pos += loopW; // wrap backwards when swiped past the start
      if (Math.abs(feat.scrollLeft - pos) >= 0.5) feat.scrollLeft = pos;
    }
    requestAnimationFrame(drift);
  }
  ["pointerdown", "touchstart", "touchmove", "touchend", "wheel"].forEach(function (ev) {
    feat.addEventListener(ev, function () { pausedUntil = performance.now() + 3000; }, { passive: true });
  });
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (en) { featSeen = en[0].isIntersecting; }).observe(feat);
  }

  // Tapping a featured card opens that card in the list below.
  function openFromFeatured(id) {
    query = ""; filter.value = ""; chip = ""; openId = id;
    renderChips(); render();
    const open = list.querySelector(".row.open");
    if (open) open.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeRow(li) {
    li.classList.remove("open");
    li.querySelector(".main").setAttribute("aria-expanded", "false");
    const m = li.querySelector(".more");
    if (m) setTimeout(function () { if (!li.classList.contains("open")) m.remove(); }, 320); // after the slide
  }

  function openRow(li, it) {
    const old = li.querySelector(".more");
    if (old) old.remove();
    li.insertAdjacentHTML("beforeend", moreHtml(it, settings, wanted(it.id)));
    void li.offsetHeight; // lay it out closed first, so the slide has somewhere to start
    li.classList.add("open");
    li.querySelector(".main").setAttribute("aria-expanded", "true");
  }

  function toggle(target) {
    const main = target.closest(".main");
    if (!main || !main.hasAttribute("role")) return; // sold rows don't open
    const id = main.dataset.id;
    if (!empty.hidden) { openFromFeatured(id); return; } // a "closest match": clear the failed filter and open it
    const was = list.querySelector(".row.open");
    if (was) closeRow(was);
    if (openId === id) { openId = ""; return; }
    openId = id;
    const li = main.parentNode;
    openRow(li, byId(id));
    setTimeout(function () { li.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 330);
  }

  // Drag across an opened card and it tilts under the finger, shine following.
  let heldCard = null;
  function tilt(e) {
    const st = heldCard.parentNode.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - (st.left + st.width / 2)) / heldCard.offsetWidth + 0.5));
    const y = Math.min(1, Math.max(0, (e.clientY - (st.top + st.height / 2)) / heldCard.offsetHeight + 0.5));
    heldCard.style.transform = "rotateY(" + ((x - 0.5) * 36).toFixed(1) + "deg) rotateX(" + ((0.5 - y) * 24).toFixed(1) + "deg)";
    heldCard.style.setProperty("--shine", Math.round(100 - x * 100) + "%");
  }
  list.addEventListener("pointerdown", function (e) {
    const c = e.target.closest(".card");
    if (!c) return;
    heldCard = c; c.classList.add("held"); tilt(e);
  });
  document.addEventListener("pointermove", function (e) { if (heldCard) tilt(e); });
  ["pointerup", "pointercancel"].forEach(function (ev) {
    document.addEventListener(ev, function () {
      if (!heldCard) return;
      heldCard.classList.remove("held"); heldCard.style.transform = ""; heldCard = null;
    });
  });

  // Art that fails to load: drop the big card, blank the thumbnail.
  document.addEventListener("error", function (e) {
    const t = e.target;
    if (!t || t.tagName !== "IMG") return;
    const stage = t.closest(".stage");
    if (stage) stage.remove(); else t.removeAttribute("src");
  }, true);

  filter.addEventListener("input", function () { query = filter.value; render(); });
  chipsEl.addEventListener("click", function (e) {
    const b = e.target.closest("button");
    if (!b) return;
    chip = chip === b.dataset.chip ? "" : b.dataset.chip;
    renderChips(); render();
  });
  document.addEventListener("click", function (e) {
    const f = e.target.closest(".fcard"), w = e.target.closest("[data-want]");
    if (f) openFromFeatured(f.dataset.id);
    else if (w) toggleWant(w.dataset.want);
    else if (e.target.closest("#clearwant")) { want = []; saveWant(); render(); renderBar(); }
    else if (!e.target.closest("a")) toggle(e.target);
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("main")) { e.preventDefault(); toggle(e.target); }
  });

  // Header details from settings
  function applySettings() {
    const s1 = contact(settings);
    $("pct").textContent = Math.round(settings.discount * 100);
    $("where").textContent = settings.location_now ? "Find us: " + settings.location_now : "";
    $("banner").textContent = settings.banner || "";
    renderBar();
    $("pay").textContent = (settings.payment_methods ? "We take " + settings.payment_methods + ". " : "") +
      (settings.trades === "Y" ? "Trades welcome." : "");
    $("plain").textContent = [s1.sms ? "Text " + prettyPhone(s1.sms) : "", s1.discord ? "Discord: " + s1.discord : ""].filter(Boolean).join(" · ");

  }

  // After first paint, re-read the published sheet. If it fails, the baked snapshot stays.
  // Compare what matters, in a fixed order, so the baked snapshot and a live read of the same sheet look identical.
  function sigItems(list) {
    return JSON.stringify(list.map(function (i) {
      return [i.id, i.type, i.name, i.set, i.finish, i.cond, i.qty, i.link, i.photo, i.notes, i.featured, i.hold, i.sold, i.ref, i.src, i.event, i.saving];
    }));
  }
  function sigSettings(st) {
    return JSON.stringify([st.discount, st.location_now, st.banner, st.payment_methods, st.trades, contact(st).sms, contact(st).whatsapp, contact(st).discord]);
  }
  let shownItems = sigItems(data.items), shownSettings = sigSettings(settings);
  function refresh() {
    if (!data.live) return;
    const get = function (u) {
      return fetch(u, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); });
    };
    Promise.all([get(data.live.items), get(data.live.settings)]).then(function (texts) {
      const rows = parseCsv(texts[0]), head = rows[0] || [], pairs = parseCsv(texts[1]);
      if (head.indexOf("ID") < 0 || head.indexOf("Status") < 0 || (pairs[0] || [])[0] !== "key") return; // not our sheet
      const st = toSettings(pairs);
      const fresh = rows.slice(1).map(function (r) {
        const o = {};
        head.forEach(function (h, i) { o[h] = r[i]; });
        return toItem(o, st.discount);
      }).filter(Boolean);
      const nowItems = sigItems(fresh), nowSettings = sigSettings(st);
      if (!liveOk) { liveOk = true; $("live").querySelector(".dot").classList.add("on"); $("live").lastChild.textContent += ", updated live"; }
      if (nowItems === shownItems && nowSettings === shownSettings) return;
      const stockChanged = nowItems !== shownItems;
      shownItems = nowItems; shownSettings = nowSettings; settings = st; items = defaultSort(tag(fresh, st));
      applySettings();
      if (stockChanged) renderFeatured(); // keep the strip still when only the location or banner changed
      renderChips(); render();
    }).catch(function () {});
  }

  applySettings();
  renderFeatured();
  renderChips();
  render();
  refresh();
  requestAnimationFrame(drift);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
}

if (typeof document !== "undefined") init();
if (typeof module !== "undefined") module.exports = { priceRow: priceRow, search: search, norm: norm, parseCsv: parseCsv, toItem: toItem, toSettings: toSettings, httpsUrl: httpsUrl, pickFeatured: pickFeatured };
