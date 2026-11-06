// Imported inspections are visible evidence, not automatic formal approval.
export const REVIEW_DISPLAY_SCHEMA='animal-stickers-review-display/v1';
export function validateReviewDisplay(value,{characterId,pendingFolderId,historyId,masters}){
 if(value?.schema!==REVIEW_DISPLAY_SCHEMA||value.characterId!==characterId||value.pendingFolderId!==pendingFolderId||value.historyFolderId!==historyId||value.approval!=='display-only'||!Array.isArray(value.entries)||value.entries.length<1||value.entries.length>130||value.candidateCount!==value.entries.length)throw Error('全候補の検品記録・件数・保存先が一致しません。');
 const match=value.masterReference?.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([-\w]+)\/edit$/);
 if(!match||!masters.some(m=>m.id===match[1]&&m.parents?.length===1&&m.parents[0]===characterId)||typeof value.masterSheet!=='string'||!value.masterSheet||value.masterSheet.length>100)throw Error('全候補の参照マスターが一致しません。');
 if(!/^[-\w]+$/.test(value.archive?.fileId||'')||!/^[a-f0-9]{64}$/.test(value.archive?.sha256||''))throw Error('全候補画像のファイル情報が不正です。');
 const seen=new Set();
 for(const e of value.entries){
  if(!/^[-\w]{1,100}$/.test(e.imageId||'')||!/^[-\w]+\.png$/.test(e.filename||'')||!e.candidateId||typeof e.phrase!=='string'||typeof e.pose!=='string'||!/^[a-f0-9]{64}$/.test(e.sha256||'')||!['pass','hold','fail','unknown'].includes(e.technicalReview?.status)||typeof e.technicalReview.reason!=='string'||!e.technicalReview.reason.trim()||typeof e.technicalReview.recordVersion!=='string'||!e.technicalReview.recordVersion)throw Error('候補の判定・理由・画像情報が不正です。');
  for(const k of ['imageId','filename','candidateId']){const key=k+':'+e[k];if(seen.has(key))throw Error('全候補の記録に重複があります。');seen.add(key);}
 }
 return match[1];
}
export function assertReviewMaster(value,master){
 if(master.length!==value.entries.length||value.entries.some(e=>{const m=master.find(m=>m.candidateId===e.candidateId);return !m||m.phrase!==e.phrase||m.pose!==e.pose;}))throw Error('全候補の件数・セリフ・ポーズが最新マスターと一致しません。');
}
export function reviewDisplayRecord(e,{qa,characterId,historyId,archiveId,manifestId,masterReference}){
 return {...e,hasPixels:true,crossing:false,qa,review:[],decision:e.technicalReview.status==='fail'?'fail':'review',reviewDisplay:true,
  masterReference,cropReview:{confirmed:true,imageId:e.imageId},
  displayReview:{...e.technicalReview,source:'drive-review-display',imageId:e.imageId,candidateId:e.candidateId,phrase:e.phrase,pose:e.pose,sha256:e.sha256},
  pendingDrive:{characterId,folderId:historyId,archiveFileId:archiveId,manifestFileId:manifestId,sha256:e.sha256}};
}
