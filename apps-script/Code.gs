// View counter for the Emily's Emporium site. Lives inside the inventory sheet.
// GET .../exec           -> all counts as JSON, e.g. {"A033": 12}
// GET .../exec?id=A033   -> adds one view to A033 (only if that ID is on the Items tab), then returns all counts
const TAB = "Views";

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
  const id = String((e && e.parameter && e.parameter.id) || "");

  if (/^[A-Za-z0-9]{1,12}$/.test(id)) {
    const known = ss.getSheetByName("Items").getRange("A2:A").getValues().map(function (r) { return String(r[0]); });
    if (known.indexOf(id) >= 0) {
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

  const out = {};
  sheet.getDataRange().getValues().forEach(function (r) { if (r[0]) out[String(r[0])] = Number(r[1]) || 0; });
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
