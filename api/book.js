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
      name,
      email = '',
      phone = '',
      datetime,
      duration = 60,
      notes = '',
    } = req.body;

    if (!name)     throw new Error('name は必須です');
    if (!datetime) throw new Error('datetime は必須です');

    const calendarId = process.env.CALENDAR_ID;
    if (!calendarId) throw new Error('環境変数 CALENDAR_ID が未設定です');

    const auth     = getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const startDt = new Date(datetime);
    if (isNaN(startDt.getTime())) throw new Error('datetime の形式が不正です');
    const endDt = new Date(startDt.getTime() + duration * 60 * 1000);

    const event = {
      summary: `【融資相談】${name}`,
      description: [
        `氏名: ${name}`,
        `電話: ${phone}`,
        `メール: ${email}`,
        notes ? `備考: ${notes}` : '',
      ].filter(Boolean).join('\n'),
      start: { dateTime: startDt.toISOString(), timeZone: 'Asia/Tokyo' },
      end:   { dateTime: endDt.toISOString(),   timeZone: 'Asia/Tokyo' },
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return res.status(200).json({
      success: true,
      eventId:   response.data.id,
      eventLink: response.data.htmlLink,
    });

  } catch (error) {
    console.error('[book] Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
