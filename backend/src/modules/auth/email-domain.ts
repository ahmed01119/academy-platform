import { promises as dns } from 'dns';

/**
 * Whether an e-mail address's domain can receive mail, from public DNS:
 *  - `ok`: the domain has mail servers (MX), or an address record that mail falls back to (RFC 5321 implicit MX);
 *  - `no-mail`: the domain does not exist, or says it accepts no mail (null MX, RFC 7505);
 *  - `unknown`: DNS did not answer in time or failed. Callers let the address through: the confirmation code is the
 *    real check, and a DNS outage must not block sign-ups.
 *
 * This catches typing mistakes (`gmial.com`) and invented domains; it cannot tell whether one mailbox exists.
 */
export type EmailDomainStatus = 'ok' | 'no-mail' | 'unknown';

export interface DnsResolver {
  resolveMx(hostname: string): Promise<Array<{ exchange: string; priority: number }>>;
  resolve4(hostname: string): Promise<string[]>;
  resolve6(hostname: string): Promise<string[]>;
}

const NOT_FOUND_CODES = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);
const DEFAULT_TIMEOUT_MS = 4000;

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

async function lookUp(resolver: DnsResolver, domain: string): Promise<EmailDomainStatus> {
  try {
    const records = await resolver.resolveMx(domain);
    const servers = records.filter((r) => r.exchange && r.exchange !== '.');
    if (servers.length > 0) return 'ok';
    // Only a null MX ("0 ."): the domain explicitly accepts no mail.
    if (records.length > 0) return 'no-mail';
  } catch (err) {
    if (!NOT_FOUND_CODES.has(errorCode(err) ?? '')) return 'unknown';
  }
  const address = await hasAddressRecord(resolver, domain);
  if (address === null) return 'unknown';
  return address ? 'ok' : 'no-mail';
}

export async function checkEmailDomain(
  email: string,
  resolver: DnsResolver = dns,
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
