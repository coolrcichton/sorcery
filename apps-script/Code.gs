/**
 * View counter for the Emily's Emporium site. Lives inside the inventory sheet.
 * GET .../exec           -> all counts as JSON, e.g. {"A033": 12}
 * GET .../exec?id=A033   -> adds one view to A033 (only if that ID is on the Items tab), then returns all counts
 *
 * @OnlyCurrentDoc   (limits this script's permission to this one spreadsheet)
 */
const TAB = "Views";
const COOLDOWN_SECONDS = 60; // at most one counted view per card per minute, so a script can't run a count up quickly

function doGet(e) {
  const out = {};
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
    const id = String((e && e.parameter && e.parameter.id) || "");

    if (/^[A-Za-z0-9]{1,12}$/.test(id)) {
      const known = ss.getSheetByName("Items").getRange("A2:A").getValues().map(function (r) { return String(r[0]); });
      const cache = CacheService.getScriptCache();
      if (known.indexOf(id) >= 0 && !cache.get("v_" + id)) {
        cache.put("v_" + id, "1", COOLDOWN_SECONDS);
        const lock = LockService.getScriptLock();
        lock.waitLock(5000);
        try {
          const rows = sheet.getDataRange().getValues();
          let at = -1;
          for (let i = 0; i < rows.length; i++) if (String(rows[i][0]) === id) at = i;
          if (at < 0) sheet.appendRow([id, 1]);
          else sheet.getRange(at + 1, 2).setValue((Number(rows[at][1]) || 0) + 1);
        } finally {
          lock.releaseLock();
        }
      }
    }

    sheet.getDataRange().getValues().forEach(function (r) { if (r[0]) out[String(r[0])] = Number(r[1]) || 0; });
  } catch (err) {
    // Never show an error page to the site: an empty answer just means "no counts".
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
