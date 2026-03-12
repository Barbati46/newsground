export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    const { topic, country, lang, modules } = await req.json();

    if (!topic || !country) {
      return new Response(JSON.stringify({ error: 'Topic and country are required' }), { status: 400, headers: corsHeaders });
    }

    const mi = {
      sources: `"sources":[{"name":"...","type":"Official/NGO/Media/Academic/Civil Society","description":"..."}] — 4 to 6 specific real primary sources`,
      context: `"context":"3-4 paragraphs of specific local political, historical and cultural context. Be concrete, factual, journalistic."`,
      voices: `"voices":[{"name":"...","role":"...","description":"...","emoji":"one emoji"}] — 4 real key people or institutions`,
      bias: `"bias_alerts":[{"level":"warning|caution|info","title":"...","detail":"..."}] — specific known bias patterns or disinformation risks`
    };

    const activeInstructions = modules.map(m => mi[m]).filter(Boolean).join(',\n');

    const systemPrompt = `You are Newsground, an expert AI research assistant for journalists worldwide. You have deep knowledge of global politics, local media ecosystems, primary institutional sources, civil society actors, and known disinformation patterns in every country. Be specific — name real institutions, real people, real sources. Never be vague. Respond ONLY with a valid JSON object. No markdown, no preamble.`;

    const userPrompt = `Research this story:
TOPIC: ${topic}
COUNTRY: ${country}
LANGUAGE: ${lang}

Return JSON:
{
"summary":"One sharp specific sentence about this story in ${country}.",
${activeInstructions}
}

Think like a veteran foreign correspondent who has lived in ${country} for years.`;

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
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err.error?.message || 'API error' }), { status: response.status, headers: corsHeaders });
    }

    const data = await response.json();
    const textBlocks = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = textBlocks.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return new Response(JSON.stringify({ error: 'Could not parse output' }), { status: 500, headers: corsHeaders });

    return new Response(jsonMatch[0], { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), { status: 500, headers: corsHeaders });
  }
}

export const config = { runtime: 'edge' };
