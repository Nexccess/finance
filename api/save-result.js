'use strict';

const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
    ],
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      name = '', email = '', phone = '',
      business_type = '', loan_amount = '', purpose = '',
      years_in_biz = '', annual_sales = '', diagnosis_result = '',
      score_total = '', score_safety = '', score_repay = '',
      score_profit = '', route = '',
    } = req.body;

    const SPREADSHEET_ID         = process.env.SPREADSHEET_ID;
    const SCORING_SPREADSHEET_ID = process.env.SCORING_SPREADSHEET_ID;

    if (!SPREADSHEET_ID)         throw new Error('SPREADSHEET_ID が未設定です');
    if (!SCORING_SPREADSHEET_ID) throw new Error('SCORING_SPREADSHEET_ID が未設定です');

    const auth   = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const now    = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: '診断結果!A:J',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[now, name, email, phone, business_type, loan_amount, purpose, years_in_biz, annual_sales, diagnosis_result]],
      },
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SCORING_SPREADSHEET_ID,
      range: 'スコアリング結果!A:G',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[now, name, score_total, score_safety, score_repay, score_profit, route]],
      },
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[save-result] Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
