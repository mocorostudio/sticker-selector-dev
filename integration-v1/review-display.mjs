// Imported inspections are visible evidence, not automatic formal approval.
export const REVIEW_DISPLAY_SCHEMA='animal-stickers-review-display/v1';
export function validateReviewDisplay(value,{characterId,pendingFolderId,historyId,masters}){
 if(value?.schema!==REVIEW_DISPLAY_SCHEMA||value.characterId!==characterId||value.pendingFolderId!==pendingFolderId||value.historyFolderId!==historyId||value.approval!=='display-only'||!Array.isArray(value.entries)||value.entries.length<1||value.entries.length>130||value.candidateCount!==value.entries.length)throw Error('全候補の検品記録・件数・保存先が一致しません。');
 const match=value.masterReference?.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([-\w]+)\/edit$/);
 if(!match||!masters.some(m=>m.id===match[1]&&m.parents?.length===1&&m.parents[0]===characterId)||typeof value.masterSheet!=='string'||!value.masterSheet||value.masterSheet.length>100)throw Error('全候補の参照マスターが一致しません。');
 if(!/^[-\w]+$/.test(value.archive?.fileId||'')||!/^[a-f0-9]{64}$/.test(value.archive?.sha256||''))throw Error('全候補画像のファイル情報が不正です。');
 const seen=new Set(),candidates=new Map();
 for(const e of value.entries){
  if(!/^[-\w]{1,100}$/.test(e.imageId||'')||!/^[-\w]+\.png$/.test(e.filename||'')||!e.candidateId||typeof e.phrase!=='string'||typeof e.pose!=='string'||!/^[a-f0-9]{64}$/.test(e.sha256||'')||!['pass','hold','fail','unknown'].includes(e.technicalReview?.status)||typeof e.technicalReview.reason!=='string'||!e.technicalReview.reason.trim()||typeof e.technicalReview.recordVersion!=='string'||!e.technicalReview.recordVersion)throw Error('候補の判定・理由・画像情報が不正です。');
  if(e.masterSheet!==undefined&&(typeof e.masterSheet!=='string'||!e.masterSheet||e.masterSheet.length>100))throw Error('試行の参照シートが不正です。');
  if(e.trialId!==undefined&&(typeof e.trialId!=='string'||!/^[-\w]{1,100}$/.test(e.trialId)))throw Error('試行IDが不正です。');
  const trials=candidates.get(e.candidateId)||[];
  if(trials.length&&(!e.trialId||trials.some(t=>!t||t===e.trialId)))throw Error('同じ候補の画像には異なる試行IDが必要です。');
  trials.push(e.trialId);candidates.set(e.candidateId,trials);
  for(const k of ['imageId','filename']){const key=k+':'+e[k];if(seen.has(key))throw Error('全候補の記録に重複があります。');seen.add(key);}
 }
 return match[1];
}
// A candidate may have multiple image attempts. Each attempt stays bound to an
// actual row in its named live sheet; adding an attempt never invents a candidate.
export function assertReviewMaster(value,master,variantMasters=new Map()){
 const sheets=new Map([[value.masterSheet,master],...variantMasters]);
 const used=new Map();
 for(const e of value.entries){
  const name=e.masterSheet||value.masterSheet,rows=sheets.get(name);
  const m=rows?.find(m=>m.candidateId===e.candidateId);
  if(!m||m.phrase!==e.phrase||m.pose!==e.pose||m.trialId&&m.trialId!==e.trialId||m.previousCandidateId&&m.previousCandidateId!==e.previousCandidateId||m.sourceId&&m.sourceId!==e.sourceId)throw Error('全候補の件数・セリフ・ポーズが最新マスターと一致しません。');
  if(!used.has(name))used.set(name,new Set());used.get(name).add(e.candidateId);
 }
 if(!used.has(value.masterSheet)||[...used].some(([name,ids])=>sheets.get(name).length!==ids.size))throw Error('全候補の件数・セリフ・ポーズが最新マスターと一致しません。');
}
export function reviewDisplayRecord(e,{qa,characterId,historyId,archiveId,manifestId,masterReference}){
 return {...e,hasPixels:true,crossing:false,qa,review:[],decision:e.technicalReview.status==='fail'?'fail':'review',reviewDisplay:true,
  masterReference,cropReview:{confirmed:true,imageId:e.imageId},
  displayReview:{...e.technicalReview,...(e.trialId?{trialId:e.trialId,masterSheet:e.masterSheet,previousCandidateId:e.previousCandidateId,changeReason:e.changeReason}:{}),source:'drive-review-display',imageId:e.imageId,candidateId:e.candidateId,phrase:e.phrase,pose:e.pose,sha256:e.sha256},
  pendingDrive:{characterId,folderId:historyId,archiveFileId:archiveId,manifestFileId:manifestId,sha256:e.sha256}};
}
