import {orderPlanEntries} from './submission-order.mjs?v=20261024-order1';
export const SET_COUNTS=[8,16,24,32,40];
const validId=id=>typeof id==='string'&&/^[-\w]{1,256}$/.test(id);
export function setCounts(draft){return draft.sets.map(s=>({...s,count:Object.values(draft.assignments).filter(id=>id===s.id).length}));}
export function assignImage(draft,fileId,setId){if(!validId(fileId)||!draft.sets.some(s=>s.id===setId))throw Error('画像またはセットが不正です。');const next=structuredClone(draft);if(next.assignments[fileId]===setId)delete next.assignments[fileId];else next.assignments[fileId]=setId;return next;}
export function prepareSubmission(draft,files,{characterId,id,at=new Date().toISOString()}){
 if(!validId(characterId)||!validId(id)||!Array.isArray(draft.sets)||!draft.sets.length||draft.sets.length>20)throw Error('セットを作成してください。');
 const sets=setCounts(draft),setIds=new Set(sets.map(s=>s.id));if(setIds.size!==sets.length||sets.some(s=>!validId(s.id)||!SET_COUNTS.includes(s.target)||!s.name?.trim()||s.name.length>60))throw Error('セット名・目標枚数を確認してください。');
 const selected=sets.filter(s=>s.count>0);if(!selected.length)throw Error('申請用に移動する画像を選んでください。');if(selected.some(s=>s.count!==s.target))throw Error('選択したセットの枚数を目標枚数に合わせてください。');
 const byId=new Map(files.map(f=>[f.id,f]));if(byId.size!==files.length)throw Error('画像IDが重複しています。');
 const entries=Object.entries(draft.assignments).map(([fileId,setId])=>{const f=byId.get(fileId);if(f?.appProperties?.technicalStatus!=='pass')throw Error('技術検品の合格記録がない画像は申請用へ移動できません。');if(!setIds.has(setId)||!f||f.mimeType!=='image/png'||!validId(fileId)||f.parents?.length!==1||!f.size||!f.md5Checksum&&!f.sha256Checksum)throw Error('画像の場所または内容が不明です。再読み込みしてください。');return {fileId,setId,name:f.name,size:String(f.size),md5Checksum:f.md5Checksum||null,sha256Checksum:f.sha256Checksum||null,sourceParent:f.parents[0],version:f.version||null,...(f.fromHold?{sourceRating:'h',fromHold:true}:{})};});
 entries.splice(0,entries.length,...orderPlanEntries(draft,files,entries));
 return {schema:'animal-stickers-submission/v1',id,characterId,at,sets:selected.map(({id,name,target})=>({id,name:name.trim(),target})),entries};
}
export function validateSubmission(operation){
 if(operation?.schema!=='animal-stickers-submission/v1'||!validId(operation.id)||!validId(operation.characterId)||!Array.isArray(operation.sets)||!operation.sets.length||operation.sets.length>20||!Array.isArray(operation.entries))throw Error('移動計画が不正です。');
 const ids=new Set();for(const s of operation.sets){if(!validId(s.id)||ids.has(s.id)||!SET_COUNTS.includes(s.target)||typeof s.name!=='string'||!s.name.trim()||s.name.length>60||operation.entries.filter(e=>e.setId===s.id).length!==s.target)throw Error('セットの枚数・名前が不正です。');ids.add(s.id);}
 const files=new Set();for(const e of operation.entries){if(!validId(e.fileId)||files.has(e.fileId)||!ids.has(e.setId)||!validId(e.sourceParent)||!e.name||!(Number(e.size)>0)||!e.md5Checksum&&!e.sha256Checksum)throw Error('画像の割り当てが不正です。');files.add(e.fileId);}return operation;
}

// Trial planning never asserts technical approval and cannot be sent to move().
export function trialCandidates(items,{includeHeld=false}={}){return items.filter(x=>x.origin==='crop-local'&&x.touched===true&&(x.rating==='o'||includeHeld&&x.rating==='h')&&validId(x.imageId)).map(x=>({id:x.imageId,candidateId:x.candidate||null,phrase:x.phrase||'',name:x.sequenceLabel?(x.sequenceLabel+' '+(x.phrase||'')):x.name,mimeType:'image/png',localItemId:x.id,trial:true,sourceRating:x.rating,fromHold:x.rating==='h',technicalStatus:x.technicalPassed===true?'pass':'review'}));}
export function prepareTrialSubmission(draft,files,{characterId,id,at=new Date().toISOString()}){
 if(!validId(characterId)||!validId(id)||!Array.isArray(draft.sets)||!draft.sets.length||draft.sets.length>20)throw Error('セットを作成してください。');
 const counts=setCounts(draft),setIds=new Set(counts.map(s=>s.id));if(setIds.size!==counts.length||counts.some(s=>!validId(s.id)||!SET_COUNTS.includes(s.target)||!s.name?.trim()||s.name.length>60))throw Error('セット名・目標枚数を確認してください。');
 const selected=counts.filter(s=>s.count>0);if(!selected.length||selected.some(s=>s.count!==s.target))throw Error('画像を目標枚数に合わせてください。');
 const byId=new Map(files.map(f=>[f.id,f]));if(byId.size!==files.length)throw Error('候補IDが重複しています。');
 const entries=Object.entries(draft.assignments).map(([fileId,setId])=>{const f=byId.get(fileId);if(!setIds.has(setId)||!validId(fileId)||!f?.localItemId||f.trial!==true)throw Error('試用候補の対応を確認できません。');return {fileId,setId,name:f.name,imageId:f.id,localItemId:f.localItemId,...(f.fromHold?{sourceRating:'h',fromHold:true}:{})};});
 entries.splice(0,entries.length,...orderPlanEntries(draft,files,entries));
 return {schema:'animal-stickers-submission-trial/v1',purpose:'selection-test-only',technicalApproval:false,id,characterId,at,sets:selected.map(({id,name,target})=>({id,name:name.trim(),target})),entries};
}

// Seed only a new draft (or previously unseen candidates). Explicit exclusions survive reload.
export function defaultAllSelected(draft,files,{preserveExisting=false}={}){
 const next=structuredClone(draft);if(!next.sets.length)return next;
 const seen=new Set(next.seenCandidateIds||(preserveExisting?files.map(f=>f.id):[]));
 for(const f of files)if(!seen.has(f.id)){if(!next.assignments[f.id])next.assignments[f.id]=next.sets[0].id;seen.add(f.id);}
 next.seenCandidateIds=[...seen];return next;
}

/** Keep historical duplicate selections recoverable without counting them as current candidates.
 * Only reconcile when the replacement is the same character/candidate in a reviewed cohort.
 * Any image in use as main/tab remains an explicit conflict, never silently reassigned.
 */
export function isolateLegacyTrialAssignments(draft,files,items,{completeReviewedCohort=[]}={}){
 const result=structuredClone(draft),valid=new Set(files.map(f=>f.id));
 const currentByCandidate=new Map();
 for(const f of files){if(f.candidateId){if(currentByCandidate.has(f.candidateId))return result;currentByCandidate.set(f.candidateId,f.id);}}
 if(!currentByCandidate.size)return result;
 const past=new Map(items.map(i=>[i.imageId,i])),artworkIds=new Set(Object.values(result.artwork||{}).flatMap(a=>[a.mainId,a.tabId]).filter(Boolean));
 // Incomplete streaming loads must never purge an earlier user's set.
 // A full reviewed cohort has unique candidate IDs, all in one character, and
 // enough records to rule out an incremental first-page import.
 const review=completeReviewedCohort.filter(x=>x.crop?.reviewDisplay===true);
 const complete=review.length>=81&&review.length===completeReviewedCohort.length&&review.every(x=>x.imageId&&x.candidate&&/^[-\w]{2,100}$/.test(x.candidate))&&new Set(review.map(x=>x.candidate)).size===review.length&&new Set(review.map(x=>x.imageId)).size===review.length;
 const cohortIds=new Set(review.map(x=>x.imageId));
 const cohortCandidates=new Set(review.map(x=>x.candidate));
 // Only a complete verified cohort can supersede prior allocations.
 // Partial streaming imports must not alter existing selections.
 if(!complete)return result;
 for(const [id,setId] of Object.entries(result.assignments||{})){
  if(valid.has(id)||artworkIds.has(id))continue;
  const source=past.get(id),replacement=source?.candidate&&currentByCandidate.get(source.candidate);
  // Preserve unmatched history when no full authoritative cohort is loaded.
  // With a verified complete review, all older IDs are archived instead of
  // retaining an excluded or otherwise missing image in the set count.
  if(!complete&&!replacement)continue;
  if(complete&&cohortIds.has(id))continue; // Guard against missing current files.
  if(complete&&source?.candidate&&!cohortCandidates.has(source.candidate))continue; // Candidate from another cohort: do not alter.
  if(replacement===id)continue;
  result.legacyDuplicateAssignments??={};
  if(!result.legacyDuplicateAssignments[id])result.legacyDuplicateAssignments[id]={
   setId,candidateId:source?.candidate||null,replacementImageId:replacement||null,
   reason:complete?'superseded-by-complete-review':'superseded-by-current-reviewed-candidate'
  };
  delete result.assignments[id];
 }
 return result;
}
