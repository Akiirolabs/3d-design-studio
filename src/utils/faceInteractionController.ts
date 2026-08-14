export type FaceFocusTarget='select'|'primary';
export const faceFocusTarget=(hasPersisted:boolean,hasDraft:boolean):FaceFocusTarget=>hasPersisted||hasDraft?'primary':'select';
export interface FaceCancelPorts{cancelFrame:()=>void;releaseCapture:()=>void;setTransforming:(value:boolean)=>void;clearDrag:()=>void;clearPreview:()=>void;restoreCommitted:()=>void;restoreGizmo:()=>void;setCanceledStatus:()=>void;focus:(target:FaceFocusTarget)=>void;hasPersisted:boolean}
export function runFaceInteractionCancel(ports:FaceCancelPorts):void{ports.cancelFrame();ports.releaseCapture();ports.setTransforming(false);ports.clearDrag();ports.clearPreview();ports.restoreCommitted();ports.restoreGizmo();ports.setCanceledStatus();ports.focus(faceFocusTarget(ports.hasPersisted,false));}
export function runFaceSelectionRejection(reason:string,ports:{clearPreview:()=>void;setError:(reason:string)=>void;focusSelect:()=>void}):void{ports.clearPreview();ports.setError(reason);ports.focusSelect();}
export function consumeFaceCancellationToken(previous:number,next:number,cancel:()=>void):number{if(previous!==next)cancel();return next;}
export type EditorControlPolicy='face'|'transform';
export const editorControlPolicy=(faceSelectionActive:boolean,hasActiveFace:boolean):EditorControlPolicy=>faceSelectionActive||hasActiveFace?'face':'transform';
export const shouldRestoreTransformGizmo=(hasActiveFace:boolean,faceSelectionActive=false):boolean=>editorControlPolicy(faceSelectionActive,hasActiveFace)==='transform';
