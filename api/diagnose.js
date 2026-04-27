// ── Gemini呼び出し ──
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini APIエラー');
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

// ── プロンプト生成（B2C / B2B 自動切替） ──
function buildPrompt(body) {
  const {
    service_context,
    industry, size, area, challenges,
    monthly_inquiries, current_tools, goals, budget_timing,
    all_answers
  } = body;

  // service_context が設定されている = B2C（一般ユーザー向け診断）
  const isB2C = service_context && service_context.trim() !== '';

  const diagData = all_answers
    ? Object.entries(all_answers).map(([k, v]) => `${k}: ${v || '未回答'}`).join('\n')
    : `業種/気になる部位: ${industry} / 規模/経験: ${size || '未回答'} / 地域: ${area || '未回答'}
課題/お悩み: ${Array.isArray(challenges) ? challenges.join('、') : challenges}
月間頻度: ${monthly_inquiries || '未回答'} / 使用ツール/現在の方法: ${current_tools || '未回答'}
実現したいこと: ${goals || '未回答'} / 検討時期: ${budget_timing || '未回答'}`;

  if (isB2C) {
    // ── B2C：来店顧客向け診断（ニーズ整理・サービス適合）──
    return `あなたは「${service_context}」のAIカウンセラーです。
お客様の回答をもとに、現状のニーズと当サロンのサービス適合度を分析し、JSON形式のみで回答してください。マークダウン・コードブロック不要。

出力形式:
{"score":<0-100>,"grade":"S|A|B|C","headline":"<30文字以内・お客様への言葉>","summary":"<150文字以内・お客様のニーズ整理と当サロンが解決できること>","pain_points":[{"title":"お悩みのタイトル","detail":"60文字以内・お客様視点の説明","severity":<1-3>}],"recommended_features":[{"feature":"おすすめのサービス・メニュー名","reason":"60文字以内・お客様にとってのメリット","priority":<1-3>}],"roi_estimate":{"workload_reduction":"自己処理の手間削減効果","conversion_improvement":"効果実感の目安","payback_period":"継続来店の目安"},"next_step":"immediate|planning|consideration"}

スコア基準: 90-100(S)今すぐ始めるべき / 70-89(A)強くおすすめ / 50-69(B)検討段階 / 0-49(C)まず情報収集を

重要: headline・summary・pain_points・recommended_featuresはすべてお客様（来店者）に向けた言葉で書いてください。「システム」「導入」「B2B」的な表現は絶対に使わないこと。

【お客様の回答】
${diagData}`;

  } else {
    // ── B2B：システム導入評価（デフォルト）──
    return `あなたは「生成AI活用型 事前診断・集客・予約最適化システム」の導入適合性を評価する専門アナリストです。
以下の診断回答を分析し、JSON形式のみで回答してください。マークダウン・コードブロック不要。

{"score":<0-100>,"grade":"S|A|B|C","headline":"<30文字以内>","summary":"<150文字以内>","pain_points":[{"title":"課題名","detail":"60文字以内","severity":<1-3>}],"recommended_features":[{"feature":"機能名","reason":"60文字以内","priority":<1-3>}],"roi_estimate":{"workload_reduction":"概算","conversion_improvement":"目安","payback_period":"目安"},"next_step":"immediate|planning|consideration"}

スコア: 90-100(S)即導入推奨 / 70-89(A)強く推奨 / 50-69(B)検討 / 0-49(C)要件整理から

【診断データ】
${diagData}`;
  }
}

// ── メインハンドラー ──
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { industry, challenges } = req.body;

  if (!industry || !challenges) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  const prompt = buildPrompt(req.body);

  try {
    const raw = await callGemini(prompt);
    if (!raw) throw new Error('生成結果が空です');

    const jsonStr = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(jsonStr);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: '処理中にエラーが発生しました', detail: err.message });
  }
};
