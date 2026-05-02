import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.ADMIN_CLIENT_ID,
      process.env.ADMIN_CLIENT_SECRET,
      process.env.ADMIN_REDIRECT_URI
    );

    // 認証前：Google ログインへ
    if (!req.query.code) {
      const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/calendar"],
      });
      return res.redirect(url);
    }

    // 認証後：ACL 追加
    const { tokens } = await oauth2Client.getToken(req.query.code);
    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client,
    });

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

    res.status(200).send("✅ Calendar ACL 追加完了。この画面は閉じてOKです。");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ エラー: " + err.message);
  }
}
