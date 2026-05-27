/**
 * EASY invite request messages — Google Apps Script
 *
 * Setup:
 * 1. New Google Sheet → Extensions → Apps Script → paste this file → Save
 * 2. Script properties: INVITE_SECRET = a long random string (Project Settings → Script properties)
 * 3. Run `ensureSheet` once from the editor (authorize when prompted)
 * 4. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone
 * 5. Copy the /exec URL into .env as VITE_INVITE_MESSAGES_URL (same secret in VITE_INVITE_MESSAGES_SECRET)
 */

var SHEET_NAME = 'invite_messages';

function ensureSheet() {
  getSheet_();
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['account', 'requester', 'message', 'created_at']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function expectedSecret_() {
  return PropertiesService.getScriptProperties().getProperty('INVITE_SECRET') || '';
}

function checkSecret_(provided) {
  var expected = expectedSecret_();
  if (!expected) return true;
  return String(provided || '') === expected;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  e = e || { parameter: {} };
  if (!checkSecret_(e.parameter.secret)) {
    return json_({ ok: false, error: 'Unauthorized' });
  }

  var accountsParam = String(e.parameter.accounts || '');
  var accounts = accountsParam
    .split(',')
    .map(function (a) {
      return a.trim().toLowerCase();
    })
    .filter(function (a) {
      return !!a;
    });

  return json_({ ok: true, messages: listMessages_(accounts) });
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Invalid JSON' });
  }

  if (!checkSecret_(body.secret)) {
    return json_({ ok: false, error: 'Unauthorized' });
  }

  var account = String(body.account || '')
    .trim()
    .toLowerCase();
  var requester = String(body.requester || '')
    .trim()
    .toLowerCase();
  var message = String(body.message || '').trim();

  if (!account || !requester) {
    return json_({ ok: false, error: 'account and requester required' });
  }
  if (!message) {
    return json_({ ok: true, stored: false });
  }
  if (message.length > 500) {
    return json_({ ok: false, error: 'Message too long' });
  }

  appendMessage_(account, requester, message);
  return json_({ ok: true, stored: true });
}

function appendMessage_(account, requester, message) {
  var sheet = getSheet_();
  sheet.appendRow([account, requester, message, new Date().toISOString()]);
}

function listMessages_(accounts) {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var filter = null;
  if (accounts && accounts.length) {
    filter = {};
    for (var i = 0; i < accounts.length; i++) {
      filter[accounts[i]] = true;
    }
  }

  var latestByAccount = {};
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var account = String(row[0] || '')
      .trim()
      .toLowerCase();
    if (!account) continue;
    if (filter && !filter[account]) continue;

    var requester = String(row[1] || '')
      .trim()
      .toLowerCase();
    var message = String(row[2] || '').trim();
    if (!message) continue;

    var createdRaw = row[3];
    var ts =
      createdRaw instanceof Date
        ? createdRaw.getTime()
        : Date.parse(String(createdRaw)) || 0;
    var createdAt = Math.floor(ts / 1000);

    var prev = latestByAccount[account];
    if (!prev || createdAt >= prev.createdAt) {
      latestByAccount[account] = {
        account: account,
        requester: requester,
        message: message,
        createdAt: createdAt,
      };
    }
  }

  var out = [];
  for (var key in latestByAccount) {
    if (latestByAccount.hasOwnProperty(key)) {
      out.push(latestByAccount[key]);
    }
  }
  return out;
}
