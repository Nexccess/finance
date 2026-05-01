// ── Google Calendar API - googleapis使用 ──
const { google } = require('googleapis');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    company, name, email, phone, position,
    preferred_date, preferred_time, message,
    diagnosis_score, diagnosis_grade
  } = req.body;

  if (!name || !email || !preferred_date || !preferred_time) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  try {
    // ── 認証（分割環境変数方式） ──────────────────────────────
    const credentials = {
      ...((() => {
        const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
        try { return JSON.parse(raw); } catch(e) {
          // 改行が入っている場合の修復
          const fixed = raw.replace(/\n/g, '\\n');
          try { return JSON.parse(fixed); } catch(e2) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON のパースに失敗: ' + e2.message);
          }
        }
      })()),
    };

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('認証情報が設定されていません（CLIENT_EMAIL / PRIVATE_KEY）');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // ── 日時組み立て ──────────────────────────────────────────
    const [year, month, day] = preferred_date.split('-').map(Number);
    const [hour, minute]     = preferred_time.split(':').map(Number);
    const pad = n => String(n).padStart(2, '0');
    const startStr = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`;
    const endStr   = `${year}-${pad(month)}-${pad(day)}T${pad(hour + 1)}:${pad(minute)}:00+09:00`;

    // ── カレンダーイベント登録 ────────────────────────────────
    const event = {
      summary: `【予約】${company || ''} ${name}様`,
      description: [
        `会社名: ${company || '未回答'}`,
        `氏名: ${name}`,
        `メール: ${email}`,
        `電話: ${phone || '未回答'}`,
        `役職: ${position || '未回答'}`,
        `診断スコア: ${diagnosis_score || '—'}点 (${diagnosis_grade || '—'})`,
        `メッセージ: ${message || 'なし'}`,
      ].join('\n'),
      start: { dateTime: startStr, timeZone: 'Asia/Tokyo' },
      end:   { dateTime: endStr,   timeZone: 'Asia/Tokyo' },
    };

    const calendarId = process.env.CALENDAR_ID;
    if (!calendarId) throw new Error('CALENDAR_ID が設定されていません');

    const calRes = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return res.status(200).json({
      success: true,
      booking_id: `NX-${Date.now()}`,
      event_id: calRes.data.id,
      message: '予約を受け付けました。',
    });

  } catch (err) {
    console.error('Book error:', err);
    return res.status(500).json({
      error: '予約処理中にエラーが発生しました',
      detail: err.message
    });
  }
};
