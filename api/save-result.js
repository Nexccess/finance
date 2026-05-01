// /api/save-result.js

const { google } = require('googleapis');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ── 入力チェック ───────────────────────────────────
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      return res.status(500).json({
        error: 'SPREADSHEET_ID is not defined',
        cause: 'ENV_NOT_SET'
      });
    }

    // ── Service Account 読み込み ──────────────────────
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
    let credentials;
    try {
      credentials = JSON.parse(raw);
    } catch {
      credentials = JSON.parse(raw.replace(/\n/g, '\\n'));
    }

    if (!credentials.client_email || !credentials.private_key) {
      return res.status(500).json({
        error: 'Invalid service account credentials',
        cause: 'SERVICE_ACCOUNT_INVALID'
      });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ── Spreadsheet 存在確認 ──────────────────────────
    let meta;
    try {
      meta = await sheets.spreadsheets.get({ spreadsheetId });
    } catch (e) {
      if (e.code === 404) {
        return res.status(404).json({
          error: 'Spreadsheet not found or no permission',
          cause: 'SPREADSHEET_NOT_FOUND'
        });
      }
      throw e;
    }

    const sheetList = meta.data.sheets.map(s => s.properties.title);
    const SHEET_NAME = '診断結果';

    if (!sheetList.includes(SHEET_NAME)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: { properties: { title: SHEET_NAME } }
          }]
        }
      });

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

    const body = req.body;
    const row = [
      body.timestamp || new Date().toISOString(),
      body.score || '',
      body.grade || '',
      body.headline || '',
      body.next_step || '',
      body.summary || '',
      body.service || '',
      body.challenges || '',
      body.answers || '',
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
    console.error('save-result error:', err);
    return res.status(500).json({
      error: 'Unexpected error',
      detail: err.message
    });
  }
};
