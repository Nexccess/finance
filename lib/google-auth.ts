import { google } from 'googleapis';

/**
 * Google認証クライアントを生成する
 * 環境変数から CLIENT_EMAIL と PRIVATE_KEY を読み込む
 */
export function getGoogleAuth() {
  const clientEmail = process.env.CLIENT_EMAIL;
  const privateKey = process.env.PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Google認証情報が環境変数に設定されていません');
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
    ],
  });
}
