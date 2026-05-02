'use strict';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `
あなたは政策金融公庫の融資に精通した中小企業・個人事業主向けの融資診断アドバイザーです。
ユーザーの事業情報をもとに融資の可能性を診断し、以下の構成で回答してください。

1. 診断サマリー（3〜5文）
2. 強みポイント（箇条書き 2〜4項目）
3. 懸念・改善ポイント（箇条書き 2〜4項目）
4. 推奨アクション（2〜3項目）
5. 免責事項（1文）

日本語で回答し、400〜600文字程度を目安とする。
`.trim();

function buildUserPrompt(answers) {
  const lines = Object.entries(answers).map(([k, v]) => `- ${k}: ${v}`);
  return `以下の情報をもとに融資診断を行ってください。\n\n${lines.join('\n')}`;
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
    const { answers } = req.body;
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'answers オブジェクトが必要です' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('環境変数 GEMINI_API_KEY が未設定です');

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          { role: 'user', parts: [{ text: buildUserPrompt(answers) }] },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Gemini API エラー');

    const result = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!result) throw new Error('Gemini からレスポンスを取得できませんでした');

    return res.status(200).json({ success: true, result });

  } catch (error) {
    console.error('[diagnose] Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
