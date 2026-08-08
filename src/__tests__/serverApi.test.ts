import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiRouter } from '../../server/api';
import { migrateDatabase, openDatabase, type AppDatabase } from '../../server/database';
import { configureNetworkPolicy, getServerBinding, trustLocalReverseProxy } from '../../server/network';

function project(id: string, name = id) {
  return {
    id, name, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', objects: [],
    environment: { theme: 'studio', sunElevation: 45, sunAzimuth: 120, intensity: 1, shadows: true, shadowQuality: 'high', gridVisible: true, gridSnap: false, gridStep: 1, fogDensity: 0, bloom: false, bloomIntensity: 0, ao: true, backgroundColor: '#000000' },
  };
}

describe('account and project API', () => {
  let db: AppDatabase;
  let server: Server;
  let base: string;

  beforeEach(async () => {
    db = openDatabase(':memory:');
    const app = express();
    configureNetworkPolicy(app);
    app.use(express.json({ limit: '2mb' }));
    app.use('/api', createApiRouter(db));
    await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not start');
    base = `http://127.0.0.1:${address.port}/api`;
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (db.open) db.close();
  });

  it('requires the configured origin for every production mutation', async () => {
    const { cookie } = await signup('alice');
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAppOrigin = process.env.APP_ORIGIN;
    process.env.NODE_ENV = 'production';
    process.env.APP_ORIGIN = 'https://3d.akiiro.com';
    try {
      const body = JSON.stringify({ username: 'new-name' });
      expect((await request('/auth/username', { method: 'PATCH', headers: { cookie }, body })).status).toBe(403);
      expect((await request('/auth/username', { method: 'PATCH', headers: { cookie, origin: 'null' }, body })).status).toBe(403);
      expect((await request('/auth/username', { method: 'PATCH', headers: { cookie, origin: 'https://evil.example' }, body })).status).toBe(403);
      const accepted = await request('/auth/username', { method: 'PATCH', headers: { cookie, origin: 'https://3d.akiiro.com' }, body });
      expect(accepted.status).toBe(200);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
      if (previousAppOrigin === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previousAppOrigin;
    }
  });

  it('fails closed when production APP_ORIGIN is not configured', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAppOrigin = process.env.APP_ORIGIN;
    process.env.NODE_ENV = 'production';
    delete process.env.APP_ORIGIN;
    try {
      expect((await request('/auth/signup', {
        method: 'POST',
        headers: { origin: 'https://3d.akiiro.com' },
        body: JSON.stringify({ username: 'alice', password: 'correct-horse-battery' }),
      })).status).toBe(403);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
      if (previousAppOrigin === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previousAppOrigin;
    }
  });

  async function request(path: string, options: RequestInit = {}) {
    return fetch(`${base}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  }

  async function signup(username: string, password = 'correct-horse-battery') {
    const response = await request('/auth/signup', { method: 'POST', body: JSON.stringify({ username, password }) });
    const cookie = response.headers.get('set-cookie')?.split(';')[0] || '';
    return { response, cookie };
  }

  it('runs migrations idempotently', () => {
    migrateDatabase(db);
    migrateDatabase(db);
    expect((db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as { count: number }).count).toBe(1);
  });

  it('supports signup, session, signout, and normalized username uniqueness', async () => {
    const first = await signup('Alice');
    expect(first.response.status).toBe(201);
    expect(first.response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(first.response.headers.get('set-cookie')).toContain('SameSite=Lax');
    const session = await request('/auth/session', { headers: { cookie: first.cookie } });
    expect(await session.json()).toMatchObject({ authenticated: true, user: { username: 'Alice' }, preferences: { theme: 'dev' } });
    expect((await signup('  ALICE  ')).response.status).toBe(409);
    expect((await request('/auth/signout', { method: 'POST', headers: { cookie: first.cookie } })).status).toBe(204);
    expect(await (await request('/auth/session', { headers: { cookie: first.cookie } })).json()).toEqual({ authenticated: false });
  });

  it('accepts any password with at least five characters', async () => {
    const tooShort = await signup('shortpass', '1234');
    expect(tooShort.response.status).toBe(400);
    expect(await tooShort.response.json()).toEqual({ error: 'Password must be 5-256 characters.' });

    const accepted = await signup('simplepass', '12345');
    expect(accepted.response.status).toBe(201);
    const changed = await request('/auth/password', {
      method: 'POST',
      headers: { cookie: accepted.cookie },
      body: JSON.stringify({ currentPassword: '12345', newPassword: '! @#$' }),
    });
    expect(changed.status).toBe(204);

    const rejectedChange = await request('/auth/password', {
      method: 'POST',
      headers: { cookie: accepted.cookie },
      body: JSON.stringify({ currentPassword: '! @#$', newPassword: 'abcd' }),
    });
    expect(rejectedChange.status).toBe(400);
    expect(await rejectedChange.json()).toEqual({ error: 'Password must be 5-256 characters.' });
  });

  it('allows only one concurrent signup for the same normalized username', async () => {
    const attempts = await Promise.all([
      signup('Race_User'),
      signup('  RACE_USER  '),
    ]);
    expect(attempts.map(item => item.response.status).sort()).toEqual([201, 409]);
    expect((db.prepare('SELECT COUNT(*) AS count FROM users WHERE normalized_username = ?').get('race_user') as { count: number }).count).toBe(1);
  });

  it('removes expired sessions during authentication', async () => {
    const { cookie } = await signup('alice');
    db.prepare('UPDATE sessions SET expires_at = ?').run('2000-01-01T00:00:00.000Z');
    expect(await (await request('/auth/session', { headers: { cookie } })).json()).toEqual({ authenticated: false });
    expect((db.prepare('SELECT COUNT(*) AS count FROM sessions').get() as { count: number }).count).toBe(0);
  });

  it('returns one generic failure for unknown users and wrong passwords', async () => {
    await signup('alice');
    for (const body of [{ username: 'missing', password: 'wrong-password' }, { username: 'alice', password: 'wrong-password' }]) {
      const response = await request('/auth/signin', { method: 'POST', body: JSON.stringify(body) });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Invalid username or password.' });
    }
  });

  it('changes username and rejects cross-origin mutations', async () => {
    const { cookie } = await signup('alice');
    const rejected = await request('/auth/username', { method: 'PATCH', headers: { cookie, origin: 'https://evil.example' }, body: JSON.stringify({ username: 'new-name' }) });
    expect(rejected.status).toBe(403);
    const changed = await request('/auth/username', { method: 'PATCH', headers: { cookie }, body: JSON.stringify({ username: 'new-name' }) });
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({ user: { username: 'new-name' } });
  });

  it('changes passwords, preserves the current session, and revokes other sessions', async () => {
    const first = await signup('alice');
    const secondResponse = await request('/auth/signin', { method: 'POST', body: JSON.stringify({ username: 'alice', password: 'correct-horse-battery' }) });
    const secondCookie = secondResponse.headers.get('set-cookie')!.split(';')[0];
    const changed = await request('/auth/password', { method: 'POST', headers: { cookie: first.cookie }, body: JSON.stringify({ currentPassword: 'correct-horse-battery', newPassword: 'new-password-value' }) });
    expect(changed.status).toBe(204);
    expect((await request('/auth/session', { headers: { cookie: first.cookie } })).status).toBe(200);
    expect(await (await request('/auth/session', { headers: { cookie: secondCookie } })).json()).toEqual({ authenticated: false });
    expect((await request('/auth/signin', { method: 'POST', body: JSON.stringify({ username: 'alice', password: 'correct-horse-battery' }) })).status).toBe(401);
    expect((await request('/auth/signin', { method: 'POST', body: JSON.stringify({ username: 'alice', password: 'new-password-value' }) })).status).toBe(200);
  });

  it('requires authentication for projects and preferences', async () => {
    expect((await request('/projects')).status).toBe(401);
    expect((await request('/preferences')).status).toBe(401);
  });

  it('stores valid projects and rejects invalid projects', async () => {
    const { cookie } = await signup('alice');
    expect((await request('/projects/p1', { method: 'PUT', headers: { cookie }, body: JSON.stringify({ id: 'p1' }) })).status).toBe(400);
    expect((await request('/projects/p1', { method: 'PUT', headers: { cookie }, body: JSON.stringify(project('p1')) })).status).toBe(200);
    const loaded = await request('/projects/p1', { headers: { cookie } });
    expect(await loaded.json()).toMatchObject({ project: { id: 'p1' } });
  });

  it('isolates project lists, reads, updates, and deletes by owner', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob-user');
    await request('/projects/shared-id', { method: 'PUT', headers: { cookie: alice.cookie }, body: JSON.stringify(project('shared-id', 'Alice design')) });

    expect(await (await request('/projects', { headers: { cookie: bob.cookie } })).json()).toEqual({ projects: [] });
    expect((await request('/projects/shared-id', { headers: { cookie: bob.cookie } })).status).toBe(404);
    expect((await request('/projects/shared-id', { method: 'DELETE', headers: { cookie: bob.cookie } })).status).toBe(404);

    expect((await request('/projects/shared-id', { method: 'PUT', headers: { cookie: bob.cookie }, body: JSON.stringify(project('shared-id', 'Bob design')) })).status).toBe(200);
    expect(await (await request('/projects/shared-id', { headers: { cookie: alice.cookie } })).json()).toMatchObject({ project: { name: 'Alice design' } });
    expect(await (await request('/projects/shared-id', { headers: { cookie: bob.cookie } })).json()).toMatchObject({ project: { name: 'Bob design' } });

    await request('/projects/shared-id', { method: 'PUT', headers: { cookie: bob.cookie }, body: JSON.stringify(project('shared-id', 'Bob updated')) });
    expect(await (await request('/projects/shared-id', { headers: { cookie: alice.cookie } })).json()).toMatchObject({ project: { name: 'Alice design' } });
    expect((await request('/projects/shared-id', { method: 'DELETE', headers: { cookie: bob.cookie } })).status).toBe(204);
    expect((await request('/projects/shared-id', { headers: { cookie: bob.cookie } })).status).toBe(404);
    expect((await request('/projects/shared-id', { headers: { cookie: alice.cookie } })).status).toBe(200);
  });

  it('rate limits repeated authentication attempts', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await request('/auth/signin', { method: 'POST', body: JSON.stringify({ username: 'missing', password: 'wrong-password' }) })).status).toBe(401);
    }
    const limited = await request('/auth/signin', { method: 'POST', body: JSON.stringify({ username: 'missing', password: 'wrong-password' }) });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('ratelimit-policy')).toBeTruthy();
  });

  it('uses independent authentication limits for distinct verified forwarded clients', async () => {
    const signin = (clientIp: string) => request('/auth/signin', {
      method: 'POST',
      headers: { 'x-forwarded-for': clientIp },
      body: JSON.stringify({ username: 'missing', password: 'wrong-password' }),
    });

    for (let attempt = 0; attempt < 20; attempt += 1) expect((await signin('198.51.100.10')).status).toBe(401);
    expect((await signin('198.51.100.11')).status).toBe(401);
    expect((await signin('198.51.100.10')).status).toBe(429);
    for (let attempt = 1; attempt < 20; attempt += 1) expect((await signin('198.51.100.11')).status).toBe(401);
    expect((await signin('198.51.100.11')).status).toBe(429);
  });

  it('ignores prepended forwarded-for spoofing when applying authentication limits', async () => {
    const signin = (spoofedIp: string) => request('/auth/signin', {
      method: 'POST',
      headers: { 'x-forwarded-for': `${spoofedIp}, 203.0.113.20` },
      body: JSON.stringify({ username: 'missing', password: 'wrong-password' }),
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await signin(`198.51.100.${attempt + 1}`)).status).toBe(401);
    }
    expect((await signin('192.0.2.250')).status).toBe(429);
  });

  it('trusts only loopback proxies and binds production to loopback', () => {
    expect(trustLocalReverseProxy('127.0.0.1')).toBe(true);
    expect(trustLocalReverseProxy('::ffff:127.0.0.1')).toBe(true);
    expect(trustLocalReverseProxy('::1')).toBe(true);
    expect(trustLocalReverseProxy('10.0.0.8')).toBe(false);
    expect(trustLocalReverseProxy('169.254.1.2')).toBe(false);
    expect(trustLocalReverseProxy('203.0.113.1')).toBe(false);
    expect(getServerBinding('production')).toEqual({ host: '127.0.0.1', port: 3000 });
    expect(getServerBinding('development')).toEqual({ host: '0.0.0.0', port: 3000 });
  });

  it('imports guest projects deterministically without overwriting conflicts', async () => {
    const { cookie } = await signup('alice');
    await request('/projects/p1', { method: 'PUT', headers: { cookie }, body: JSON.stringify(project('p1', 'saved')) });
    const imported = await request('/projects/import', { method: 'POST', headers: { cookie }, body: JSON.stringify({ projects: [project('p1', 'guest'), project('p2')] }) });
    expect(await imported.json()).toEqual({ imported: ['p2'], skipped: ['p1'], conflictPolicy: 'skip-existing-id' });
    expect(await (await request('/projects/p1', { headers: { cookie } })).json()).toMatchObject({ project: { name: 'saved' } });
  });

  it('reads and validates preference updates', async () => {
    const { cookie } = await signup('alice');
    const updated = await request('/preferences', { method: 'PATCH', headers: { cookie }, body: JSON.stringify({ theme: 'dark', reducedMotion: true }) });
    expect(await updated.json()).toEqual({ preferences: { theme: 'dark', reducedMotion: true, confirmDelete: true, autosave: true } });
    expect((await request('/preferences', { method: 'PATCH', headers: { cookie }, body: JSON.stringify({ theme: 'neon' }) })).status).toBe(400);
  });

  it('reports database failures instead of false success', async () => {
    db.close();
    const response = await request('/auth/session');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error.' });
  });
});
