import React, { useEffect, useRef, useState } from 'react';
import { X, UserRound, Database, Palette, LoaderCircle } from 'lucide-react';
import type { ProjectData } from '../types';
import type { AccountPreferences, AccountUser } from '../utils/accountApi';
import { focusTrapTarget } from '../utils/modalKeyboard';

interface Props {
  isOpen: boolean; onClose: () => void;
  user: AccountUser | null; preferences: AccountPreferences; projects: ProjectData[];
  busy: boolean; error: string | null; notice: string | null;
  onAuthenticate: (mode: 'signin' | 'signup', username: string, password: string) => Promise<void>;
  onSignout: () => Promise<void>; onChangeUsername: (username: string) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onPreferences: (next: Partial<AccountPreferences>) => Promise<void>;
  onSave: () => Promise<void>; onLoad: (project: ProjectData) => void;
  onDelete: (project: ProjectData) => Promise<void>; onImportGuest: () => Promise<void>;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}

const field = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500';
const button = 'rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-3 py-2 text-sm font-semibold text-white transition-colors';

export const SettingsModal: React.FC<Props> = (props) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState('');
  const dialogRef = useRef<HTMLElement>(null); const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (!props.isOpen) { setPassword(''); setCurrentPassword(''); setNewPassword(''); } }, [props.isOpen]);
  useEffect(() => {
    if (!props.isOpen) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); props.onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable: HTMLElement[] = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const targetIndex = focusTrapTarget(activeIndex, focusable.length, event.shiftKey);
      if (targetIndex !== null) { event.preventDefault(); focusable[targetIndex].focus(); }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => { document.removeEventListener('keydown', handleKeyDown, true); props.returnFocusRef.current?.focus(); };
  }, [props.isOpen, props.onClose, props.returnFocusRef]);

  if (!props.isOpen) return null;
  const submitAuth = async (e: React.FormEvent) => { e.preventDefault(); await props.onAuthenticate(authMode, username, password); setPassword(''); };
  return <div data-testid="settings-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
    <section data-testid="settings-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="settings-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
      <header className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4">
        <div><h2 id="settings-title" className="font-semibold">Settings</h2><p className="text-xs text-slate-400">{props.user ? `Signed in as ${props.user.username}` : 'Guest user · designs are stored on this device'}</p></div>
        <button ref={closeRef} aria-label="Close settings" onClick={props.onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
      </header>
      <div className="space-y-6 p-5">
        {(props.error || props.notice) && <p role={props.error ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${props.error ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'}`}>{props.error || props.notice}</p>}
        <section className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-sky-400" />Account</h3>
          {!props.user ? <form onSubmit={submitAuth} className="space-y-3 rounded-xl bg-slate-950/60 p-4">
            <div className="flex gap-2"><button type="button" onClick={() => setAuthMode('signin')} className={authMode === 'signin' ? button : 'px-3 py-2 text-sm text-slate-400'}>Sign in</button><button type="button" onClick={() => setAuthMode('signup')} className={authMode === 'signup' ? button : 'px-3 py-2 text-sm text-slate-400'}>Sign up</button></div>
            <label className="block text-xs text-slate-400">Username<input className={`${field} mt-1`} autoComplete="username" required minLength={3} maxLength={32} value={username} onChange={e => setUsername(e.target.value)} /></label>
            <label className="block text-xs text-slate-400">Password<input className={`${field} mt-1`} type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required minLength={5} value={password} onChange={e => setPassword(e.target.value)} /></label>
            <button disabled={props.busy} className={button}>{authMode === 'signin' ? 'Sign in' : 'Create account'}</button>
          </form> : <div className="space-y-3 rounded-xl bg-slate-950/60 p-4">
            <form onSubmit={async e => { e.preventDefault(); await props.onChangeUsername(username); setUsername(''); }} className="flex gap-2"><input aria-label="New username" className={field} required minLength={3} maxLength={32} placeholder={props.user.username} value={username} onChange={e => setUsername(e.target.value)} /><button disabled={props.busy} className={button}>Change username</button></form>
            <form onSubmit={async e => { e.preventDefault(); await props.onChangePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); }} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input aria-label="Current password" className={field} type="password" required placeholder="Current password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /><input aria-label="New password" className={field} type="password" minLength={5} required placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /><button disabled={props.busy} className={button}>Change</button></form>
            <button disabled={props.busy} onClick={props.onSignout} className="text-sm text-red-300 hover:text-red-200">Sign out</button>
          </div>}
        </section>
        <section className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><Palette className="h-4 w-4 text-violet-400" />Appearance &amp; behavior</h3>
          <div className="grid gap-3 rounded-xl bg-slate-950/60 p-4 sm:grid-cols-2">
            <label className="text-xs text-slate-400">Theme<select disabled={props.busy} aria-label="Application theme" className={`${field} mt-1`} value={props.preferences.theme} onChange={e => void props.onPreferences({ theme: e.target.value as AccountPreferences['theme'] })}><option value="dev">Dev (original)</option><option value="dark">Dark</option><option value="light">Light</option></select></label>
            {(['autosave', 'confirmDelete', 'reducedMotion'] as const).map(key => <label key={key} className="flex items-center gap-2 text-sm"><input disabled={props.busy} type="checkbox" checked={props.preferences[key]} onChange={e => void props.onPreferences({ [key]: e.target.checked })} />{{ autosave: 'Autosave cloud designs', confirmDelete: 'Confirm before deleting', reducedMotion: 'Reduce motion' }[key]}</label>)}
          </div>
        </section>
        {props.user && <section className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><Database className="h-4 w-4 text-emerald-400" />Cloud designs</h3>
          <div className="flex flex-wrap gap-2"><button disabled={props.busy} onClick={props.onSave} className={button}>Save current design</button><button disabled={props.busy} onClick={props.onImportGuest} className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">Import guest designs</button></div>
          <div className="space-y-2">{props.projects.length === 0 ? <p className="text-sm text-slate-400">No cloud designs yet.</p> : props.projects.map(project => <div key={project.id} className="flex items-center justify-between rounded-lg border border-slate-800 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{project.name}</p><p className="text-xs text-slate-500">{new Date(project.updatedAt).toLocaleString()}</p></div><div className="flex gap-2"><button onClick={() => props.onLoad(project)} className="text-xs text-sky-300">Load</button><button onClick={() => props.onDelete(project)} className="text-xs text-red-300">Delete</button></div></div>)}</div>
        </section>}
        {props.busy && <p className="flex items-center gap-2 text-xs text-slate-400"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Working…</p>}
      </div>
    </section>
  </div>;
};
