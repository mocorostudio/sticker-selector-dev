import {splitState} from './workflow-core.mjs?v=20261021-flow2';
export async function openCropStorage(name){
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name,2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('state'))r.result.createObjectStore('state');if(!r.result.objectStoreNames.contains('assets'))r.result.createObjectStore('assets');};r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('別のタブを閉じてから、この画面を開き直してください。'));});
 function read(store,key){return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async function save(value){const {state,assets}=splitState(value);await new Promise((resolve,reject)=>{const tx=db.transaction(['state','assets'],'readwrite');for(const a of assets)tx.objectStore('assets').put(a.value,a.key);tx.objectStore('state').put(state,'current');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('端末保存が中断されました'));tx.onerror=()=>reject(tx.error);});return state;}
 async function load(){const saved=await read('state','current');if(!saved)return null;if(saved.version!==2)return save(saved);return saved;}
 return {load,save,image:id=>read('assets','source:'+id),pixels:id=>read('assets','record:'+id),close:()=>db.close()};
}
