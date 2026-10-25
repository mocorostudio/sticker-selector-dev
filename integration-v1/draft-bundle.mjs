// Drafts remain in 03 and never establish technical approval.
export const DRAFT_SCHEMA='animal-stickers-selection-draft/v1';
export function validateDraft(value,{characterId,pendingFolderId,masters,historyId}){
 if(value?.schema!==DRAFT_SCHEMA||value.characterId!==characterId||value.pendingFolderId!==pendingFolderId||value.historyFolderId!==historyId||value.technicalPassed!==false||!Array.isArray(value.entries)||!value.entries.length||value.entries.length>200)throw Error('仮選抜記録のキャラ・保存先が一致しません。');
 const match=value.masterReference?.match(/^https:\/\/docs.google.com\/spreadsheets\/d\/([-\w]+)\/edit$/);
 if(!match||!masters.some(m=>m.id===match[1]&&m.parents?.length===1&&m.parents[0]===characterId))throw Error('仮選抜の参照マスターが一致しません。');
 if(typeof value.masterSheet!=='string'||!value.masterSheet||value.masterSheet.length>100||!/^[-\w]+$/.test(value.archive?.fileId||'')||!/^[a-f0-9]{64}$/.test(value.archive?.sha256||''))throw Error('仮選抜のファイル情報が不正です。');
 const seen=new Set();
 for(const e of value.entries){
  if(!/^[-\w]+\.png$/.test(e.filename||'')||!/^[-\w]{1,100}$/.test(e.imageId||'')||!e.candidateId||typeof e.phrase!=='string'||typeof e.pose!=='string'||!/^[a-f0-9]{64}$/.test(e.sha256||''))throw Error('仮選抜の候補情報が不正です。');
  for(const k of ['filename','imageId','candidateId']){const key=k+':'+e[k];if(seen.has(key))throw Error('仮選抜記録に重複があります。');seen.add(key);}
 }
 return match[1];
}
export async function unpackDraft(bytes,entries){
 if(!globalThis.JSZip)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';s.onload=resolve;s.onerror=()=>reject(Error('画像ZIPの読込準備に失敗しました。'));document.head.append(s);});
 const zip=await globalThis.JSZip.loadAsync(bytes),expected=new Set(entries.map(e=>e.filename));
 if(Object.values(zip.files).some(e=>!e.dir&&!expected.has(e.name)))throw Error('仮選抜ZIPに記録外のファイルがあります。');
 const result=new Map();let total=0;
 for(const e of entries){const file=zip.file(e.filename);if(!file)throw Error('仮選抜ZIPに画像が不足しています。');const png=await file.async('arraybuffer');total+=png.byteLength;if(png.byteLength>15e6||total>150e6)throw Error('仮選抜ZIPが大きすぎます。');result.set(e.filename,png);}
 return result;
}
