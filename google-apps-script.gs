// Deploy this in Google Apps Script (Extensions > Apps Script) attached to your Google Sheet.
//
// One-time setup:
//   1. Project Settings (gear icon) > Script Properties > add a property named
//      SHARED_SECRET with a long random value, e.g. generate one with:
//        openssl rand -hex 32
//   2. Put that same value in the Vercel project's WAITLIST_SHARED_SECRET env var.
//   3. Deploy > New deployment > Web app
//        - Execute as: Me
//        - Who has access: Anyone
//   4. Copy the resulting /exec URL into the Vercel project's GOOGLE_SCRIPT_URL env var.
//      Do NOT put this URL in script.js or any other client-side file - the whole point
//      of the /api/waitlist proxy is that this URL and the secret never reach the browser.
//
// This script now only accepts requests that include the correct shared secret in the
// POST body, and defends against Google Sheets formula injection even if a request
// somehow bypasses the proxy's own sanitisation (defense in depth - see BTTP-01).

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');

    if (!expectedSecret || data.secret !== expectedSecret) {
      return jsonResponse({ result: 'error', message: 'unauthorized' }, 401);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.appendRow([
      new Date(),
      sanitizeCell(data.comment),
      sanitizeCell(data.email),
      sanitizeCell(data.phone)
    ]);

    return jsonResponse({ result: 'success' }, 200);
  } catch (err) {
    return jsonResponse({ result: 'error', message: 'bad_request' }, 400);
  }
}

// Deliberately no doGet handler: this endpoint is write-only. Never add one
// that returns sheet contents - that would make the whole waitlist public.

// A cell value starting with =, +, -, or @ is interpreted as a formula by
// Sheets/Excel. Prefix it with a straight quote so it is always stored as
// plain text instead.
function sanitizeCell(value) {
  const v = value == null ? '' : String(value);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function jsonResponse(obj, status) {
  // Apps Script's ContentService cannot set an HTTP status code directly;
  // the body's own "result" field is what callers (api/waitlist.js) check.
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
