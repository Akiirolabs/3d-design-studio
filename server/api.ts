import argon2 from 'argon2';
import type Database from 'better-sqlite3';
import cookieParser from 'cookie-parser';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { normalizeAndValidateProjectData, validateProjectData } from '../src/utils/projectValidation';
import type { ProjectData } from '../src/types';
import type { AppDatabase } from './database';

const COOKIE_NAME = 'akiiro_session';
const SESSION_DAYS = 30;
const MAX_PROJECT_BYTES = 1024 * 1024;
const USERNAME = /^[A-Za-z0-9_-]{3,32}$/;
const PASSWORD_MIN = 5;

type UserRow = { id: string; username: string; normalized_username: string; password_hash: string };
type SessionUser = { id: string; username: string; tokenHash: string };
type StoredProjectRow = { id: string; data_json: string };
type SnapshotRow = StoredProjectRow & { name:string; created_at:string };

export function parseStoredProject(row: StoredProjectRow): ProjectData | undefined {
  try {
    const parsed = JSON.parse(row.data_json);
    const valid = normalizeAndValidateProjectData(parsed);
    if ('error' in valid || valid.data.id !== row.id) return undefined;
    return valid.data;
  } catch {
    return undefined;
  }
}

declare global {
  namespace Express {
    interface Request { sessionUser?: SessionUser }
  }
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeUsername(username: string): string {
  return username.trim().toLocaleLowerCase('en-US');
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function publicUser(user: { id: string; username: string }) {
  return { id: user.id, username: user.username };
}

function preferencesFor(db: AppDatabase, userId: string) {
  const row = db.prepare('SELECT theme, reduced_motion, confirm_delete, autosave FROM preferences WHERE user_id = ?').get(userId) as { theme: string; reduced_motion: number; confirm_delete: number; autosave: number };
  return { theme: row.theme, reducedMotion: !!row.reduced_motion, confirmDelete: !!row.confirm_delete, autosave: !!row.autosave };
}

function issueSession(db: AppDatabase, userId: string, res: Response): void {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(tokenHash(token), userId, expires.toISOString(), now.toISOString());
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
}

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => void handler(req, res, next).catch(next);
}

export function createApiRouter(db: AppDatabase): express.Router {
  const router = express.Router();
  router.use(cookieParser());

  router.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.get('origin');
    const production = process.env.NODE_ENV === 'production';
    const expected = process.env.APP_ORIGIN || (!production ? `${req.protocol}://${req.get('host')}` : '');
    if (production && (!expected || !origin || origin === 'null')) {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }
    if (!origin) return next();
    if (origin !== expected) return res.status(403).json({ error: 'Request origin is not allowed.' });
    next();
  });

  router.use((req, res, next) => {
    try {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
      const token = req.cookies?.[COOKIE_NAME];
      if (!token || typeof token !== 'string') return next();
      const row = db.prepare(`SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(tokenHash(token), new Date().toISOString()) as { id: string; username: string } | undefined;
      if (row) req.sessionUser = { ...row, tokenHash: tokenHash(token) };
      next();
    } catch (error) { next(error); }
  });

  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.sessionUser) return res.status(401).json({ error: 'Authentication required.' });
    next();
  };

  router.get('/auth/session', (req, res) => {
    if (!req.sessionUser) return res.json({ authenticated: false });
    res.json({ authenticated: true, user: publicUser(req.sessionUser), preferences: preferencesFor(db, req.sessionUser.id) });
  });

  router.post('/auth/signup', authLimit, asyncRoute(async (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!USERNAME.test(username)) return res.status(400).json({ error: 'Username must be 3-32 letters, numbers, underscores, or hyphens.' });
    if (password.length < PASSWORD_MIN || password.length > 256) return res.status(400).json({ error: `Password must be ${PASSWORD_MIN}-256 characters.` });
    const id = randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    try {
      db.transaction(() => {
        db.prepare('INSERT INTO users (id, username, normalized_username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(id, username, normalizeUsername(username), passwordHash, now, now);
        db.prepare('INSERT INTO preferences (user_id) VALUES (?)').run(id);
      })();
    } catch (error) {
      if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Username is unavailable.' });
      throw error;
    }
    issueSession(db, id, res);
    res.status(201).json({ user: { id, username }, preferences: preferencesFor(db, id) });
  }));

  router.post('/auth/signin', authLimit, asyncRoute(async (req, res) => {
    const username = typeof req.body?.username === 'string' ? normalizeUsername(req.body.username) : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const user = db.prepare('SELECT id, username, normalized_username, password_hash FROM users WHERE normalized_username = ?').get(username) as UserRow | undefined;
    const valid = user ? await argon2.verify(user.password_hash, password).catch(() => false) : false;
    if (!user || !valid) return res.status(401).json({ error: 'Invalid username or password.' });
    issueSession(db, user.id, res);
    res.json({ user: publicUser(user), preferences: preferencesFor(db, user.id) });
  }));

  router.post('/auth/signout', (req, res) => {
    if (req.sessionUser) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionUser.tokenHash);
    clearSession(res);
    res.status(204).end();
  });

  router.patch('/auth/username', requireAuth, (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    if (!USERNAME.test(username)) return res.status(400).json({ error: 'Username must be 3-32 letters, numbers, underscores, or hyphens.' });
    try {
      db.prepare('UPDATE users SET username = ?, normalized_username = ?, updated_at = ? WHERE id = ?')
        .run(username, normalizeUsername(username), new Date().toISOString(), req.sessionUser!.id);
    } catch (error) {
      if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Username is unavailable.' });
      throw error;
    }
    res.json({ user: { id: req.sessionUser!.id, username } });
  });

  router.post('/auth/password', requireAuth, authLimit, asyncRoute(async (req, res) => {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < PASSWORD_MIN || newPassword.length > 256) return res.status(400).json({ error: `Password must be ${PASSWORD_MIN}-256 characters.` });
    const user = db.prepare('SELECT id, username, normalized_username, password_hash FROM users WHERE id = ?').get(req.sessionUser!.id) as UserRow;
    if (!await argon2.verify(user.password_hash, currentPassword).catch(() => false)) return res.status(401).json({ error: 'Current password is incorrect.' });
    const nextHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(nextHash, new Date().toISOString(), user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(user.id, req.sessionUser!.tokenHash);
    })();
    res.status(204).end();
  }));

  router.get('/projects', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT id, data_json FROM projects WHERE owner_id = ? ORDER BY updated_at DESC, id ASC').all(req.sessionUser!.id) as StoredProjectRow[];
    const projects: ProjectData[] = [];
    const skippedCorrupt: string[] = [];
    for (const row of rows) {
      const project = parseStoredProject(row);
      if (project) projects.push(project); else skippedCorrupt.push(row.id);
    }
    res.json(skippedCorrupt.length ? { projects, skippedCorrupt } : { projects });
  });

  router.get('/projects/:id', requireAuth, (req, res) => {
    const row = db.prepare('SELECT id, data_json FROM projects WHERE owner_id = ? AND id = ?').get(req.sessionUser!.id, req.params.id) as StoredProjectRow | undefined;
    if (!row) return res.status(404).json({ error: 'Project not found.' });
    const project = parseStoredProject(row);
    if (!project) return res.status(422).json({ error: 'Stored project data is invalid.' });
    res.json({ project });
  });

  router.put('/projects/:id', requireAuth, (req, res) => {
    let encoded: string;
    try { encoded = JSON.stringify(req.body); } catch { return res.status(400).json({ error: 'Project must be valid JSON.' }); }
    if (Buffer.byteLength(encoded) > MAX_PROJECT_BYTES) return res.status(413).json({ error: 'Project exceeds the 1 MB limit.' });
    const valid = validateProjectData(req.body);
    if ('error' in valid) return res.status(400).json({ error: valid.error });
    if (valid.data.id !== req.params.id) return res.status(400).json({ error: 'Project ID does not match the URL.' });
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO projects (id, owner_id, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`)
      .run(valid.data.id, req.sessionUser!.id, encoded, valid.data.createdAt, now);
    res.json({ project: valid.data });
  });

  router.delete('/projects/:id', requireAuth, (req, res) => {
    const result = db.prepare('DELETE FROM projects WHERE owner_id = ? AND id = ?').run(req.sessionUser!.id, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Project not found.' });
    res.status(204).end();
  });

  router.post('/projects/import', requireAuth, (req, res) => {
    if (!Array.isArray(req.body?.projects) || req.body.projects.length > 100) return res.status(400).json({ error: 'Projects must be an array of at most 100 items.' });
    const projects: ProjectData[] = [];
    for (const candidate of req.body.projects) {
      const valid = normalizeAndValidateProjectData(candidate);
      if ('error' in valid) return res.status(400).json({ error: valid.error });
      if (Buffer.byteLength(JSON.stringify(valid.data)) > MAX_PROJECT_BYTES) return res.status(413).json({ error: 'A project exceeds the 1 MB limit.' });
      projects.push(valid.data);
    }
    const imported: string[] = [];
    const skipped: string[] = [];
    db.transaction(() => {
      const exists = db.prepare('SELECT 1 FROM projects WHERE owner_id = ? AND id = ?');
      const insert = db.prepare('INSERT INTO projects (id, owner_id, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
      for (const project of projects) {
        if (exists.get(req.sessionUser!.id, project.id)) { skipped.push(project.id); continue; }
        insert.run(project.id, req.sessionUser!.id, JSON.stringify(project), project.createdAt, project.updatedAt);
        imported.push(project.id);
      }
    })();
    res.json({ imported, skipped, conflictPolicy: 'skip-existing-id' });
  });

  router.get('/snapshots',requireAuth,(req,res)=>{
    const rows=db.prepare('SELECT id,name,data_json,created_at FROM snapshots WHERE owner_id = ? ORDER BY created_at DESC, id ASC').all(req.sessionUser!.id) as SnapshotRow[];
    const skippedCorrupt:string[]=[];
    const snapshots=rows.flatMap(row=>{try{const parsed=JSON.parse(row.data_json) as {id?:unknown};if(typeof parsed.id!=='string'){skippedCorrupt.push(row.id);return [];}const project=parseStoredProject({id:parsed.id,data_json:row.data_json});if(!project){skippedCorrupt.push(row.id);return [];}return [{id:row.id,name:row.name,createdAt:row.created_at,project}];}catch{skippedCorrupt.push(row.id);return [];}});
    res.json(skippedCorrupt.length?{snapshots,skippedCorrupt}:{snapshots});
  });

  router.get('/current-workspace',requireAuth,(req,res)=>{
    const row=db.prepare('SELECT data_json,updated_at FROM current_workspaces WHERE owner_id = ?').get(req.sessionUser!.id) as {data_json:string;updated_at:string}|undefined;
    if(!row)return res.json({project:null});
    try{const valid=normalizeAndValidateProjectData(JSON.parse(row.data_json));if('error' in valid)return res.status(422).json({error:'Current workspace data is invalid.'});return res.json({project:valid.data,updatedAt:row.updated_at});}catch{return res.status(422).json({error:'Current workspace data is invalid.'});}
  });

  router.put('/current-workspace',requireAuth,(req,res)=>{
    const valid=normalizeAndValidateProjectData(req.body);if('error' in valid)return res.status(400).json({error:valid.error});
    const encoded=JSON.stringify(valid.data);if(Buffer.byteLength(encoded)>MAX_PROJECT_BYTES)return res.status(413).json({error:'Current workspace exceeds the 1 MB limit.'});
    const updatedAt=new Date().toISOString();
    db.prepare(`INSERT INTO current_workspaces (owner_id,data_json,updated_at) VALUES (?,?,?) ON CONFLICT(owner_id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at`).run(req.sessionUser!.id,encoded,updatedAt);
    res.json({project:valid.data,updatedAt});
  });

  router.post('/snapshots/:id/load',requireAuth,(req,res)=>{
    const row=db.prepare('SELECT id,data_json FROM snapshots WHERE owner_id = ? AND id = ?').get(req.sessionUser!.id,req.params.id) as StoredProjectRow|undefined;
    if(!row)return res.status(404).json({error:'Snapshot not found.'});
    let project:ProjectData|undefined;try{const parsed=JSON.parse(row.data_json) as {id?:unknown};if(typeof parsed.id==='string')project=parseStoredProject({id:parsed.id,data_json:row.data_json});}catch{project=undefined;}
    if(!project)return res.status(422).json({error:'Saved version data is invalid.'});
    const updatedAt=new Date().toISOString();
    db.prepare(`INSERT INTO current_workspaces (owner_id,data_json,updated_at) VALUES (?,?,?) ON CONFLICT(owner_id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at`).run(req.sessionUser!.id,JSON.stringify(project),updatedAt);
    res.json({project,updatedAt});
  });

  router.post('/snapshots',requireAuth,(req,res)=>{
    const name=typeof req.body?.name==='string'?req.body.name.trim():'';
    if(name.length<1||name.length>80)return res.status(400).json({error:'Snapshot name must be 1-80 characters.'});
    const valid=normalizeAndValidateProjectData(req.body?.project);
    if('error' in valid)return res.status(400).json({error:valid.error});
    const encoded=JSON.stringify(valid.data);if(Buffer.byteLength(encoded)>MAX_PROJECT_BYTES)return res.status(413).json({error:'Snapshot exceeds the 1 MB limit.'});
    const id=randomUUID(),createdAt=new Date().toISOString();
    db.prepare('INSERT INTO snapshots (id,owner_id,name,data_json,created_at) VALUES (?,?,?,?,?)').run(id,req.sessionUser!.id,name,encoded,createdAt);
    res.status(201).json({snapshot:{id,name,createdAt,project:valid.data}});
  });

  router.delete('/snapshots/:id',requireAuth,(req,res)=>{
    const result=db.prepare('DELETE FROM snapshots WHERE owner_id = ? AND id = ?').run(req.sessionUser!.id,req.params.id);
    if(!result.changes)return res.status(404).json({error:'Snapshot not found.'});
    res.status(204).end();
  });

  router.get('/preferences', requireAuth, (req, res) => res.json({ preferences: preferencesFor(db, req.sessionUser!.id) }));
  router.patch('/preferences', requireAuth, (req, res) => {
    const allowed = ['theme', 'reducedMotion', 'confirmDelete', 'autosave'];
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(key => !allowed.includes(key))) return res.status(400).json({ error: 'Invalid preferences.' });
    const current = preferencesFor(db, req.sessionUser!.id);
    const next = { ...current, ...req.body };
    if (!['dev', 'dark', 'light'].includes(next.theme) || typeof next.reducedMotion !== 'boolean' || typeof next.confirmDelete !== 'boolean' || typeof next.autosave !== 'boolean') return res.status(400).json({ error: 'Invalid preferences.' });
    db.prepare('UPDATE preferences SET theme = ?, reduced_motion = ?, confirm_delete = ?, autosave = ? WHERE user_id = ?')
      .run(next.theme, Number(next.reducedMotion), Number(next.confirmDelete), Number(next.autosave), req.sessionUser!.id);
    res.json({ preferences: next });
  });

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('API request failed');
    res.status(500).json({ error: 'Internal server error.' });
  });
  return router;
}
