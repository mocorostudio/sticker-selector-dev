import {buildCandidateManifest} from './candidate-manifest.mjs';
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const validRef=x=>typeof x==='string'&&/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+\/edit$/.test(x);
const pngSignature=[137,80,78,71,13,10,26,10];
const hex=bytes=>[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
// Strict nine-cell handoff. Does not infer characters, mapping, or inspection approval.
export async function buildVerifiedNineCellManifest({entries,assignments,master,masterReference,masterVerified=false,subtle=globalThis.crypto?.subtle}){
 if(masterVerified!==true||!validRef(masterReference)||!Array.isArray(master)||!master.length)throw Error('最新キャラ別マスターの取得・照合が必要です');
 if(!Array.isArray(entries)||entries.length!==9||!Array.isArray(assignments)||assignments.length!==9)throw Error('3×3の9候補を指定してください');
 if(!subtle?.digest)throw Error('SHA-256が使えません');
 const records=[],images=new Set();
 for(const entry of entries){
  const r=entry?.record;
  if(!validId(r?.imageId)||images.has(r.imageId)||!(entry.png instanceof ArrayBuffer))throw Error('PNG実体または画像IDが不正です');
  images.add(r.imageId);
  const bytes=new Uint8Array(entry.png);
  if(bytes.length<24||bytes.length>15e6||!pngSignature.every((v,i)=>bytes[i]===v))throw Error('PNG形式不正');
  const hash=hex(new Uint8Array(await subtle.digest('SHA-256',entry.png)));
  if(r.pngSha256!==hash)throw Error('PNG実体と検品記録のハッシュが一致しません');
  records.push(r);
 }
 const slots=new Set(),candidates=new Set(),mapped=new Set(),batches=new Set();
 for(const a of assignments){
  if(!validId(a?.imageId)||!validId(a?.candidateId)||!validId(a?.batchId)||!Number.isInteger(a?.slot)||a.slot<1||a.slot>9)throw Error('候補ID・バッチ・セル位置が不正です');
  if(slots.has(a.slot)||candidates.has(a.candidateId)||mapped.has(a.imageId))throw Error('セル・候補ID・画像IDが重複しています');
  slots.add(a.slot);candidates.add(a.candidateId);mapped.add(a.imageId);batches.add(a.batchId);
  if(!images.has(a.imageId))throw Error('切り出し画像と明示対応が一致しません');
 }
 if(slots.size!==9||mapped.size!==9||batches.size!==1)throw Error('独立した3×3バッチの9セルが必要です');
 return {...buildCandidateManifest(assignments,master,records),masterReference};
}
