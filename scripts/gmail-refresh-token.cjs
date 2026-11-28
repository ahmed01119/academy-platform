#!/usr/bin/env node
/**
 * One-time helper: creates the Gmail API refresh token the API needs for MAIL_PROVIDER=gmail.
 *
 * Usage (on your own computer, never on the server):
 *   node scripts/gmail-refresh-token.cjs <CLIENT_ID> <CLIENT_SECRET>
 *
 * It opens Google's consent page for the single permission "send e-mail on your behalf" (gmail.send). Sign in with
 * the Gmail account that sends the platform's e-mail and allow it. The refresh token is printed in this terminal
 * only; copy it into the hosting variables as GMAIL_REFRESH_TOKEN. Nothing is stored or sent anywhere else.
 *
 * The OAuth client must be of type "Desktop app" (it allows this temporary local address).
 */
const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');

const [clientId, clientSecret] = process.argv.slice(2).map((v) => (v || '').trim());
if (!clientId || !clientSecret) {
  console.error('Usage: node scripts/gmail-refresh-token.cjs <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

const SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const state = crypto.randomBytes(16).toString('hex');
const verifier = crypto.randomBytes(48).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  const finish = (message, ok) => {
    res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<p style="font:16px sans-serif">${message}</p>`);
    server.close();
  };
  if (url.searchParams.get('state') !== state)
    return finish('Unexpected answer. Run the script again.', false);
  const code = url.searchParams.get('code');
  if (!code)
    return finish(`Google answered: ${url.searchParams.get('error') || 'no code'}.`, false);

  const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }).toString(),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok || !data.refresh_token) {
      console.error(
        '\nGoogle did not return a refresh token:',
        data.error_description || data.error || data,
      );
      return finish('Failed. See the terminal.', false);
    }
    console.log('\nGMAIL_REFRESH_TOKEN (copy it into the hosting variables, keep it secret):\n');
    console.log(data.refresh_token);
    console.log('');
    finish('Done. You can close this tab and go back to the terminal.', true);
  } catch (err) {
    console.error('\nToken exchange failed:', err.message);
    finish('Failed. See the terminal.', false);
  }
});

server.listen(0, '127.0.0.1', () => {
  const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
  const consentUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();
  console.log('Opening Google sign-in. If no browser opens, paste this address into one:\n');
  console.log(consentUrl + '\n');
  const opener =
    process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${opener} "${consentUrl}"`);
});
