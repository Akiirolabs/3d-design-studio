import type { ProjectData } from '../types';

export type AppTheme = 'dev' | 'dark' | 'light';
export interface AccountPreferences {
  theme: AppTheme;
  reducedMotion: boolean;
  confirmDelete: boolean;
  autosave: boolean;
}
export interface AccountUser { id: string; username: string }
export interface AccountSession {
  authenticated: boolean;
  user?: AccountUser;
  preferences?: AccountPreferences;
}
export interface NamedSnapshot { id:string; name:string; createdAt:string; project:ProjectData }
export function partitionSnapshots(snapshots:NamedSnapshot[]){return {recent:snapshots.slice(0,5),older:snapshots.slice(5)};}

const DEFAULT_PREFERENCES: AccountPreferences = {
  theme: 'dev', reducedMotion: false, confirmDelete: true, autosave: true,
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${url}`, {
    credentials: 'same-origin',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const accountApi = {
  session: () => request<AccountSession>('/auth/session'),
  signup: (username: string, password: string) => request<{ user: AccountUser; preferences: AccountPreferences }>('/auth/signup', { method: 'POST', body: JSON.stringify({ username, password }) }),
  signin: (username: string, password: string) => request<{ user: AccountUser; preferences: AccountPreferences }>('/auth/signin', { method: 'POST', body: JSON.stringify({ username, password }) }),
  signout: () => request<void>('/auth/signout', { method: 'POST' }),
  changeUsername: (username: string) => request<{ user: AccountUser }>('/auth/username', { method: 'PATCH', body: JSON.stringify({ username }) }),
  changePassword: (currentPassword: string, newPassword: string) => request<void>('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  preferences: (preferences: Partial<AccountPreferences>) => request<{ preferences: AccountPreferences }>('/preferences', { method: 'PATCH', body: JSON.stringify(preferences) }),
  projects: () => request<{ projects: ProjectData[] }>('/projects'),
  saveProject: (project: ProjectData, signal?: AbortSignal) => request<{ project: ProjectData }>(`/projects/${encodeURIComponent(project.id)}`, { method: 'PUT', body: JSON.stringify(project), signal }),
  deleteProject: (id: string) => request<void>(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  importProjects: (projects: ProjectData[]) => request<{ imported: string[]; skipped: string[] }>('/projects/import', { method: 'POST', body: JSON.stringify({ projects }) }),
  snapshots: () => request<{snapshots:NamedSnapshot[];skippedCorrupt?:string[]}>('/snapshots'),
  createSnapshot: (name:string,project:ProjectData) => request<{snapshot:NamedSnapshot}>('/snapshots',{method:'POST',body:JSON.stringify({name,project})}),
  deleteSnapshot: (id:string) => request<void>(`/snapshots/${encodeURIComponent(id)}`,{method:'DELETE'}),
};

export function getGuestPreferences(): AccountPreferences {
  if (typeof localStorage === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const value = JSON.parse(localStorage.getItem('akiiro_account_preferences') || '{}');
    return { ...DEFAULT_PREFERENCES, ...value, theme: ['dev', 'dark', 'light'].includes(value.theme) ? value.theme : 'dev' };
  } catch { return DEFAULT_PREFERENCES; }
}

export function saveGuestPreferences(preferences: AccountPreferences): void {
  localStorage.setItem('akiiro_account_preferences', JSON.stringify(preferences));
}
