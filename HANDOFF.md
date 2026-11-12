# Emily's Emporium site: handoff

Written Thu Nov 12, 2026. The event (Avatar of the Realm, Boston Marriott Long Wharf) runs Fri Nov 13 to Sun Nov 15.

## Where things are

| Thing | Location |
|---|---|
| Live site | https://coolrcichton.github.io/sorcery |
| Repo | github.com/coolrcichton/sorcery (public, branch `main`, GitHub Pages deploys from the branch root) |
| Inventory sheet | Google Sheet "Avatar of the Realm - inventory", file ID `1fa4nNfAk0xkld2T7EMzjHwr3vmbWmazUK4gVAzNBZpc`, owner-only |
| Published CSVs | Public tab (gid 2131651168) and Settings tab (gid 1572978540); full URLs are in `build.py` |
| View counter | Apps Script bound to the sheet; URL is `VIEWS_URL` in `build.py`; source in `apps-script/Code.gs` |
| Original plan | https://claude.ai/artifact/FWfXre7QZeiezAQXkqBt9g (Claude Doc; read with the Claude Docs connector) |
| QR image | `print/qr-sorcery.png` (static, level M, 4-module quiet zone, encodes the live site URL) |

Last deployed commit when this was written: `7d83d0c`, plus the commit that adds this file.

## Decisions the owner made

- **Selling on site is not allowed or restricted.** The sign uses the fallback wording "TRADES / ASK ABOUT MY BINDER". Contact messages ask to meet "off the event floor". The owner later chose to add "for Avatar of the Realm goers" to the offer tag anyway; they were told this is the one line that reads as on-site selling.
- **Name:** Emily's Emporium. No seller names appear on the site.
- **Contact:** one shared Google Voice number, +1 802-294-2383, SMS only (no WhatsApp). Discord handle `coolrichton` (note: not the same spelling as the GitHub user `coolrcichton`).
- **Condition:** a blank Condition cell means Near Mint.
- **Pricing:** plan defaults. 10% off, rounded to the nearest dollar; reference is the higher of Market Price and eBay Sold; Asking Price overrides. See `pricing.py`.
- **Removed on request:** the "prices checked" line, the eBay sold link, the "Under $25" chip.
- **The eBay tracking sheet** ("Ebay Card Tracking", owned by Emily) was copied from once. Do not link to it or read it again.

## What the site does now

- Static single page, built by `build.py` from `template.html` + `page.js` + the two CSVs + `top8.json`. Output is `index.html`.
- **Live refresh:** after first paint the page re-reads both published CSVs and updates in place. If that fails, the baked snapshot stays.
- **Snapshot rebuild:** `.github/workflows/build.yml` runs on a schedule and on manual dispatch, rebuilds from the live sheet, and commits `index.html` if it changed. In practice GitHub fires it every 5 to 8 hours, not hourly.
- **List:** every card has an art thumbnail (lazy), name, set, foil, condition, Top 8 trophy line, Staple and Chase badges, online price, event price, saving. Sorted by price, high to low.
- **Featured strip:** 10 cards (top 5 by price plus 5 random from the next 15), reshuffled each load, drifting and looping forever, paused by touch.
- **Opened card:** slides open; art tilts and shines, and follows a horizontal finger drag; Top 8 callout crediting Sorcerers Summit; "I want this" (prefilled SMS); "+ Add to my list"; "Check on TCGplayer".
- **Want list:** bottom bar becomes "Message about N items · $total"; stored in the phone's localStorage.
- **Filter:** sticky box, typo-tolerant; chips for Staples, Foil, Promo, $100+, and each set.
- **Sold rows** show greyed with a SOLD stamp. Status "Hidden" removes a row. Qty 0 hides a row.
- **Real view counter:** one view per card per device, stored on the sheet's Views tab, shown only at 5 or more. `#owner` on the URL opts a device out.
- **Other:** dark mode, link preview image (`og.png`), icon, noindex, paper texture.

## Things I declined, and why

The owner asked three times, in different forms, for a view count that is not real: generated numbers that grow over the weekend, then a sheet column of typed-in numbers shown as "views". I declined each time because it shows buyers a false claim to push a sale. The real counter was built instead. Do not build a fabricated or hand-typed "views" figure.

## Open items

### Before doors open Friday
1. **The printed sign has not been made.** Needs: trades wording, the QR at 15 cm or wider with 5 mm or larger modules, the URL as text, light matte background. Check the event's rules on signs first.
2. **Step 7 of the plan is untested:** printed QR to a visible list in under 3 seconds on cellular, and an unbriefed person finding a card and sending a message in under 15 seconds.
3. **Step 6's real test is untested:** mark a card Sold in the sheet, wait about 5 minutes, reload, confirm it shows the SOLD stamp. Sold stamps were only tested with a simulated sheet.
4. **Real-finger checks not done:** drag-to-tilt, the sliding panel on an iPhone, and a hard flick across the featured strip at its wrap point.

### Owner's to-do list (none confirmed done)
- Turn on two-factor login for GitHub (`coolrcichton`) and the Google account. Biggest remaining risk.
- Paste the hardened `apps-script/Code.gs` into Apps Script and redeploy as a new version of the same deployment (adds a one-view-per-card-per-minute limit and narrows its permission to this one sheet).
- Delete the `A006` test row on the Views tab.
- Open the site once with `#owner` on each of their own phones.
- Delete the Seller column (Items column N) and the four `seller2_` rows on Settings.
- Confirm "Enforce HTTPS" is ticked in the repo's Pages settings.
- Add playmats: Type "Playmat", an Asking Price, and an `https` Photo URL. None are in the sheet yet.
- Fix Qty where the default of 1 is wrong. All 36 rows were defaulted to 1 and Available.
- After the event: unpublish the sheet and remove the script deployment.

### Known trade-offs the owner accepted or was told about
- The list starts below the first screen on small phones since the featured strip was added. The plan's "3 rows above the fold" no longer holds.
- First paint: about 0.7 s in throttled Chrome, 1.0 s in Lighthouse, against a 1 s target.
- Card art is hot-linked from TCGplayer's CDN. The plan's research says a sales page should not rely on official art; the owner asked for it anyway. Removing it is a small change in `artUrl` in `page.js`.
- `top8.json` is a snapshot of sorcererssummit.com taken Nov 10 (460 Top 8 decks, 63 events). It does not update itself.
- The view counter can be inflated by anyone who scripts requests to it.

## How to work on it

- **Deploy:** commit and push to `main`. Pages redeploys in about a minute. Check with `gh api repos/coolrcichton/sorcery/deployments --jq '.[0].sha'`.
- **Build locally:** `python3 build.py tests/fixtures/public.csv tests/fixtures/settings.csv`. With no arguments it reads the live sheet, which only works where Google is reachable (GitHub Actions, not the Claude workspace).
- **Tests:** `python3 tests/test_pricing.py` and `node tests/test_pricing.js`. Both run `tests/pricing_cases.json`; the JS file also covers the filter, CSV parser, featured picks, and URL rules.
- **Browser checks:** scripts in `tools/` (Playwright with system Chrome). Serve the repo with `python3 -m http.server 8765` first. They were written for one workspace, so the Playwright path (`/opt/npm-tools/node_modules/playwright`) and a few `/home/claude/...` paths may need adjusting.
  - `check.js`: slow-4G first paint, fold, 16 px text, 44 px tap targets, horizontal scroll.
  - `live.js`: live refresh with unchanged, changed, blocked, and junk responses.
  - `sec.js`, `sec2.js`: hostile sheet content, hostile counter, corrupted localStorage, framing.
  - `feat.js`: badges, Staples chip, sold stamp, slide, tilt, want list, sticky filter.
  - `views.js`: view counter against a simulated service. `loop.js`: featured strip drift and wrap.
- **Pricing lives twice on purpose:** `pricing.py` and `priceRow` in `page.js`. Change both and keep `tests/pricing_cases.json` passing in both.
- **Content Security Policy:** the page allows only its own script, by hash, computed in `build.py`. No inline event handlers. New network destinations must be added to `connect-src` in `template.html`.

## Limits of the Claude workspace found along the way

- It cannot reach Google Sheets, `github.io`, the TCGplayer CDN, or sorcererssummit.com from the shell. Use the built-in browser to check anything live; it asks the owner for site access on each visit.
- It cannot create GitHub repos or change Pages settings. `gh` works for reading deployments and workflow runs and for dispatching the workflow via the REST API.
- The Google Drive connector can create and trash files but cannot edit cells. Sheet edits are the owner's.
- The Apps Script deployment must be done by the owner (it needs their Google approval).

## How the owner likes to work

- Show the verify result for each step before starting the next, and say plainly what was not tested.
- Flag anything marked "Unverified" in the plan that turns out false, and what was done instead. Status: cross-origin CSV fetch works; the old price refresher was dropped (Market Price is a plain cell); TCGplayer image hot-linking works; Sorcery Con's floor rules were never checked; "cards more than playmats" is unconfirmed.
- No em dashes. Minimum code that solves the problem, surgical changes, state assumptions, ask when a request has more than one reading.
- User experience comes first when there is a trade-off.
