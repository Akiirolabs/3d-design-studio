import {describe,expect,it} from 'vitest';
import {canAutosaveCurrentWorkspace,editorShortcutsDisabled,isActiveHydration,isActiveHydrationOperation} from '../utils/accountHydration';

describe('Current Version hydration gate',()=>{
 it('blocks autosave during a delayed current-workspace GET',()=>{expect(canAutosaveCurrentWorkspace('alice','loading')).toBe(false);});
 it('allows the local current project only after a no-current response resolves',()=>{expect(canAutosaveCurrentWorkspace('alice','ready')).toBe(true);});
 it('keeps autosave blocked after hydration failure so retry cannot overwrite remote work',()=>{expect(canAutosaveCurrentWorkspace('alice','failed')).toBe(false);});
 it('rejects stale results after an account switch or newer session generation',()=>{expect(isActiveHydration(1,'alice',2,'alice')).toBe(false);expect(isActiveHydration(2,'alice',2,'bob')).toBe(false);expect(isActiveHydration(2,'bob',2,'bob')).toBe(true);});
 it('prevents a deferred GET from replacing a current version loaded by a newer operation',async()=>{let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let token=1;let current='local';const hydration=(async()=>{const mine=token;await gate;if(isActiveHydrationOperation(mine,token))current='stale-get';})();token+=1;current='loaded-snapshot';release();await hydration;expect(current).toBe('loaded-snapshot');});
});
describe('modal shortcut gate',()=>{it('disables App and Canvas shortcuts while either Settings or Saved Versions is open',()=>{expect(editorShortcutsDisabled(false,false)).toBe(false);expect(editorShortcutsDisabled(true,false)).toBe(true);expect(editorShortcutsDisabled(false,true)).toBe(true);});});
