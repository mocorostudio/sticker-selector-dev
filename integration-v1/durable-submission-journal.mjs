import {submissionJournal,readSubmission,writeSubmission} from './submission-store.mjs?v=20261124-erasequota1';
// IndexedDB is a durable fallback, never an in-memory success or a deletion of old drafts.
export function journalDatabase(factory=globalThis.indexedDB){
 let opening;
 const open=()=>opening??=new Promise((resolve,reject)=>{if(!factory)return reject(Error('端末内の保存領域を開けません。'));const r=factory.open('animal-stickers-submission-journal-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('端末内保存の準備が別の画面で止まっています。'));});
 return {
  async entries(){const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction('records','readonly'),s=t.objectStore('records'),keys=s.getAllKeys(),values=s.getAll();t.oncomplete=()=>resolve(keys.result.map((k,i)=>[k,values.result[i]]));t.onabort=t.onerror=()=>reject(t.error||Error('再開記録を読み込めません。'));});},
  async put(key,value){const db=await open();await new Promise((resolve,reject)=>{const t=db.transaction('records','readwrite');t.objectStore('records').put(value,key);t.oncomplete=resolve;t.onabort=t.onerror=()=>reject(t.error||Error('再開記録を保存できません。'));});return new Promise((resolve,reject)=>{const t=db.transaction('records','readonly'),r=t.objectStore('records').get(key);t.oncomplete=()=>r.result===value?resolve():reject(Error('再開記録の照合に失敗しました。'));t.onabort=t.onerror=()=>reject(t.error);});}
 };
}
export function durableSubmissionJournal(storage,{database=journalDatabase()}={}){
 const local=submissionJournal(storage),shadow=new Map();let loadError=null;
 const ready=database.entries().then(entries=>{for(const [k,v] of entries)shadow.set(k,v);}).catch(error=>{loadError=error;});
 return {ready,
  readJournal(key){return shadow.has(key)?shadow.get(key):local.readJournal(key);},
  async writeJournal(key,value){await ready;
   // Once a key moved to IndexedDB, its old localStorage value is retained as history.
   if(!shadow.has(key)){try{local.writeJournal(key,value);return;}catch(error){if(!/容量|quota/i.test(error.message||''))throw error;}}
   try{if(loadError)throw loadError;await database.put(key,value);shadow.set(key,value);}catch(error){throw Error('端末の再開記録を保存できません。選択・編集は削除していません。'+(error.message||''));}
  }
 };
}

// Draft fallback shares the existing IndexedDB database with ZIP recovery.
// Legacy localStorage records remain readable and are never removed.
export function durableSubmissionDrafts(storage,{database=journalDatabase()}={}){
 const drafts=new Map();
 let loadError;
 const ready=database.entries().then(entries=>{
  for(const [key,value] of entries)if(key.endsWith(':durable-draft'))drafts.set(key,JSON.parse(value));
 }).catch(error=>{loadError=error;});
 return {
  ready,
  read(key){if(loadError)throw Error('端末の申請作業を開けません。画面を残して再試行してください。');return drafts.has(key+':durable-draft')?structuredClone(drafts.get(key+':durable-draft')):readSubmission(storage,key);},
  async write(key,value){
   await ready;
   const snapshot=structuredClone(value);
   const id=key+':durable-draft';
   const current=this.read(key);
   if(JSON.stringify(current)===JSON.stringify(snapshot))return;
   if(!drafts.has(id)){
    try{writeSubmission(storage,key,snapshot);return;}catch(error){if(!/保存容量が不足/.test(error.message||''))throw error;}
   }
   const record=JSON.stringify(snapshot);
   await database.put(id,record);
   drafts.set(id,snapshot);
  }
 };
}
