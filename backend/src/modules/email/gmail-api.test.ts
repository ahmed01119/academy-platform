import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMimeMessage, GmailApiSender } from './gmail-api';

const message = {
  fromEmail: 'academy@gmail.com',
  fromName: 'Sportexus',
  to: 'invitee@example.com',
  subject: 'دعوة للانضمام',
  html: '<p>مرحبا</p>',
  text: 'مرحبا',
};

function decodeWord(header: string): string {
  const m = header.match(/=\?UTF-8\?B\?([^?]+)\?=/);
  return m?.[1] ? Buffer.from(m[1], 'base64').toString('utf8') : '';
}

function part(mime: string, type: string): string {
  const section = mime.split(`Content-Type: ${type}; charset="UTF-8"`)[1] ?? '';
  const body = (section.split('\r\n\r\n')[1] ?? '').split('\r\n--')[0] ?? '';
  return Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8');
}

describe('buildMimeMessage', () => {
  it('keeps Arabic subject, text and HTML intact', () => {
    const mime = buildMimeMessage(message, 'fixed');
    const subject = mime.split('\r\n').find((l) => l.startsWith('Subject: '))!;
    expect(decodeWord(subject)).toBe('دعوة للانضمام');
    expect(mime).toContain('To: <invitee@example.com>');
    expect(mime).toContain('Content-Type: multipart/alternative; boundary="sportexus-fixed"');
    expect(part(mime, 'text/plain')).toBe('مرحبا');
    expect(part(mime, 'text/html')).toBe('<p>مرحبا</p>');
  });

  it('never lets a value add header lines', () => {
    const mime = buildMimeMessage(
      {
        ...message,
        to: 'a@example.com\r\nBcc: victim@example.com',
        subject: 'Hi\r\nBcc: x@example.com',
      },
      'fixed',
    );
    const headers = (mime.split('\r\n\r\n')[0] ?? '').split('\r\n');
    expect(headers.some((l) => l.startsWith('Bcc:'))).toBe(false);
  });
});

describe('GmailApiSender', () => {
  afterEach(() => vi.unstubAllGlobals());

  const credentials = { clientId: 'cid', clientSecret: 'secret', refreshToken: 'refresh' };
  const tokenResponse = () =>
    new Response(JSON.stringify({ access_token: 'at-1', expires_in: 3600 }), { status: 200 });
  const sentResponse = () => new Response(JSON.stringify({ id: 'gmail-msg-1' }), { status: 200 });

  it('gets an access token once, then sends the message as base64url MIME', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(sentResponse())
      .mockResolvedValueOnce(sentResponse());
    vi.stubGlobal('fetch', fetchMock);
    const sender = new GmailApiSender(credentials, 5_000);

    await expect(sender.send(message)).resolves.toBe('gmail-msg-1');
    await sender.send(message);

    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      'https://oauth2.googleapis.com/token',
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    ]);
    const tokenBody = new URLSearchParams(fetchMock.mock.calls[0]![1].body as string);
    expect(tokenBody.get('grant_type')).toBe('refresh_token');
    expect(tokenBody.get('refresh_token')).toBe('refresh');

    const sendInit = fetchMock.mock.calls[1]![1] as {
      headers: Record<string, string>;
      body: string;
    };
    expect(sendInit.headers.Authorization).toBe('Bearer at-1');
    const raw = Buffer.from(JSON.parse(sendInit.body).raw, 'base64url').toString('utf8');
    expect(raw).toContain('To: <invitee@example.com>');
  });

  it('renews the access token once when Gmail answers 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(sentResponse());
    vi.stubGlobal('fetch', fetchMock);

    await expect(new GmailApiSender(credentials, 5_000).send(message)).resolves.toBe('gmail-msg-1');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('explains a revoked or expired refresh token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 })),
    );
    await expect(new GmailApiSender(credentials, 5_000).send(message)).rejects.toThrow(
      /invalid_grant.*gmail-refresh-token\.cjs/,
    );
  });
});
