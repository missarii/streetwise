// src/services/auth.ts
// JWT sign/verify using Web Crypto (native in Workers).
// Password hashing delegated to bcryptjs.

import bcrypt from 'bcryptjs';

const ALG = { name: 'HMAC', hash: 'SHA-256' };
const COOKIE_NAME = 'sw_session';
const SESSION_TTL_HOURS = 8;

/** Import the JWT signing key from a raw secret string. */
async function importKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(secret), ALG, false, ['sign', 'verify']);
}

/** Base64url-encode a Uint8Array. */
function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Base64url-decode to Uint8Array. */
function unb64url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export interface JwtPayload {
  sub: string;   // user id
  email: string;
  role: 'staff' | 'admin';
  exp: number;   // unix timestamp
}

/** Sign a JWT with HMAC-SHA256. */
export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const key    = await importKey(secret);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig    = await crypto.subtle.sign(ALG, key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(sig)}`;
}

/** Verify a JWT. Returns null if invalid or expired. */
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const key   = await importKey(secret);
    const valid = await crypto.subtle.verify(
      ALG, key,
      unb64url(sig),
      new TextEncoder().encode(`${header}.${body}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64url(body))) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Build a Set-Cookie header value for the session. */
export function buildSessionCookie(token: string, clear = false): string {
  if (clear) {
    return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
  }
  const maxAge = SESSION_TTL_HOURS * 3600;
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

/** Extract the session token from a Cookie header. */
export function extractSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

/** Hash a plaintext password using bcrypt (cost=12). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

/** Verify a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Create a JWT for a user. */
export async function createSession(
  user: { id: string; email: string; role: 'staff' | 'admin' },
  secret: string,
): Promise<string> {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_HOURS * 3600,
  };
  return signJwt(payload, secret);
}

export { COOKIE_NAME };
