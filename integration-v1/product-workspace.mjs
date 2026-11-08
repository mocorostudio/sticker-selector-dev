import {orderedFiles,moveBefore} from './submission-order.mjs?v=20261024-order1';
export const SCHEMA='animal-stickers-product-workspace/v1';
const id=x=>typeof x==='string'&&/^[-\w]{1,256}$/.test(x);
export const workspaceKey=w=>'product-workspace-draft:v1:'+w.characterId+':'+w.workspaceId;
export function validateWorkspace(w){
 if(w?.schema!==SCHEMA||!id(w.workspaceId)||!id(w.characterId)||!id(w.historyFolderId)||!id(w.archive?.fileId)||!/^[a-f0-9]{64}$/.test(w.archive?.sha256||'')||!Array.isArray(w.entries)||w.entries.length!==w.candidateCount||w.entries.length>400||!w.entries.length)throw Error('組み直しデータの形式・件数を確認できません。');
 const seen=new Set();for(const e of w.entries){if(!id(e.imageId)||!id(e.candidateId)||!/^[-\w]+\.png$/.test(e.filename)||typeof e.phrase!=='string'||e.technicalStatus!=='pass'||e.userRating!=='o'||!/^[a-f0-9]{64}$/.test(e.sha256)||e.sourceProof?.characterId!==w.characterId||e.sourceProof?.sha256!==e.sha256)throw Error('候補・元評価・合格記録の対応が不正です。');for(const k of ['imageId','candidateId','filename','sha256']){const key=k+':'+e[k];if(seen.has(key))throw Error('画像または候補が重複しています。');seen.add(key);}}
 validateDraft(w,w.draft);return w;
}
export function validateDraft(w,d){
 if(!Array.isArray(d?.sets)||!d.sets.length||d.sets.length>20||!d.assignments||typeof d.assignments!=='object')throw Error('編集中のセットを読めません。上書きせず停止しました。');
 const sets=new Set();for(const s of d.sets){if(!id(s.id)||sets.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>60||s.target!==40)throw Error('セット名・枚数が不正です。');sets.add(s.id);}
 const images=new Set(w.entries.map(e=>e.imageId));for(const [i,s] of Object.entries(d.assignments))if(!images.has(i)||!sets.has(s))throw Error('候補とセットの対応が不正です。');
 for(const [s,order] of Object.entries(d.orders||{}))if(!sets.has(s)||!Array.isArray(order)||new Set(order).size!==order.length||order.some(i=>!images.has(i)))throw Error('並び順に不明な画像があります。');return d;
}
export function assignWorkspace(w,d,imageId,setId){
 validateDraft(w,d);if(!w.entries.some(e=>e.imageId===imageId)||setId&&!d.sets.some(s=>s.id===setId))throw Error('移動先を確認してください。');
 const n=structuredClone(d);if(setId)n.assignments[imageId]=setId;else delete n.assignments[imageId];return n;
}
export function swapWorkspace(w,d,a,b){
 if(a===b)return d;const files=w.entries.map(e=>({id:e.imageId})),before={...d.assignments},sa=before[a],sb=before[b];if(!files.some(x=>x.id===a)||!files.some(x=>x.id===b))throw Error('入れ替える画像がありません。');
 const n=structuredClone(d);n.orders={...n.orders};for(const s of d.sets){const order=orderedFiles(d,files,s.id).map(x=>x.id);n.orders[s.id]=order.map(i=>i===a?b:i===b?a:i);}
 if(sb)n.assignments[a]=sb;else delete n.assignments[a];if(sa)n.assignments[b]=sa;else delete n.assignments[b];validateDraft(w,n);return n;
}
export function moveWorkspace(w,d,imageId,delta){
 const set=d.assignments[imageId];if(!set)throw Error('予備の並べ替えは不要です。先にセットへ入れてください。');const files=w.entries.map(e=>({id:e.imageId})),order=orderedFiles(d,files,set).map(e=>e.id),i=order.indexOf(imageId),j=i+delta;if(j<0||j>=order.length)return d;
 return moveBefore(d,files,set,imageId,delta<0?order[j]:order[j+1]||null);
}
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
// Workspace bundles are uncompressed ZIPs of already-compressed PNGs.
export async function readWorkspaceImages(w,bytes){
 const raw=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);if(raw.length>100000000||await sha256(raw)!==w.archive.sha256)throw Error('画像ZIPの内容が保存記録と一致しません。');const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),pngs=new Map(),known=new Map(w.entries.map(e=>[e.filename,e]));let at=0;
 while(at+4<=raw.length&&view.getUint32(at,true)===0x04034b50){if(at+30>raw.length)throw Error('ZIPが途中で切れています。');const flags=view.getUint16(at+6,true),method=view.getUint16(at+8,true),size=view.getUint32(at+18,true),unpacked=view.getUint32(at+22,true),len=view.getUint16(at+26,true),extra=view.getUint16(at+28,true),start=at+30+len+extra,end=start+size,name=new TextDecoder().decode(raw.subarray(at+30,at+30+len)),entry=known.get(name);
 if(flags&9||method!==0||size!==unpacked||!entry||end>raw.length||pngs.has(entry.imageId))throw Error('画像ZIPの形式・画像対応が不正です。');const data=raw.slice(start,end);if(await sha256(data)!==entry.sha256||data[0]!==137||String.fromCharCode(...data.slice(1,4))!=='PNG')throw Error('PNGの内容が保存記録と一致しません。');pngs.set(entry.imageId,new Blob([data],{type:'image/png'}));at=end;
 }if(pngs.size!==w.entries.length)throw Error('画像が不足しています。');return pngs;
}
