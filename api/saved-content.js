// Vercel Serverless Function to fetch saved content from Dropbox
// Environment variables (set in Vercel dashboard):
// - DROPBOX_APP_KEY: Your Dropbox app key
// - DROPBOX_APP_SECRET: Your Dropbox app secret
// - DROPBOX_REFRESH_TOKEN: Long-lived refresh token

const DROPBOX_PATH = '/blob_vercel_replacement/blob_clipboard_content.txt';

async function getAccessToken(appKey, appSecret, refreshToken) {
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error('Failed to refresh Dropbox token: ' + err);
  }

  const data = await response.json();
  return data.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const appKey = process.env.DROPBOX_APP_KEY || process.env.REACT_APP_DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;

  if (!appKey || !appSecret || !refreshToken) {
    return res.status(500).json({ error: 'Dropbox credentials not configured' });
  }

  try {
    const accessToken = await getAccessToken(appKey, appSecret, refreshToken);

    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Dropbox-API-Arg': JSON.stringify({ path: DROPBOX_PATH }),
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error('Dropbox download failed: ' + err);
    }

    const content = await response.text();
    return res.status(200).json({ content });
  } catch (error) {
    console.error('Dropbox API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch saved content' });
  }
}
