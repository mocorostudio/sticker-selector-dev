// Lossless, synchronous storage for large selection histories. PNGs stay in IndexedDB.
// Existing plain JSON remains readable and small drafts keep their original format.
const SCHEMA='animal-stickers-selection-state/packed-v1';
function pack(value){
 const strings=[],ids=new Map();
 const intern=s=>{if(!ids.has(s)){ids.set(s,strings.length);strings.push(s);}return ids.get(s);};
 const encode=v=>{
  if(typeof v==='string')return [0,intern(v)];
  if(Array.isArray(v))return [1,v.map(encode)];
  if(v!==null&&typeof v==='object')return [2,Object.entries(v).flatMap(([k,x])=>[intern(k),encode(x)])];
  return v;
 };
 const data=encode(value);return JSON.stringify({schema:SCHEMA,strings,data});
}
export function parseStoredJSON(raw){
 if(raw===null||raw===undefined)return null;
 const value=JSON.parse(raw);if(value?.schema!==SCHEMA)return value;
 const strings=value.strings;if(!Array.isArray(strings)||strings.some(s=>typeof s!=='string'))throw Error('選抜情報の保存形式を確認できません。データは削除していません。');
 const string=i=>{if(!Number.isInteger(i)||i<0||i>=strings.length)throw Error('選抜情報の参照が不正です。データは削除していません。');return strings[i];};
 const decode=v=>{
  if(!Array.isArray(v)){if(v===null||typeof v==='boolean'||typeof v==='number')return v;throw Error('選抜情報の保存形式が不正です。');}
  if(v.length!==2)throw Error('選抜情報の保存形式が不正です。');
  if(v[0]===0)return string(v[1]);
  if(v[0]===1&&Array.isArray(v[1]))return v[1].map(decode);
  if(v[0]===2&&Array.isArray(v[1])&&v[1].length%2===0){const out={};for(let i=0;i<v[1].length;i+=2)Object.defineProperty(out,string(v[1][i]),{value:decode(v[1][i+1]),enumerable:true,writable:true,configurable:true});return out;}
  throw Error('選抜情報の保存形式が不正です。');
 };
 return decode(value.data);
}
export function parseSelectionState(raw){const out=parseStoredJSON(raw);if(raw&&JSON.parse(raw)?.schema===SCHEMA&&(!out||!Array.isArray(out.items)))throw Error('選抜画像の一覧が不正です。データは削除していません。');return out;}
export const readSelectionState=(storage,key)=>parseSelectionState(storage.getItem(key));
const quota=e=>e?.name==='QuotaExceededError'||e?.code===22||e?.code===1014||/quota/i.test(e?.message||'');
export function saveStoredJSON(storage,key,state){
 const raw=JSON.stringify(state),wasPacked=storage.getItem(key)?.includes('"schema":"'+SCHEMA+'"');
 // A single atomic replacement frees space without deleting any old images or votes.
 const compact=()=>pack(JSON.parse(raw));
 let encoded=raw;
 if(wasPacked||raw.length>1000000){const packed=compact();if(packed.length<raw.length)encoded=packed;}
 try{storage.setItem(key,encoded);}catch(error){
  if(!quota(error)||encoded!==raw)throw error;
  encoded=compact();if(encoded.length>=raw.length)throw error;storage.setItem(key,encoded);
 }
 if(storage.getItem(key)!==encoded)throw Error('選抜情報の端末保存を照合できません。現在の選択を保持しています。');
 return {packed:encoded!==raw,characters:encoded.length,originalCharacters:raw.length};
}


// Shared lossless codec: submission drafts retain their existing keys and plain JSON shape.
export const saveSelectionState=saveStoredJSON;
export const isStorageQuotaError=quota;
export function compactStoredJSON(storage,key){
 const raw=storage.getItem(key);if(raw===null)return 0;const value=parseStoredJSON(raw),encoded=pack(value);
 if(encoded.length>=raw.length)return 0;
 storage.setItem(key,encoded);if(storage.getItem(key)!==encoded)throw Error('端末保存の照合に失敗しました。データは削除していません。');
 return raw.length-encoded.length;
}
