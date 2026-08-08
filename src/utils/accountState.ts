import type { AccountPreferences, AccountUser } from './accountApi';

export interface LatestAsyncRunner<T> {
  (value: T): Promise<void>;
  reset(): void;
}

export interface PreferenceUpdateQueue {
  update(next: Partial<AccountPreferences>): Promise<AccountPreferences>;
  reset(preferences: AccountPreferences): void;
}

/** Keeps preference writes in request order while the UI may optimistically show the newest value. */
export function createPreferenceUpdateQueue(
  initial: AccountPreferences,
  persist: (preferences: AccountPreferences) => Promise<AccountPreferences>,
  onChange: (preferences: AccountPreferences) => void,
): PreferenceUpdateQueue {
  let desired = initial;
  let committed = initial;
  let generation = 0;
  let tail = Promise.resolve();
  return {
    update(next) {
      const target = { ...desired, ...next };
      desired = target;
      onChange(target);
      const activeGeneration = generation;
      const task = tail.then(() => persist(target)).then(result => {
        if (activeGeneration !== generation) return result;
        committed = result;
        if (desired === target) { desired = result; onChange(result); }
        return result;
      }).catch(error => {
        if (activeGeneration === generation && desired === target) {
          desired = committed;
          onChange(committed);
        }
        throw error;
      });
      tail = task.then(() => undefined, () => undefined);
      return task;
    },
    reset(preferences) {
      generation += 1;
      desired = preferences;
      committed = preferences;
      tail = Promise.resolve();
      onChange(preferences);
    },
  };
}

/** Serializes work, coalesces queued values to the newest, and aborts a session on reset. */
export function createLatestAsyncRunner<T>(run: (value: T, signal: AbortSignal) => Promise<void>): LatestAsyncRunner<T> {
  let pending: T | undefined;
  let drainPromise: Promise<void> | null = null;
  let controller = new AbortController();
  let generation = 0;

  const startDrain = (): Promise<void> => {
    if (drainPromise) return drainPromise;
    const activeGeneration = generation;
    const activeController = controller;
    let firstError: unknown;
    drainPromise = (async () => {
      while (pending !== undefined && activeGeneration === generation && !activeController.signal.aborted) {
        const value = pending;
        pending = undefined;
        try { await run(value, activeController.signal); }
        catch (error) {
          if (!activeController.signal.aborted && firstError === undefined) firstError = error;
        }
      }
      if (firstError !== undefined) throw firstError;
    })().finally(() => {
      if (activeGeneration === generation) drainPromise = null;
    });
    return drainPromise;
  };

  const enqueue = ((value: T) => {
    pending = value;
    return startDrain();
  }) as LatestAsyncRunner<T>;
  enqueue.reset = () => {
    generation += 1;
    pending = undefined;
    controller.abort();
    controller = new AbortController();
    drainPromise = null;
  };
  return enqueue;
}

export async function persistPreferenceChange(
  previous: AccountPreferences,
  next: Partial<AccountPreferences>,
  user: AccountUser | null,
  persistRemote: (next: Partial<AccountPreferences>) => Promise<{ preferences: AccountPreferences }>,
  persistGuest: (preferences: AccountPreferences) => void,
): Promise<AccountPreferences> {
  const optimistic = { ...previous, ...next };
  if (!user) {
    persistGuest(optimistic);
    return optimistic;
  }
  const result = await persistRemote(optimistic);
  return result.preferences;
}
