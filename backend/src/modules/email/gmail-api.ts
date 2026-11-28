import { randomBytes } from 'crypto';

/**
 * Sends e-mail through the Gmail API over HTTPS with an OAuth refresh token (scope `gmail.send`). Used where outbound
 * SMTP is blocked (Railway Free/Trial/Hobby): mail leaves from the Gmail account itself, so it is delivered like any
 * mail that account sends. The refresh token is created once with `scripts/gmail-refresh-token.cjs`.
 */

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface GmailMessage {
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
/** Renew the access token this long before Google says it expires. */
const EXPIRY_MARGIN_MS = 60_000;

/** RFC 2047 encoded-word, so Arabic subjects and sender names survive any mail client. */
function encodeHeaderWord(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/** Header values must never carry line breaks (header injection). */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function base64Lines(value: string): string {
  return (
    Buffer.from(value, 'utf8')
      .toString('base64')
      .match(/.{1,76}/g)
      ?.join('\r\n') ?? ''
  );
}

/** Builds a multipart/alternative (plain text + HTML) RFC 5322 message. */
export function buildMimeMessage(
  message: GmailMessage,
  boundary = randomBytes(12).toString('hex'),
): string {
  const marker = `sportexus-${boundary}`;
  return [
    `From: ${encodeHeaderWord(singleLine(message.fromName))} <${singleLine(message.fromEmail)}>`,
    `To: <${singleLine(message.to)}>`,
    `Subject: ${encodeHeaderWord(singleLine(message.subject))}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${marker}"`,
    '',
    `--${marker}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(message.text),
    `--${marker}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(message.html),
    `--${marker}--`,
    '',
  ].join('\r\n');
}

export class GmailApiSender {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(
    private readonly credentials: GmailCredentials,
    private readonly timeoutMs: number,
  ) {}

  /** Sends one message and returns Gmail's message id. */
  async send(message: GmailMessage): Promise<string | undefined> {
    const raw = Buffer.from(buildMimeMessage(message), 'utf8').toString('base64url');
    let res = await this.post(await this.getAccessToken(), raw);
    if (res.status === 401) {
      // The cached token was revoked or expired early: fetch a new one once.
      this.accessToken = null;
      res = await this.post(await this.getAccessToken(), raw);
    }
    if (!res.ok) {
      throw new Error(`Gmail API error (${res.status}): ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return data.id;
  }

  private post(accessToken: string, raw: string): Promise<Response> {
    return fetch(SEND_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - EXPIRY_MARGIN_MS) {
      return this.accessToken;
    }
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        refresh_token: this.credentials.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      const hint = body.includes('invalid_grant')
        ? ' The refresh token was revoked or expired: run scripts/gmail-refresh-token.cjs again.'
        : '';
      throw new Error(`Gmail OAuth token error (${res.status}): ${body}${hint}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    this.accessToken = data.access_token;
    this.accessTokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    return this.accessToken;
  }
}
