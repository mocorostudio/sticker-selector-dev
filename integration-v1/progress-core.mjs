export const SCHEMA='animal-stickers-progress/v1';
export const GROUPS={you:'あなたの確認待ち',lui:'ルイの作業待ち',hold:'保留箱',submitted:'申請済み',selling:'販売中',unknown:'進捗の照合待ち'};
export function folderId(url){try{const u=new URL(url);return u.origin==='https://drive.google.com'?u.pathname.match(/^\/drive\/folders\/([-\w]+)$/)?.[1]||null:null;}catch{return null;}}
export function parseMaster(rows){
 const h=rows[0]||[],col=name=>h.indexOf(name);
 if(['動物','フォルダ','申請状況'].some(n=>col(n)<0))throw Error('全体管理マスターの列を確認できません。');
 return rows.slice(1).filter(r=>r[col('動物')]).map(r=>({characterId:folderId(r[col('フォルダ')]),name:r[col('動物')],master:r[col('動物別マスター')],folder:r[col('フォルダ')],legacy:r[col('PNG保存状況')]||'',legacyApplication:r[col('申請状況')]||'',stage:'unknown',next:'ルイが保存・検品・選抜の現在地を照合する',updatedAt:null,source:'全体管理マスター（過去記録・要照合）',priority:50})).filter(r=>r.characterId);
}
export function validateProgress(doc){
 if(doc?.schema!==SCHEMA||!Array.isArray(doc.records)||doc.records.length>500)throw Error('進捗記録の形式が異なります。');
 for(const r of doc.records)if(!/^[-\w]{1,256}$/.test(r.characterId||'')||!Object.hasOwn(GROUPS,r.stage)||typeof r.next!=='string'||r.next.length>1000||!Number.isFinite(Date.parse(r.updatedAt))||typeof r.source!=='string'||!Number.isFinite(r.priority))throw Error('進捗記録の内容を確認できません。');
 return doc.records;
}
export function mergeProgress(base,documents){
 const map=new Map(base.map(r=>[r.characterId,{...r}]));
 for(const doc of documents)for(const event of validateProgress(doc)){
  const r=map.get(event.characterId);if(!r)continue;
  if(!r.updatedAt||event.updatedAt>r.updatedAt)map.set(event.characterId,{...r,...event,name:r.name,master:r.master,folder:r.folder});
 }
 return [...map.values()].sort((a,b)=>a.priority-b.priority||a.name.localeCompare(b.name,'ja'));
}
export function nextTask(records){return records.filter(r=>r.stage==='you').sort((a,b)=>a.priority-b.priority)[0]||null;}
export function localCounts(items,id){const rows=items.filter(r=>r.characterId===id);return {total:rows.length,rated:rows.filter(r=>r.touched).length,passed:rows.filter(r=>r.technicalPassed===true).length};}
