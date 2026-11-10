import {assertPreservedPixels} from './crop-v9/pixel-preservation.mjs';
import {prepareTransparency} from './crop-v9/transparency.mjs?v=20261110-lettering1';
export const TRANSPARENCY_CHECKPOINT='animal-stickers-transparency-checkpoint/v1';
export function inspectTransparencyCheckpoint(pixels,{sha256,stage='preselection',at=new Date().toISOString(),protectedForeground=null,expectedPixels=null}={}){
 const preservation=expectedPixels?assertPreservedPixels(expectedPixels,pixels):null;
 const checked=prepareTransparency(pixels,{protectedForeground}),issues=[...checked.report.issues];
 if(checked.report.removed)issues.push('保存PNGに除去可能な背景残留があります。選抜前に追加除去・保存・再検査が必要です');
 return {schema:TRANSPARENCY_CHECKPOINT,version:checked.report.version,preservation,stage,sha256,width:pixels.width,height:pixels.height,at,status:issues.length?'needs-repair':'verified',issues,remainingRemovablePixels:checked.report.removed,visualReviewRequired:true,technicalApproval:false};
}
export async function verifySavedTransparency(blob,decode,{expectedSha,stage='preselection',label='PNG',protectedForeground=null,expectedPixels=null}={}){
 const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
 if(expectedSha&&expectedSha!==sha256)throw Error(label+'：背景検査後にPNGが変わっています。画像の準備工程で再検査してください');
 const proof=inspectTransparencyCheckpoint(await decode(blob),{sha256,stage,protectedForeground,expectedPixels});
 if(proof.status!=='verified')throw Error(label+'：'+proof.issues.join(' ／ '));
 return proof;
}

// Confirmation copies retain the exact PNG and unresolved evidence. Never a pass.
export async function inspectConfirmationTransparency(blob,decode,{expectedSha,stage='confirmation',purpose}={}){
 if(purpose!=='confirmation-only')throw Error('確認用保存の目的を確認できません');
 const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
 if(expectedSha&&sha256!==expectedSha)throw Error('確認用PNGのハッシュが一致しません');
 const pixels=await decode(blob);
 const proof=inspectTransparencyCheckpoint(pixels,{sha256,stage});
 return {...proof,purpose,technicalApproval:false,verificationOnly:true,pixelsUnchanged:true};
}
