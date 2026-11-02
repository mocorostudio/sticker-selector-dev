import {auditedCandidateBinding} from '../inspection-core.mjs';
// Formal sender only. The user must explicitly assign each image and slot.
// A crop is never promoted to inspected or approved by this module.
// Bind a selected candidate only when the existing inspection evidence itself
// identifies this image and candidate. Never alter the original crop record.
export function inspectedCandidateRecord(record,assignment){
 const evidence=record?.inspection?.candidateBinding;
 if(!evidence||evidence.imageId!==record.imageId||evidence.candidateId!==assignment?.candidateId||evidence.phrase!==assignment?.phrase||evidence.pose!==assignment?.pose)throw Error('画像と候補を照合した技術検品記録がありません');
 if(record.candidateId&&record.candidateId!==assignment.candidateId)throw Error('既存候補IDを変更できません');
 if(record.phrase&&record.phrase!==assignment.phrase)throw Error('既存セリフを変更できません');
 if(record.pose&&record.pose!==assignment.pose)throw Error('既存ポーズを変更できません');
 return {...record,candidateId:assignment.candidateId,phrase:assignment.phrase,pose:assignment.pose};
}
export async function prepareFormalCropPayload({records,pngs,assignments,characterId,subtle=globalThis.crypto?.subtle}){
 if(!/^[A-Za-z0-9_-]{1,256}$/.test(characterId||''))throw Error('対象キャラIDが必要です');
 if(!Array.isArray(records)||records.length!==9||!Array.isArray(pngs)||pngs.length!==9||!Array.isArray(assignments)||assignments.length!==9)throw Error('9候補と明示割当が必要です');
 if(!subtle?.digest)throw Error('ハッシュ計算ができません');
 const imageIds=new Set(),slots=new Set(),candidates=new Set(),batchIds=new Set(),entries=[];
 for(let i=0;i<9;i++){
  const r=records[i],bytes=pngs[i],a=assignments.find(x=>x?.imageId===r?.imageId);
  if(!a||imageIds.has(r.imageId)||slots.has(a.slot)||candidates.has(a.candidateId)||!Number.isInteger(a.slot)||a.slot<1||a.slot>9||typeof a.batchId!=='string'||!/^[A-Za-z0-9_-]+$/.test(a.batchId))throw Error('候補対応が欠落または重複しています');
  if(!(bytes instanceof ArrayBuffer)||new Uint8Array(bytes).slice(0,8).join(',')!=='137,80,78,71,13,10,26,10')throw Error('実PNGが必要です');
  imageIds.add(r.imageId);slots.add(a.slot);candidates.add(a.candidateId);batchIds.add(a.batchId);
  const bound=inspectedCandidateRecord(r,a);
  if(r.qa?.automatic!=='pass'||r.technicalStatus!=='pass'||r.inspection?.scope!=='actual-source'||!['visualPassed','phraseVerified','anatomyVerified','styleVerified','alphaVerified'].every(k=>r.inspection[k]===true))throw Error('技術検品が未完了です。仮選抜で進めてください');
  const digest=await subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  if(r.pngSha256!==hash)throw Error('PNGと検品記録のハッシュが一致しません');
  entries.push({record:bound,png:bytes});
 }
 if(batchIds.size!==1||slots.size!==9)throw Error('9セルを同一バッチで割り当ててください');
 return {type:'crop-handoff-v1',verifiedHandoff:true,characterId,entries,assignments:assignments.map(({imageId,candidateId,batchId,slot})=>({imageId,candidateId,batchId,slot}))};
}

export async function prepareAuditedFormalPayload({records,pngs,assignments,characterId,items,master,subtle}){
 if(!Array.isArray(records)||records.length!==9||!Array.isArray(pngs)||pngs.length!==9||!Array.isArray(assignments)||assignments.length!==9||!Array.isArray(items)||!Array.isArray(master))throw Error('実検品記録・最新マスターが必要です');
 const checked=[];
 for(let i=0;i<records.length;i++){
  const r=records[i],item=items.find(x=>x.imageId===r.imageId),a=assignments.find(x=>x.imageId===r.imageId);
  if(!item||!a)throw Error('画像に対応した検品結果がありません');
  const blob=new Blob([pngs[i]],{type:'image/png'});
  const binding=await auditedCandidateBinding(item,blob,master,a);
  if(r.pngSha256&&r.pngSha256!==binding.sha256)throw Error('元画像ハッシュ不一致');
  checked.push({...r,pngSha256:binding.sha256,qa:item.inspectionAudit.qa,technicalStatus:'pass',decision:'pass',review:[...item.inspectionAudit.checks],inspection:{scope:'actual-source',visualPassed:true,phraseVerified:true,anatomyVerified:true,styleVerified:true,alphaVerified:true,candidateBinding:binding}});
 }
 return prepareFormalCropPayload({records:checked,pngs,assignments,characterId,subtle});
}
