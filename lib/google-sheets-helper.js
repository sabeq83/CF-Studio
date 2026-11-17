/**
 * Google Sheets Helper Utilities
 * Digunakan oleh scheduler processors aktif (RE, OPC, Ideation, Scraper) untuk menulis baris & sel ke Google Sheets.
 */

export function getColumnLetter(colIndex) {
  let temp = '';
  let letter = '';
  while (colIndex >= 0) {
    temp = colIndex % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor(colIndex / 26) - 1;
  }
  return letter;
}

export async function updateCell(sheets, spreadsheetId, sheetName, colIndex, rowIndex, value) {
  const colLetter = getColumnLetter(colIndex);
  const range = `'${sheetName}'!${colLetter}${rowIndex}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[value]]
    }
  });
}

export async function ensureTabAndAppendRows(sheets, spreadsheetId, tabName, headers, rows) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const tabExists = meta.data.sheets.some(s => s.properties.title === tabName);

    if (!tabExists) {
      console.log(`[Google Sheets] TAB "${tabName}" belum ada di Google Sheet. Membuat tab baru...`);
      const addSheetRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: tabName }
              }
            }
          ]
        }
      });

      const newSheetId = addSheetRes.data.replies[0].addSheet.properties.sheetId;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${tabName}'!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      });

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.15, green: 0.15, blue: 0.2 } } },
                fields: 'userEnteredFormat(textFormat,backgroundColor)'
              }
            },
            {
              updateSheetProperties: {
                properties: { sheetId: newSheetId, gridProperties: { frozenRowCount: 1 } },
                fields: 'gridProperties.frozenRowCount'
              }
            }
          ]
        }
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tabName}'!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows
      }
    });
    console.log(`[Google Sheets] Berhasil menulis data ke TAB "${tabName}" di Google Sheet.`);
  } catch (err) {
    console.error(`[Google Sheets ERROR] Gagal menulis ke TAB "${tabName}": ${err.message}`);
  }
}
