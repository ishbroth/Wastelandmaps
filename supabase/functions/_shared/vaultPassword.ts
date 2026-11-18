// The password behind a vault number. A vault number is only four digits, so the real password is NOT "vault-1234": it is a long value only the server can work out
// (an HMAC of the account id and the digits, with a secret that lives in the server's settings). That way nobody can guess four digits straight at the sign-in service:
// every guess has to come through the vault-sign-in function, which counts wrong tries and locks the account after five.

/** The Apple reviewers' account keeps the plain "vault-1234" password and is never locked (they sign in on whichever build they were given, and a typo must not shut them out). */
export const REVIEW_ACCOUNT = 'welpcustomer@yahoo.com';

const hex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function vaultPassword(userId: string, email: string | null | undefined, digits: string): Promise<string> {
  if ((email ?? '').trim().toLowerCase() === REVIEW_ACCOUNT) return `vault-${digits}`;
  const secret = Deno.env.get('VAULT_PW_SECRET');
  if (!secret) throw new Error('VAULT_PW_SECRET is not set');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return 'v2-' + hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${userId}|${digits}`)));
}
