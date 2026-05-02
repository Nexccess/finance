import { google } from "googleapis";

/**
 * Google Calendar ACL を 1 回だけ追加する管理用エンドポイント
 * 
 * 使い方：
 * 1. ブラウザで /api/admin-calendar-auth にアクセス
 * 2. Google ログイン（info.nexccess@gmail.com）
 * 3. 許可
 * 4. 「✅ Calendar ACL 追加完了」が表示されれば成功
 */
export default async function handler(req, res) {
  try {
    // OAuth クライアント初期化（Web アプリ用）
    const oauth2Client = new google.auth.OAuth2(
      process.env.ADMIN_CLIENT_ID,
      process.env.ADMIN_CLIENT_SECRET,
      process.env.ADMIN_REDIRECT_URI
    );

    /**
     * 認証前フェーズ
     * → Google のログイン画面へリダイレクト
     */
    if (!req.query.code) {
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/calendar"],
      });
      return res.redirect(authUrl);
    }

    /**
     * 認証後フェーズ
     * → code をアクセストークンに交換
     */
    const { tokens } = await oauth2Client.getToken(req.query.code);
    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client,
    });

    /**
     * Calendar ACL 追加
     * サービスアカウントに writer 権限を付与
     */
    await calendar.acl.insert({
      calendarId: process.env.CALENDAR_ID,
      requestBody: {
        role: "writer",
        scope: {
          type: "user",
          value: process.env.SERVICE_ACCOUNT_EMAIL,
        },
      },
    });

    return res
      .status(200)
      .send("✅ Calendar ACL 追加完了。この画面は閉じてOKです。");
  } catch (err) {
    console.error("admin-calendar-auth error:", err);

    return res
      .status(500)
      .send(`❌ エラーが発生しました: ${err.message}`);
  }
}

/**
 * ★ 超重要 ★
 * googleapis は Edge Runtime では動かないため、
 * Node.js Runtime を明示的に指定する
 */
export const config = {
  runtime: "nodejs",
};
