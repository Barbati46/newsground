export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { topic, country, lang, modules } = req.body;

    const moduleParts = [];
    if (modules.includes('sources')) moduleParts.push(`"sources": [{"name": "source name", "type": "Official/NGO/Media/Academic", "description": "what this source covers"}]`);
    if (modules.includes('context')) moduleParts.push(`"context": "3-4 paragraphs of political, historical and cultural context"`);
    if (modules.includes('voices')) moduleParts.push(`"voices": [{"name": "person name", "role": "their role", "description": "why they matter", "emoji": "one emoji"}]`);
    if (modules.includes('bias')) moduleParts.push(`"bias_alerts": [{"level": "warning", "title": "alert title", "detail": "explanation"}]`);

    const prompt = `You are Newsground, an AI research assistant for journalists.

Research this topic and return ONLY a valid JSON object. No markdown, no backticks, no explanation.

TOPIC: ${topic}
COUNTRY: ${country}
LANGUAGE FOR OUTPUT: ${lang}

Return this exact JSON structure:
{
  "summary": "2-3 sentence overview of the situation",
  ${moduleParts.join(',\n  ')}
}

Rules:
- Return ONLY the JSON object, nothing else
- Use real, specific names of institutions and people
- Include 4-6 sources, 4 voices, 3-4 bias alerts
- All text in ${lang}`;

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
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    
    if (!data.content) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    const text = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Clean and extract JSON
    const cleaned = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: 'Could not parse AI response' });
    }

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
