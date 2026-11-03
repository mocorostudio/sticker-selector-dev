import {automaticInspection,inspectionDecision,inspectionIdentity,pngHash,visualChecks} from './inspection-core.mjs?v=20261104-efficient1';

// Each entry is an explicit visual decision for one exact PNG and candidate.
// A report never supplies machine QA, candidate assignments or user selections.
export async function importInspectionReport(items,report,{get,decode,save}){
 if(report?.schema!=='animal-stickers-visual-report/v1'||typeof report.reviewer!=='string'||!report.reviewer.trim()||!Array.isArray(report.entries)||!report.entries.length||report.entries.length>130)throw Error('検品レポート形式不正');
 const ids=new Set(),staged=[];let existing=0;
 for(const entry of report.entries){
  if(!entry||ids.has(entry.imageId))throw Error('検品画像ID重複');ids.add(entry.imageId);
  const matches=items.filter(x=>x.imageId===entry.imageId&&x.origin==='crop-local');
  if(matches.length!==1)throw Error('対象画像が不明または重複');
  const item=matches[0],identity=inspectionIdentity(item),before=JSON.stringify([item.inspectionAudit,item.inspectionHistory,item.technicalPassed,item.technicalStatus]);
  if(!item.candidate||!item.pose||typeof item.phrase!=='string'||entry.identity!==identity||!/^\d{4}-\d\d-\d\dT/.test(entry.reviewedAt||'')||!Number.isFinite(Date.parse(entry.reviewedAt)))throw Error('候補対応または目視確認日時が不正');
  if(!Array.isArray(entry.checks)||entry.checks.length!==visualChecks.length||!entry.checks.every(x=>typeof x==='boolean'))throw Error('画像ごとの全検品項目が必要です');
  const blob=await get(item.id);
  if(!blob||entry.sha256!==await pngHash(blob))throw Error('検品レポートと実PNGが不一致');
  const automatic=await automaticInspection(item,blob,decode);
  const audit={...inspectionDecision(automatic,entry.decision,entry.checks,entry.comment||'',entry.reviewedAt),reviewer:report.reviewer.trim(),reportSchema:report.schema};
  const old=item.inspectionAudit;
  if(old?.identity===audit.identity&&old.sha256===audit.sha256&&old.decision===audit.decision&&old.reviewedAt===audit.reviewedAt&&old.reviewer===audit.reviewer&&old.comment===audit.comment&&JSON.stringify(old.checks)===JSON.stringify(audit.checks)){existing++;continue;}
  staged.push({item,identity,before,audit,blob});
 }
 // Recheck after asynchronous preflight. No writes on a stale/partially valid report.
 for(const s of staged){if(!items.includes(s.item)||inspectionIdentity(s.item)!==s.identity||JSON.stringify([s.item.inspectionAudit,s.item.inspectionHistory,s.item.technicalPassed,s.item.technicalStatus])!==s.before||await pngHash(await get(s.item.id))!==s.audit.sha256)throw Error('検品中に対象が変更されました');}
 const snapshots=staged.map(({item})=>({item,fields:Object.fromEntries(['inspectionAudit','inspectionHistory','technicalPassed','technicalStatus'].map(k=>[k,{present:Object.hasOwn(item,k),value:item[k]}]))}));
 try{
  for(const {item,audit} of staged){item.inspectionAudit=audit;item.inspectionHistory=[...(item.inspectionHistory||[]),structuredClone(audit)];if(item.candidateManifest&&(audit.decision!=='pass'||audit.qa.automatic!=='pass')){item.technicalPassed=false;item.technicalStatus='review';}}
  if(staged.length)await save();
 }catch(error){for(const {item,fields} of snapshots)for(const [key,old] of Object.entries(fields)){if(old.present)item[key]=old.value;else delete item[key];}throw error;}
 return {updated:staged.length,existing};
}
