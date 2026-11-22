import { promises as dns } from 'dns';

/**
 * Whether an e-mail address's domain can receive mail, from DNS:
 *  - `ok`: the domain has mail servers (MX), or an address record that mail falls back to (RFC 5321 implicit MX);
 *  - `no-mail`: the domain says it accepts no mail (null MX, RFC 7505), or it does not exist, confirmed twice and by
 *    the operating system's resolver;
 *  - `unknown`: DNS did not answer in time or failed. Callers let the address through: the confirmation code is the
 *    real check, and a DNS problem must never block a real address.
 *
 * A single "not found" answer is never trusted on its own: resolvers and networks give wrong NXDOMAIN answers for a
 * moment (network change, router or ISP resolver hiccup), which once refused a real gmail.com address. The large
 * providers are accepted without a lookup.
 *
 * This catches typing mistakes (`gmial.com`) and invented domains; it cannot tell whether one mailbox exists.
 */
export type EmailDomainStatus = 'ok' | 'no-mail' | 'unknown';

export interface DnsResolver {
  resolveMx(hostname: string): Promise<Array<{ exchange: string; priority: number }>>;
  resolve4(hostname: string): Promise<string[]>;
  resolve6(hostname: string): Promise<string[]>;
  /** The operating system's resolver (getaddrinfo); used to confirm a "not found" answer. */
  lookup?(hostname: string): Promise<unknown>;
}

/** Providers that certainly receive mail; no lookup needed. */
const KNOWN_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
]);

const NOT_FOUND_CODES = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);
const DEFAULT_TIMEOUT_MS = 6000;
const RETRY_DELAY_MS = 400;

function errorCode(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code;
}

async function hasAddressRecord(resolver: DnsResolver, domain: string): Promise<boolean | null> {
  for (const lookup of [resolver.resolve4.bind(resolver), resolver.resolve6.bind(resolver)]) {
    try {
      if ((await lookup(domain)).length > 0) return true;
    } catch (err) {
      if (!NOT_FOUND_CODES.has(errorCode(err) ?? '')) return null;
    }
  }
  return false;
}

/** One DNS pass. `not-found` means this pass found neither mail servers nor an address. */
async function lookUpOnce(
  resolver: DnsResolver,
  domain: string,
): Promise<'ok' | 'null-mx' | 'not-found' | 'unknown'> {
  try {
    const records = await resolver.resolveMx(domain);
    if (records.some((r) => r.exchange && r.exchange !== '.')) return 'ok';
    // Only a null MX ("0 ."): the domain explicitly accepts no mail.
    if (records.length > 0) return 'null-mx';
  } catch (err) {
    if (!NOT_FOUND_CODES.has(errorCode(err) ?? '')) return 'unknown';
  }
  const address = await hasAddressRecord(resolver, domain);
  if (address === null) return 'unknown';
  return address ? 'ok' : 'not-found';
}

/** True when the operating system's resolver finds the domain; null when it cannot tell. */
async function osResolverFinds(resolver: DnsResolver, domain: string): Promise<boolean | null> {
  if (!resolver.lookup) return false;
  try {
    await resolver.lookup(domain);
    return true;
  } catch (err) {
    return NOT_FOUND_CODES.has(errorCode(err) ?? '') ? false : null;
  }
}

async function lookUp(resolver: DnsResolver, domain: string): Promise<EmailDomainStatus> {
  const first = await lookUpOnce(resolver, domain);
  if (first === 'ok') return 'ok';
  if (first === 'null-mx') return 'no-mail';
  if (first === 'unknown') return 'unknown';

  // "Not found": confirm before refusing anyone.
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  const second = await lookUpOnce(resolver, domain);
  if (second === 'ok') return 'ok';
  if (second !== 'not-found') return second === 'null-mx' ? 'no-mail' : 'unknown';

  const os = await osResolverFinds(resolver, domain);
  if (os === null) return 'unknown';
  return os ? 'ok' : 'no-mail';
}

const systemResolver: DnsResolver = {
  resolveMx: (host) => dns.resolveMx(host),
  resolve4: (host) => dns.resolve4(host),
  resolve6: (host) => dns.resolve6(host),
  lookup: (host) => dns.lookup(host),
};

export async function checkEmailDomain(
  email: string,
  resolver: DnsResolver = systemResolver,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<EmailDomainStatus> {
  const at = email.lastIndexOf('@');
  const domain =
    at >= 0
      ? email
          .slice(at + 1)
          .trim()
          .toLowerCase()
      : '';
  if (!domain || !domain.includes('.')) return 'no-mail';
  if (KNOWN_MAIL_DOMAINS.has(domain)) return 'ok';

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<EmailDomainStatus>((resolve) => {
    timer = setTimeout(() => resolve('unknown'), timeoutMs);
  });
  try {
    return await Promise.race([lookUp(resolver, domain), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
