import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountApi, getGuestPreferences, partitionSnapshots, saveGuestPreferences } from '../utils/accountApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('account API client', () => {
  it('uses same-origin credentials and JSON for authentication', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { id: 'u1', username: 'Akiiro' }, preferences: { theme: 'dev', reducedMotion: false, confirmDelete: true, autosave: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await accountApi.signin('Akiiro', 'a long password');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/signin', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: JSON.stringify({ username: 'Akiiro', password: 'a long password' }),
    }));
  });

  it('surfaces the server error and does not hide an unsuccessful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Invalid username or password.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })));
    await expect(accountApi.signin('Akiiro', 'wrong password')).rejects.toThrow('Invalid username or password.');
  });

  it('encodes project identifiers in owner-scoped routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await accountApi.deleteProject('project/with spaces');
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/project%2Fwith%20spaces', expect.objectContaining({ method: 'DELETE' }));
  });

  it('creates snapshots separately from workspace autosave and encodes snapshot deletion',async()=>{
    const fetchMock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({snapshot:{id:'server-id'}}),{status:201,headers:{'Content-Type':'application/json'}})).mockResolvedValueOnce(new Response(null,{status:204}));
    vi.stubGlobal('fetch',fetchMock);const project={id:'workspace',name:'Workspace'} as any;
    await accountApi.createSnapshot('Milestone',project);await accountApi.deleteSnapshot('snap/one');
    expect(fetchMock).toHaveBeenNthCalledWith(1,'/api/snapshots',expect.objectContaining({method:'POST',body:JSON.stringify({name:'Milestone',project})}));
    expect(fetchMock).toHaveBeenNthCalledWith(2,'/api/snapshots/snap%2Fone',expect.objectContaining({method:'DELETE'}));
  });

  it('partitions exactly five recent snapshots in server order',()=>{
    const snapshots=Array.from({length:7},(_,index)=>({id:String(index),name:String(index),createdAt:String(index),project:{} as any}));
    expect(partitionSnapshots(snapshots).recent.map(item=>item.id)).toEqual(['0','1','2','3','4']);
    expect(partitionSnapshots(snapshots).older.map(item=>item.id)).toEqual(['5','6']);
  });
});

describe('guest preferences', () => {
  it('defaults safely when local data is malformed', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{bad json' });
    expect(getGuestPreferences()).toEqual({ theme: 'dev', reducedMotion: false, confirmDelete: true, autosave: true });
  });

  it('persists guest-only preferences locally', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    const preferences = { theme: 'light' as const, reducedMotion: true, confirmDelete: false, autosave: false };
    saveGuestPreferences(preferences);
    expect(setItem).toHaveBeenCalledWith('akiiro_account_preferences', JSON.stringify(preferences));
  });
});
