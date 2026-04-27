// Google Calendar API - JWT認証を自前実装（外部パッケージ不要）

async function getAccessToken(credentials) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(claim)}`;
  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(unsigned);
  const sig = sign.sign(credentials.private_key, 'base64url');
  const jwt = `${unsigned}.${sig}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token error: ' + JSON.stringify(data));
  return data.access_token;
}

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
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const token = await getAccessToken(credentials);
    const [year, month, day] = preferred_date.split('-').map(Number);
    const [hour, minute] = preferred_time.split(':').map(Number);
    const pad = n => String(n).padStart(2, '0');
    const startStr = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`;
    const endStr   = `${year}-${pad(month)}-${pad(day)}T${pad(hour + 1)}:${pad(minute)}:00+09:00`;
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
    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/info.nexccess%40gmail.com/events',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }
    );
    const calData = await calRes.json();
    if (!calRes.ok) throw new Error(calData.error?.message || 'Calendar API error');
    const gasUrl = process.env.GAS_WEBHOOK_URL;
    if (gasUrl) {
      fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'booking', timestamp: new Date().toISOString(),
          company, name, email, phone, position, preferred_date, preferred_time,
          diagnosis_score, diagnosis_grade, message, event_id: calData.id })
      }).catch(() => {});
    }
    return res.status(200).json({ success: true, booking_id: `NX-${Date.now()}`, message: '予約を受け付けました。' });
  } catch (err) {
    console.error('Book error:', err);
    return res.status(500).json({ error: '予約処理中にエラーが発生しました', detail: err.message });
  }
};
