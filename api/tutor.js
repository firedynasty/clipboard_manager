// Vercel Serverless Function — OpenAI tutor chat (streaming proxy)
// Keeps OPENAI_API_KEY server-side. Same ACCESS_CODE check as api/ocr.js.
// Body: { accessCode, model, system, messages: [{ role, text, images?: [base64 jpeg] }] }
// Response: text/plain stream of the assistant's reply.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { accessCode, model, system, messages } = req.body || {};

  const validAccessCode = process.env.ACCESS_CODE;
  if (!accessCode) return res.status(400).json({ error: 'Access code required' });
  if (!validAccessCode || accessCode !== validAccessCode) return res.status(401).json({ error: 'Invalid access code' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });

  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Missing messages' });

  const chat = [];
  if (system) chat.push({ role: 'system', content: system });
  for (const m of messages) {
    const imgs = (m.images || []).map(b64 => ({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,' + b64 },
    }));
    chat.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.role === 'assistant' || !imgs.length
        ? (m.text || '')
        : [{ type: 'text', text: m.text || '(see attached image)' }, ...imgs],
    });
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: model || 'gpt-4.1-mini',
        stream: true,
        max_completion_tokens: 2000,
        messages: chat,
      }),
    });

    if (!upstream.ok) {
      const errData = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: errData.error?.message || 'OpenAI request failed' });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (delta) res.write(delta);
        } catch (e) { /* partial JSON line — ignore */ }
      }
    }
    return res.end();
  } catch (err) {
    if (!res.headersSent) return res.status(500).json({ error: 'Tutor request failed: ' + err.message });
    res.write('\n[stream error: ' + err.message + ']');
    return res.end();
  }
}
