// /api/save-result.js
// 診断結果を Google Sheets に蓄積する
// 環境変数: GOOGLE_SERVICE_ACCOUNT_JSON, SPREADSHEET_ID

const { google } = require('googleapis');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;

    // ── Google Auth ─────────────────────────────────────────
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // ── シートの存在確認・初期化 ─────────────────────────────
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = meta.data.sheets.map(s => s.properties.title);

    const SHEET_NAME = '診断結果';

    // シートがなければ作成
    if (!sheetList.includes(SHEET_NAME)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: { properties: { title: SHEET_NAME } }
          }]
        }
      });
      // ヘッダー行を追加
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        resource: {
          values: [[
            '診断日時',
            'スコア',
            'グレード',
            'ヘッドライン',
            '次のステップ',
            'サマリー',
            'サービス名',
            '課題（選択）',
            '回答詳細（JSON）',
          ]]
        }
      });
    }

    // ── データ行を追加 ───────────────────────────────────────
    const row = [
      body.timestamp   || new Date().toISOString(),
      body.score       || '',
      body.grade       || '',
      body.headline    || '',
      body.next_step   || '',
      body.summary     || '',
      body.service     || '',
      body.challenges  || '',
      body.answers     || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [row] }
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    // フロント側は catch(() => {}) で無視しているが念のためログ
    console.error('save-result error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
