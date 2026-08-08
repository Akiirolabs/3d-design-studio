import { describe, expect, it, vi } from 'vitest';
import { createLatestAsyncRunner, createPreferenceUpdateQueue, persistPreferenceChange } from '../utils/accountState';
import type { AccountPreferences } from '../utils/accountApi';

const preferences: AccountPreferences = { theme: 'dev', reducedMotion: false, confirmDelete: true, autosave: true };

describe('ordered account state', () => {
  it('serializes delayed saves and coalesces queued edits to the latest project', async () => {
    let releaseFirst!: () => void;
    const firstDelay = new Promise<void>(resolve => { releaseFirst = resolve; });
    const completed: string[] = [];
    const run = createLatestAsyncRunner<{ name: string }>(async value => {
      if (value.name === 'old') await firstDelay;
      completed.push(value.name);
    });

    const first = run({ name: 'old' });
    const middle = run({ name: 'middle' });
    const newest = run({ name: 'newest' });
    expect(middle).toBe(first);
    expect(newest).toBe(first);
    expect(completed).toEqual([]);
    releaseFirst();
    await first;
    await vi.waitFor(() => expect(completed).toEqual(['old', 'newest']));
  });

  it('continues to the newest queued save after a failure and reports the drain failure', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const completed: string[] = [];
    const runner = createLatestAsyncRunner<string>(async value => {
      if (value === 'broken') { await gate; throw new Error('save failed'); }
      completed.push(value);
    });
    const drain = runner('broken');
    runner('newest').catch(() => undefined);
    release();
    await expect(drain).rejects.toThrow('save failed');
    expect(completed).toEqual(['newest']);
  });

  it('cancels old-session queued autosaves before a different user signs in', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const saved: string[] = [];
    const runner = createLatestAsyncRunner<string>(async (value, signal) => {
      if (value === 'user-a') await gate;
      if (!signal.aborted) saved.push(value);
    });
    const oldDrain = runner('user-a');
    runner('user-a-newest').catch(() => undefined);
    runner.reset();
    const newDrain = runner('user-b');
    release();
    await Promise.all([oldDrain, newDrain]);
    expect(saved).toEqual(['user-b']);
  });

  it('serializes preference writes and leaves the newest reverse-delay result visible', async () => {
    let releaseFirst!: () => void;
    const first = new Promise<void>(resolve => { releaseFirst = resolve; });
    const writes: string[] = []; const visible: AccountPreferences[] = [];
    const queue = createPreferenceUpdateQueue(preferences, async next => {
      writes.push(next.theme);
      if (next.theme === 'dark') await first;
      return next;
    }, next => visible.push(next));
    const dark = queue.update({ theme: 'dark' });
    const light = queue.update({ theme: 'light' });
    expect(writes).toEqual([]);
    releaseFirst();
    await Promise.all([dark, light]);
    expect(writes).toEqual(['dark', 'light']);
    expect(visible.at(-1)?.theme).toBe('light');
  });

  it('rolls back a failed latest preference but continues later updates', async () => {
    const visible: AccountPreferences[] = [];
    const queue = createPreferenceUpdateQueue(preferences, async next => {
      if (next.theme === 'dark') throw new Error('offline');
      return next;
    }, next => visible.push(next));
    await expect(queue.update({ theme: 'dark' })).rejects.toThrow('offline');
    expect(visible.at(-1)?.theme).toBe('dev');
    await queue.update({ theme: 'light' });
    expect(visible.at(-1)?.theme).toBe('light');
  });

  it('commits the server response after a successful preference update', async () => {
    const serverPreferences = { ...preferences, theme: 'dark' as const, autosave: false };
    const result = await persistPreferenceChange(preferences, { theme: 'dark' }, { id: 'u1', username: 'Akiiro' },
      vi.fn().mockResolvedValue({ preferences: serverPreferences }), vi.fn());
    expect(result).toEqual(serverPreferences);
  });

  it('rejects on server failure so the caller can restore the exact previous preferences', async () => {
    await expect(persistPreferenceChange(preferences, { theme: 'light' }, { id: 'u1', username: 'Akiiro' },
      vi.fn().mockRejectedValue(new Error('offline')), vi.fn())).rejects.toThrow('offline');
    expect(preferences.theme).toBe('dev');
  });

  it('persists guest preferences locally without contacting the server', async () => {
    const remote = vi.fn(); const local = vi.fn();
    const result = await persistPreferenceChange(preferences, { reducedMotion: true }, null, remote, local);
    expect(remote).not.toHaveBeenCalled();
    expect(local).toHaveBeenCalledWith({ ...preferences, reducedMotion: true });
    expect(result.reducedMotion).toBe(true);
  });
});
