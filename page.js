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

function chipDefs(items) {
  const defs = [
    { key: "playmats", label: "Playmats", test: function (i) { return i.type === "Playmat"; } },
    { key: "foil", label: "Foil", test: function (i) { return /foil/i.test(i.finish); } },
    { key: "promo", label: "Promo", test: function (i) { return i.set === "Promo"; } },
    { key: "under25", label: "Under $25", test: function (i) { return i.event != null && i.event < 25; } },
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
function sellerFor(settings, name) {
  const all = settings.sellers || [];
  return all.filter(function (s) { return s.name === name; })[0] || all[0] || {};
}

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

function ebayHref(it) {
  const q = "Sorcery Contested Realm " + it.name + (it.finish && it.finish !== "Standard" ? " " + it.finish : "");
  return "https://www.ebay.com/sch/i.html?_nkw=" + encodeURIComponent(q) + "&LH_Sold=1&LH_Complete=1";
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

function prettyDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m[2] - 1] + " " + Number(m[3]) : s;
}

function contactButtons(settings, sellerName, text, label) {
  const s = sellerFor(settings, sellerName);
  let h = "";
  if (s.sms) h += '<a class="btn" href="' + esc(smsHref(s.sms, text)) + '">' + esc(label) + "</a>";
  if (s.whatsapp) h += '<a class="btn alt" href="' + esc(waHref(s.whatsapp, text)) + '">WhatsApp</a>';
  return h;
}

function rowHtml(it, settings, open) {
  const meta = [it.set, it.finish && it.finish !== "Standard" ? it.finish : "", it.cond, it.qty > 1 ? "×" + it.qty : ""]
    .filter(Boolean).map(esc).join(" · ");
  let price = "";
  if (it.ref != null) price += '<div class="ref">' + esc(it.src) + " $" + it.ref.toFixed(2) + "</div>";
  price += '<div class="ev">' + (it.event != null ? "$" + it.event : "Ask") + "</div>";
  if (it.saving != null) price += '<div class="save">Save $' + it.saving + "</div>";

  let more = "";
  if (open) {
    more = '<div class="more">';
    if (it.photo) more += '<img class="big" src="' + esc(it.photo) + '" alt="" width="288" height="216" loading="lazy">';
    if (it.notes) more += "<p>" + esc(it.notes) + "</p>";
    more += '<p class="links">';
    if (it.link) more += '<a href="' + esc(it.link) + '" target="_blank" rel="noopener">Check on TCGplayer</a>';
    more += '<a href="' + esc(ebayHref(it)) + '" target="_blank" rel="noopener">See eBay sold</a></p>';
    more += '<p class="acts">' + contactButtons(settings, it.seller, wantText(it), "I want this") + "</p></div>";
  }
  return '<li class="row' + (open ? " open" : "") + '">' +
    '<div class="main" role="button" tabindex="0" aria-expanded="' + (open ? "true" : "false") + '" data-id="' + esc(it.id) + '">' +
    (it.photo ? '<img class="thumb" src="' + esc(it.photo) + '" alt="" width="48" height="48" loading="lazy">' : "") +
    '<div class="info"><div class="name">' + esc(it.name) + '</div><div class="meta">' + meta +
    (it.hold ? ' <span class="hold">On hold</span>' : "") + "</div></div>" +
    '<div class="price">' + price + "</div></div>" + more + "</li>";
}

function init() {
  const data = JSON.parse(document.getElementById("data").textContent);
  const settings = data.settings;
  let items = defaultSort(data.items);
  let chip = "", query = "", openId = "";

  const $ = function (id) { return document.getElementById(id); };
  const list = $("list"), chipsEl = $("chips"), filter = $("filter"), empty = $("empty");

  function renderChips() {
    const defs = chipDefs(items);
    chipsEl.innerHTML = '<button type="button" data-chip=""' + (chip === "" ? ' aria-pressed="true"' : "") + ">All</button>" +
      defs.map(function (d) {
        return '<button type="button" data-chip="' + esc(d.key) + '"' + (chip === d.key ? ' aria-pressed="true"' : "") + ">" + esc(d.label) + "</button>";
      }).join("");
  }

  function render() {
    const def = chipDefs(items).filter(function (d) { return d.key === chip; })[0];
    const pool = def ? items.filter(def.test) : items;
    const res = search(pool, query);
    list.innerHTML = res.hits.map(function (it) { return rowHtml(it, settings, it.id === openId); }).join("");
    if (res.hits.length) {
      empty.hidden = true;
    } else {
      const closest = query ? search(items, query).closest : [];
      empty.hidden = false;
      empty.innerHTML = "<p>Not on the list. We have more in the binder, text us what you need.</p>" +
        '<p class="acts">' + contactButtons(settings, "", GENERIC_TEXT + query, "Text us") + "</p>" +
        (closest.length ? "<p>Closest matches:</p><ul>" +
          closest.map(function (it) { return rowHtml(it, settings, false); }).join("") + "</ul>" : "");
    }
    filter.placeholder = "Filter " + items.length + " items" + (items[0] ? ", e.g. " + items[0].name : "");
  }

  function toggle(target) {
    const main = target.closest(".main");
    if (!main) return;
    // Tapping a "closest match" clears the failed filter so the row opens in the full list.
    if (!empty.hidden) { query = ""; filter.value = ""; chip = ""; renderChips(); }
    openId = openId === main.dataset.id ? "" : main.dataset.id;
    render();
  }

  filter.addEventListener("input", function () { query = filter.value; render(); });
  chipsEl.addEventListener("click", function (e) {
    const b = e.target.closest("button");
    if (!b) return;
    chip = chip === b.dataset.chip ? "" : b.dataset.chip;
    renderChips(); render();
  });
  document.addEventListener("click", function (e) { if (!e.target.closest("a")) toggle(e.target); });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("main")) { e.preventDefault(); toggle(e.target); }
  });

  // Header details from settings
  const s1 = sellerFor(settings, "");
  $("where").textContent = settings.location_now ? "Find us: " + settings.location_now : "";
  $("checked").textContent = settings.prices_checked ? "Prices checked " + prettyDate(settings.prices_checked) + ". " : "";
  $("banner").textContent = settings.banner || "";
  $("bar").innerHTML = contactButtons(settings, "", GENERIC_TEXT, "Text us");
  $("pay").textContent = (settings.payment_methods ? "We take " + settings.payment_methods + ". " : "") +
    (settings.trades === "Y" ? "Trades welcome." : "");
  $("plain").textContent = [s1.sms ? "Text " + prettyPhone(s1.sms) : "", s1.discord ? "Discord: " + s1.discord : ""].filter(Boolean).join(" · ");

  renderChips();
  render();
}

if (typeof document !== "undefined") init();
if (typeof module !== "undefined") module.exports = { priceRow: priceRow, search: search, norm: norm };
