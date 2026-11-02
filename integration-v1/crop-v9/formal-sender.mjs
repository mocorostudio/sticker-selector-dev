// Formal sender only. The user must explicitly assign each image and slot.
// A crop is never promoted to inspected or approved by this module.
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
  if(r.candidateId!==a.candidateId||r.phrase!==a.phrase||r.pose!==a.pose)throw Error('候補ID・セリフ・ポーズの明示対応がありません');
  if(r.qa?.automatic!=='pass'||r.technicalStatus!=='pass'||r.inspection?.scope!=='actual-source'||!['visualPassed','phraseVerified','anatomyVerified','styleVerified','alphaVerified'].every(k=>r.inspection[k]===true))throw Error('技術検品が未完了です。仮選抜で進めてください');
  const digest=await subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  if(r.pngSha256!==hash)throw Error('PNGと検品記録のハッシュが一致しません');
  entries.push({record:r,png:bytes});
 }
 if(batchIds.size!==1||slots.size!==9)throw Error('9セルを同一バッチで割り当ててください');
 return {type:'crop-handoff-v1',verifiedHandoff:true,characterId,entries,assignments:assignments.map(({imageId,candidateId,batchId,slot})=>({imageId,candidateId,batchId,slot}))};
}
