import type {NamedSnapshot} from './accountApi';
export type SavedVersionMode={kind:'save'}|{kind:'rename';snapshot:NamedSnapshot}|null;
export interface SavedVersionFormState{mode:SavedVersionMode;saveName:string;saveError:string|null;renameName:string;renameError:string|null;submitting:boolean}
export const initialSavedVersionForm:SavedVersionFormState={mode:null,saveName:'',saveError:null,renameName:'',renameError:null,submitting:false};
export const validateVersionName=(value:string)=>{const name=value.trim();return name.length>=1&&name.length<=80?{name,error:null}:{name,error:'Version name must be 1-80 characters.'};};
export const openSaveForm=(state:SavedVersionFormState,name:string):SavedVersionFormState=>({...state,mode:{kind:'save'},saveName:name,saveError:null,renameError:null});
export const openRenameForm=(state:SavedVersionFormState,snapshot:NamedSnapshot):SavedVersionFormState=>({...state,mode:{kind:'rename',snapshot},renameName:snapshot.name,renameError:null,saveError:null});
export const cancelSavedVersionForm=(state:SavedVersionFormState,busy=false):SavedVersionFormState=>busy||state.submitting?state:{...state,mode:null,saveError:null,renameError:null};
export async function submitSavedVersionForm(state:SavedVersionFormState,callback:(name:string)=>Promise<boolean>):Promise<SavedVersionFormState>{if(!state.mode||state.submitting)return state;const field=state.mode.kind==='save'?'saveName':'renameName',validated=validateVersionName(state[field]);if(validated.error)return {...state,[state.mode.kind==='save'?'saveError':'renameError']:validated.error};const pending={...state,submitting:true};return await callback(validated.name)?{...initialSavedVersionForm}:{...pending,submitting:false};}
