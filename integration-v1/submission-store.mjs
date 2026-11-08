import {parseStoredJSON,saveStoredJSON,compactStoredJSON,isStorageQuotaError} from './selection-storage.mjs?v=20261108-submissionquota1';
// Keep the existing key format: URL versions and view switches never create another draft.
export const submissionKey=(pathname,characterId,trial=true)=>(trial?'submission-trial-draft:':'submission-draft:')+pathname+':'+characterId;
export function readSubmission(store,key){const raw=store.getItem(key);if(raw===null)return null;let value;try{value=parseStoredJSON(raw);}catch{throw Error('保存済みの申請作業を読めません。上書きせず停止しました。');}if(!value||!Array.isArray(value.draft?.sets)||!value.draft.assignments||typeof value.draft.assignments!=='object')throw Error('保存済みの申請作業の形式を確認できません。上書きせず停止しました。');return value;}
// Only re-encode records whose existing readers support this lossless format.
// Unrelated applications, PNGs in IndexedDB, votes and historical draft values are untouched.
export function compactSubmissionSpace(store){
 if(typeof store.key!=='function'||!Number.isInteger(store.length))return 0;
 const keys=Array.from({length:store.length},(_,i)=>store.key(i));let freed=0;
 for(const key of keys){
  if(typeof key!=='string')continue;
  const submission=/^submission-(?:trial-)?draft:/.test(key),selection=/^sticker-selector-v9:(?:crop-workflow|drive-test):/.test(key);
  if(!submission&&!selection)continue;
  let value;try{value=parseStoredJSON(store.getItem(key));}catch{continue;}
  if(submission&&(!Array.isArray(value?.draft?.sets)||!value.draft.assignments)||selection&&!Array.isArray(value?.items))continue;
  try{freed+=compactStoredJSON(store,key);}catch(error){if(!isStorageQuotaError(error))throw error;}
 }
 return freed;
}
export function writeSubmission(store,key,value){
 const previous=readSubmission(store,key),raw=JSON.stringify(value);
 if(previous!==null&&JSON.stringify(previous)===raw)return;
 const write=()=>{
  if(previous!==null){
   const original=key+':before-persistence-fix';if(store.getItem(original)===null)saveStoredJSON(store,original,previous);
   saveStoredJSON(store,key+':previous',previous);
  }
  saveStoredJSON(store,key,value);
 };
 try{write();}catch(error){
  if(!isStorageQuotaError(error))throw error;
  compactSubmissionSpace(store);
  try{write();}catch(retry){if(!isStorageQuotaError(retry))throw retry;throw Error('端末の保存容量が不足しています。以前の選択・並び順・メイン・タブは残しています。サイトデータは削除せず、この画面を残してください。');}
 }
}
export function availableRecovery(store,key){const current=store.getItem(key);for(const suffix of [':before-persistence-fix',':previous']){const raw=store.getItem(key+suffix);if(!raw||raw===current)continue;try{const value=parseStoredJSON(raw);if(value?.draft?.sets?.length&&(Object.keys(value.draft.artwork||{}).length||Object.keys(value.draft.orders||{}).length))return value;}catch{}}return null;}
export function selectAllAdopted(draft,files,setId){if(!draft.sets.some(s=>s.id===setId))throw Error('セットを選んでください。');const next=structuredClone(draft),seen=new Set(next.seenCandidateIds||[]);for(const f of files){if(f.fromHold)continue;if(!next.assignments[f.id]||next.assignments[f.id]===setId)next.assignments[f.id]=setId;seen.add(f.id);}next.seenCandidateIds=[...seen];return next;}
// A legacy local draft can be associated only by all referenced image IDs matching this character.
export function legacySubmission(store,{pathname,characterId,trial,files}){const current=submissionKey(pathname,characterId,trial),known=new Set(files.map(f=>f.id)),keys=new Set([submissionKey(pathname,characterId,!trial),submissionKey(pathname,'local-trial',trial)]),matches=[];for(const key of keys){if(key===current)continue;let value;try{value=readSubmission(store,key);}catch{continue;}const d=value?.draft;if(!d?.sets?.length||!Object.keys(d.artwork||{}).length&&!Object.keys(d.orders||{}).length)continue;const refs=[...Object.keys(d.assignments),...Object.values(d.orders||{}).flat(),...Object.values(d.artwork||{}).flatMap(a=>[a.mainId,a.tabId]).filter(Boolean)];if(refs.length&&refs.every(id=>known.has(id)))matches.push({draft:structuredClone(d),operation:null});}return matches.length===1?matches[0]:null;}
// Apply only explicit rating transitions; keep application edits and unchecked adopted candidates.
export function reconcileSelectionRatings(draft,items,{characterId,setId}={}){
 const next=structuredClone(draft),previous=next.selectionRatings||{},ratings={...previous},target=next.sets.some(s=>s.id===setId)?setId:next.sets[0]?.id;
 for(const item of items){if((item.characterId||item.crop?.pendingDrive?.characterId)!==characterId||item.origin!=='crop-local'||!item.touched||!item.imageId||!['o','h','x'].includes(item.rating))continue;
  const id=item.imageId;ratings[id]=item.rating;
  if(item.rating==='x')delete next.assignments[id];
  else if(item.rating==='o'&&['h','x'].includes(previous[id])&&target&&!next.assignments[id])next.assignments[id]=target;
 }
 next.selectionRatings=ratings;return next;
}

