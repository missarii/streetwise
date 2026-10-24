import { describe, it, expect } from 'vitest';
import { verifyJwt, signJwt, type JwtPayload } from '../src/services/auth.js';

const SECRET = 'test-secret-for-unit-tests-only-32chars';

const ADMIN_PAYLOAD: JwtPayload = {
  sub: 'u-admin-01',
  email: 'admin@test.com',
  role: 'admin',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const STAFF_PAYLOAD: JwtPayload = {
  sub: 'u-staff-01',
  email: 'staff@test.com',
  role: 'staff',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

describe('JWT sign and verify', () => {
  it('signs and verifies an admin token', async () => {
    const token   = await signJwt(ADMIN_PAYLOAD, SECRET);
    const payload = await verifyJwt(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.role).toBe('admin');
    expect(payload!.email).toBe('admin@test.com');
  });

  it('signs and verifies a staff token', async () => {
    const token   = await signJwt(STAFF_PAYLOAD, SECRET);
    const payload = await verifyJwt(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.role).toBe('staff');
  });

  it('returns null for a token signed with a different secret', async () => {
    const token   = await signJwt(ADMIN_PAYLOAD, SECRET);
    const payload = await verifyJwt(token, 'wrong-secret-completely-different');
    expect(payload).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const expired: JwtPayload = { ...ADMIN_PAYLOAD, exp: Math.floor(Date.now() / 1000) - 1 };
    const token   = await signJwt(expired, SECRET);
    const payload = await verifyJwt(token, SECRET);
    expect(payload).toBeNull();
  });

  it('returns null for a malformed token', async () => {
    expect(await verifyJwt('not.a.valid.token', SECRET)).toBeNull();
    expect(await verifyJwt('', SECRET)).toBeNull();
    expect(await verifyJwt('only-one-part', SECRET)).toBeNull();
  });

  it('returns null for a tampered payload', async () => {
    const token  = await signJwt(STAFF_PAYLOAD, SECRET);
    const parts  = token.split('.');
    // Tamper the payload (change role to admin)
    const tampered = btoa(JSON.stringify({ ...STAFF_PAYLOAD, role: 'admin' }))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    const fakeToken = `${parts[0]}.${tampered}.${parts[2]}`;
    expect(await verifyJwt(fakeToken, SECRET)).toBeNull();
  });
});

describe('Role-based access logic', () => {
  it('staff role is not admin', () => {
    expect(STAFF_PAYLOAD.role).toBe('staff');
    expect(STAFF_PAYLOAD.role).not.toBe('admin');
  });

  it('admin role is recognised', () => {
    expect(ADMIN_PAYLOAD.role).toBe('admin');
  });

  it('middleware would block staff from admin routes', () => {
    // Simulating the role check in requireAdmin middleware
    const isAdmin = (role: string) => role === 'admin';
    expect(isAdmin(STAFF_PAYLOAD.role)).toBe(false);
    expect(isAdmin(ADMIN_PAYLOAD.role)).toBe(true);
  });
});
