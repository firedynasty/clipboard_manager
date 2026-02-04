const { put, list } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const { blobs } = await list({ prefix: 'clipboard/' });
      const files = {};
      for (const blob of blobs) {
        const response = await fetch(blob.url);
        const content = await response.text();
        const filename = blob.pathname.replace('clipboard/', '');
        files[filename] = content;
      }
      return res.status(200).json({ files });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to load files' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { filename, content } = req.body;
      await put(`clipboard/${filename}`, content, {
        access: 'public',
        addRandomSuffix: false,
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to save file' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
