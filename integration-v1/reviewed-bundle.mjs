import {gate,inspect} from './crop-v9/core.mjs?v=20261023-bear1';
export async function reviewedBundle(zip,master,{decode}){
 const file=zip.file('technical-review.json');
 if(!file)throw Error('技術検品の記録がありません');
 const raw=await file.async('string');if(raw.length>1000000)throw Error('検品記録が大きすぎます');
 const manifest=JSON.parse(raw);
 if(manifest.schema!=='animal-stickers-reviewed-crops/v1'||!Array.isArray(manifest.entries)||!manifest.entries.length||manifest.entries.length>64)throw Error('検品記録の形式が不正です');
 if(!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+(?:\/edit)?$/.test(manifest.masterReference||''))throw Error('参照マスターが不明です');
 const ids=new Set(),names=new Set(),entries=[];
 for(const entry of manifest.entries){
  const r=entry.record,m=master.find(x=>x.candidateId===r?.candidateId);
  if(!r||!m||m.phrase!==r.phrase||m.pose!==r.pose||gate(r)!=='pass'||!r.inspection?.at||r.inspection?.scope!=='actual-source')throw Error('技術合格・候補・検品記録を照合できません');
  if(!/^[-A-Za-z0-9_]+\.png$/.test(r.filename||'')||ids.has(r.imageId)||names.has(r.filename))throw Error('画像ID・ファイル名が不正または重複しています');
  const pngFile=zip.file(r.filename);if(!pngFile)throw Error('検品済みPNGがありません');
  const png=await pngFile.async('arraybuffer');if(png.byteLength>15000000)throw Error('PNGが大きすぎます');
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',png))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(sha!==entry.sha256)throw Error('検品後にPNGが変更されています');
  const qa=inspect(await decode(new Blob([png],{type:'image/png'})),r.crossing);
  if(gate({...r,qa})!=='pass')throw Error('PNG実画素の再検査に失敗しました');
  ids.add(r.imageId);names.add(r.filename);entries.push({record:{...r,qa,masterReference:manifest.masterReference},png});
 }
 return entries;
}
