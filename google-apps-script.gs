// Deploy this in Google Apps Script (Extensions > Apps Script) attached to your Google Sheet.
// Deploy as: Deploy > New deployment > Web app
//   - Execute as: Me
//   - Who has access: Anyone
// Copy the resulting /exec URL into script.js (GOOGLE_SCRIPT_URL).

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    new Date(),
    data.comment || '',
    data.email || '',
    data.phone || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
