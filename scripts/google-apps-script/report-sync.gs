/**
 * Sincronizzazione automatica report Apicehotel.
 *
 * Proprietà script richieste:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Non inserire mai la service role key nel foglio o nel sorgente.
 */

const HOTELS = Object.freeze({
  hotelgio: { name: 'Hotel Giò' },
  chocohotel: { name: 'ChocoHotel' },
  brigantino: { name: 'Hotel Il Brigantino' },
});

const REPORTS = Object.freeze([
  { hotelId: 'hotelgio', type: 'segnalazioni', spreadsheetId: '1lZl27oz7Dxw2BKiJq0mGMd7x5Ue9qP9kkEwRUg8o_0w' },
  { hotelId: 'hotelgio', type: 'interventi', spreadsheetId: '13ZiUxNE7We-AO__19IPbosa7Y01CzKdlwJ554FolY5o' },
  { hotelId: 'hotelgio', type: 'camere_bloccate', spreadsheetId: '14IExJJm4aMZe73qwgPEBSu2DC7HJDcrG7uRRKX2DLJo' },
  { hotelId: 'chocohotel', type: 'segnalazioni', spreadsheetId: '1gghLhd6gyut6m-n3_RqKs4G7Y06YZfs_uUHUcszhVOU' },
  { hotelId: 'chocohotel', type: 'interventi', spreadsheetId: '1H0XDLvZ9YS-S9-rsfo2TcNBdQrdLhLgOxG9AnsouxOw' },
  { hotelId: 'chocohotel', type: 'camere_bloccate', spreadsheetId: '1dLjF-anBFQndWC_RD6xNtIg5FnStbWrMyXJVrdOdn7s' },
  { hotelId: 'brigantino', type: 'segnalazioni', spreadsheetId: '1_hTiruj8Vic02laQNHsD-0p_CSQ9KHVF0anNINAOud4' },
  { hotelId: 'brigantino', type: 'interventi', spreadsheetId: '1ShEV8HFAlulHkkgpxDsh3_WEP9g2syy-8UowGzRRIXQ' },
  { hotelId: 'brigantino', type: 'camere_bloccate', spreadsheetId: '1p8351m16-3-0r8v0Qs5rm0lzTf9Yd9EcPLsCw9zH1ls' },
  { hotelId: 'hotelgio', type: 'avvisi_urgenti', spreadsheetId: '1CFHg3pC2Ei7lY0dj48M1R8UA1iK69zSHIdrFdsccyek' },
  { hotelId: 'hotelgio', type: 'planning_lavori', spreadsheetId: '1X9qJs3cGZRSmKVALbMKgQiVAwon4wKtDtl4ZIrafoko' },
  { hotelId: 'hotelgio', type: 'planning_sale', spreadsheetId: '1Clr3qJ9H55BA8gTSHbe5kZxjZyLAysFk25VEiI_EMtA' },
  { hotelId: 'chocohotel', type: 'avvisi_urgenti', spreadsheetId: '1jrAuHohaxSpVP3o5M1QppMd_TNvLJ0We83mO2dBXYt8' },
  { hotelId: 'chocohotel', type: 'planning_lavori', spreadsheetId: '113Xm1PcM1cNsaMt-6dF8XUjwqFI5Us45Uj7y6-8ISQo' },
  { hotelId: 'brigantino', type: 'avvisi_urgenti', spreadsheetId: '1TNDS6Z_SHI2ioNdg3aGW4RfDBH30oDGpouIpnIambLc' },
  { hotelId: 'brigantino', type: 'planning_lavori', spreadsheetId: '1HeTA68To1c8bEAEfvN6MFM7eyuM-7bL5wf8REU_JVAE' },
]);

const REPORT_TABLES = Object.freeze({
  segnalazioni: 'segnalazioni',
  camere_bloccate: 'segnalazioni',
  interventi: 'interventi',
  planning_lavori: 'interventi',
  avvisi_urgenti: 'richieste_urgenti',
  planning_sale: 'prenotazioni_sale',
});

function syncAllReports() {
  const enabled = PropertiesService.getScriptProperties().getProperty('REPORT_SYNC_ENABLED');
  if (enabled !== 'true') throw new Error('Sincronizzazione disabilitata: dati di prova non inviati.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    REPORTS.forEach(syncReport_);
  } finally {
    lock.releaseLock();
  }
}

function syncReport_(report) {
  if (!HOTELS[report.hotelId]) throw new Error('Hotel non valido: ' + report.hotelId);
  const table = REPORT_TABLES[report.type];
  if (!table) throw new Error('Tipo report non valido: ' + report.type);
  let rows = fetchSupabase_(table, report.hotelId);
  if (report.type === 'camere_bloccate') rows = rows.filter(isBlockedRoom_);

  const spreadsheet = SpreadsheetApp.openById(report.spreadsheetId);
  const sheet = getDataSheet_(spreadsheet);
  writeRows_(sheet, rows);
  writeSyncStatus_(spreadsheet, report, rows.length);
}

function fetchSupabase_(table, hotelId) {
  const properties = PropertiesService.getScriptProperties();
  const baseUrl = properties.getProperty('SUPABASE_URL');
  const serviceKey = properties.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !serviceKey) throw new Error('Configurare SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nelle proprietà script.');

  const filter = hotelId === 'hotelgio'
    ? '&or=(hotel_id.eq.hotelgio,hotel_id.is.null)'
    : '&hotel_id=eq.' + encodeURIComponent(hotelId);
  const response = UrlFetchApp.fetch(baseUrl.replace(/\/$/, '') + '/rest/v1/' + table + '?select=*' + filter, {
    method: 'get',
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() >= 300) throw new Error('Supabase ' + response.getResponseCode() + ': ' + response.getContentText());
  return JSON.parse(response.getContentText() || '[]');
}

function isBlockedRoom_(row) {
  const room = String(row.camera || row.room || '').trim();
  const status = String(row.stato || row.status || '').toLowerCase();
  return /^\d+$/.test(room) && ['tec', 'tecnico', 'att', 'waiting', 'bloccata'].includes(status);
}

function getDataSheet_(spreadsheet) {
  return spreadsheet.getSheets().find(function (sheet) { return sheet.getName() !== 'CONFIG'; });
}

function writeRows_(sheet, rows) {
  sheet.clearContents();
  if (!rows.length) {
    sheet.getRange(1, 1).setValue('Nessun dato');
    return;
  }
  const headers = Array.from(rows.reduce(function (keys, row) {
    Object.keys(row).forEach(function (key) { keys.add(key); });
    return keys;
  }, new Set()));
  const values = rows.map(function (row) {
    return headers.map(function (header) {
      const value = row[header];
      return value != null && typeof value === 'object' ? JSON.stringify(value) : (value == null ? '' : value);
    });
  });
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  sheet.setFrozenRows(1);
}

function writeSyncStatus_(spreadsheet, report, rowCount) {
  let config = spreadsheet.getSheetByName('CONFIG');
  if (!config) config = spreadsheet.insertSheet('CONFIG').hideSheet();
  const values = [
    ['chiave', 'valore'],
    ['hotel_id', report.hotelId],
    ['hotel_name', HOTELS[report.hotelId].name],
    ['report_type', report.type],
    ['last_sync', new Date()],
    ['row_count', rowCount],
  ];
  config.getRange(1, 1, values.length, 2).setValues(values);
}

function installAutomaticTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) { return trigger.getHandlerFunction() === 'syncAllReports'; })
    .forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger('syncAllReports').timeBased().everyMinutes(15).create();
}

function doGet() {
  syncAllReports();
  return ContentService.createTextOutput(JSON.stringify({ ok: true, syncedAt: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}
