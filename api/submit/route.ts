import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getGoogleAuth } from '@/lib/google-auth';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;
const CALENDAR_ID    = process.env.CALENDAR_ID!;
const SHEET_NAME     = '診断結果';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      // 診断情報
      score, grade, headline, summary, next_step,
      service, challenges, answers,
      // 予約情報
      company, name, email, phone, position,
      preferred_date, preferred_time, message,
    } = body;

    // ── 必須項目チェック ────────────────────────────────────
    if (!name || !email) {
      return NextResponse.json(
        { error: 'name と email は必須です' },
        { status: 400 }
      );
    }

    const auth   = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const calendar = google.calendar({ version: 'v3', auth });

    // ── 1. スプレッドシートにヘッダーがなければ作成 ──────────
    await ensureHeader(sheets);

    // ── 2. 診断結果をスプレッドシートに追記 ──────────────────
    const timestamp = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          timestamp,
          score        ?? '',
          grade        ?? '',
          headline     ?? '',
          next_step    ?? '',
          summary      ?? '',
          service      ?? '',
          challenges   ?? '',
          JSON.stringify(answers ?? {}),
          company      ?? '',
          name,
          email,
          phone        ?? '',
          position     ?? '',
          preferred_date ?? '',
          preferred_time ?? '',
          message      ?? '',
        ]],
      },
    });

    // ── 3. Googleカレンダーに予約を登録 ──────────────────────
    let eventId = '';
    if (preferred_date && preferred_time) {
      const [year, month, day] = preferred_date.split('-').map(Number);
      const [hour, minute]     = preferred_time.split(':').map(Number);

      const pad = (n: number) => String(n).padStart(2, '0');
      const startStr = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`;
      const endStr   = `${year}-${pad(month)}-${pad(day)}T${pad(hour + 1)}:${pad(minute)}:00+09:00`;

      const event = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: {
          summary: `【予約】${company || ''} ${name}様`,
          description: [
            `会社名: ${company || '未回答'}`,
            `氏名: ${name}`,
            `メール: ${email}`,
            `電話: ${phone || '未回答'}`,
            `役職: ${position || '未回答'}`,
            `診断スコア: ${score ?? '—'}点 (${grade ?? '—'})`,
            `メッセージ: ${message || 'なし'}`,
          ].join('\n'),
          start: { dateTime: startStr, timeZone: 'Asia/Tokyo' },
          end:   { dateTime: endStr,   timeZone: 'Asia/Tokyo' },
        },
      });
      eventId = event.data.id ?? '';
    }

    return NextResponse.json({
      success: true,
      booking_id: `NX-${Date.now()}`,
      event_id: eventId,
      message: '予約を受け付けました。',
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '不明なエラー';
    console.error('[submit] error:', message);
    return NextResponse.json(
      { error: '処理中にエラーが発生しました', detail: message },
      { status: 500 }
    );
  }
}

// ── ヘッダー行の確認・作成 ────────────────────────────────────
async function ensureHeader(sheets: ReturnType<typeof google.sheets>) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
  });

  if (!res.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          '診断日時', 'スコア', 'グレード', 'ヘッドライン',
          '次のステップ', 'サマリー', 'サービス名', '課題（選択）',
          '回答詳細（JSON）', '会社名', 'お名前', 'メール',
          '電話', '役職', '希望日', '希望時間', 'メッセージ',
        ]],
      },
    });
  }
}
