export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { topic, country, lang, modules } = req.body;

    const mi = {
      sources: `"sources":[{"name":"...","type":"Official/NGO/Media/Academic/Civil Society","description":"..."}] — 4 to 6 specific real primary sources`,
      context: `"context":"3-4 paragraphs of specific local political, historical and cultural context."`,
      voices: `"voices":[{"name":"...","role":"...","description":"...","emoji":"one emoji"}] — 4 real key people`,
      bias: `"bias_alerts":[{"level":"warning|caution|info","title":"...","detail":"..."}]`
    };

    const activeInstructions = modules.map(m => mi[m]).filter(Boolean).join(',\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `You are Newsground, an expert AI research assistant for journalists. Be specific, name real institutions and people. Respond ONLY with valid JSON, no markdown.`,
        messages: [{ role: 'user', content: `Research: TOPIC: ${topic}\nCOUNTRY: ${country}\nLANGUAGE: ${lang}\n\nReturn JSON: {"summary":"...","${activeInstructions}}` }]
      })
    });

    const data = await response.json();
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const match = text.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Could not parse output' });
    return res.status(200).json(JSON.parse(match[0]));

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
