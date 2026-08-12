export type WorkspaceHydrationStatus='idle'|'loading'|'ready'|'failed';
export const isActiveHydration=(expectedSession:number,expectedUserId:string,currentSession:number,currentUserId:string|undefined)=>expectedSession===currentSession&&expectedUserId===currentUserId;
export const canAutosaveCurrentWorkspace=(userId:string|undefined,status:WorkspaceHydrationStatus)=>Boolean(userId)&&status==='ready';
export const editorShortcutsDisabled=(settingsOpen:boolean,savedVersionsOpen:boolean)=>settingsOpen||savedVersionsOpen;
export const isActiveHydrationOperation=(expectedToken:number,currentToken:number)=>expectedToken===currentToken;
