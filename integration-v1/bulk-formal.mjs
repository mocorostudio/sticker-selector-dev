import {stageCandidateAssignments} from './inspection-core.mjs?v=20261104-efficient1';
import {importInspectionReport} from './inspection-report.mjs?v=20261104-report1';
import {prepareAuditedFormalPayload} from './crop-v9/formal-sender.mjs?v=20261103-audited2';
import {prepareNineCellHandoff} from './strict-handoff-bridge.mjs?v=20261103-audited2';
import {importVerifiedCrops} from './crop-handoff.mjs?v=20261108-variants1';
import {prepareApprovedBatch} from './approved-batch.mjs';

// One live-master snapshot per operation. All changes are staged on clones;
// production state is updated only after every existing strict gate succeeds.
export async function registerBulkFormal(api,pending,job){
 if(job?.schema!=='animal-stickers-bulk-formal/v1'||!Array.isArray(job.assignments)||!job.assignments.length||job.assignments.length>126||job.assignments.length%9)throw Error('9候補単位の明示対応が必要です');
 if(job.registrationMode!==undefined&&!['all','approved-only'].includes(job.registrationMode))throw Error('登録方式が不正です');
 const original=api.items(),before=JSON.stringify(original),items=structuredClone(original),current=await pending.masterForCharacter(job.characterId);
 if(current?.characterId!==job.characterId||!current.modifiedTime)throw Error('最新マスターを照合できません');
 const groups=new Map(),images=new Set(),candidates=new Set();
 for(const a of job.assignments){
  if(images.has(a.imageId)||candidates.has(a.candidateId))throw Error('画像IDまたは候補ID重複');images.add(a.imageId);candidates.add(a.candidateId);
  if(!groups.has(a.batchId))groups.set(a.batchId,[]);groups.get(a.batchId).push(a);
 }
 // Resolve explicit assignment text from the live master; no grid inference.
 for(const [batchId,assignments] of groups){
  const resolved=assignments.map(a=>{const m=current.master.find(m=>m.candidateId===a.candidateId);if(!m)throw Error('最新マスター候補がありません');return {...a,phrase:m.phrase,pose:m.pose};});
  if(resolved.length!==9||new Set(resolved.map(a=>a.slot)).size!==9||resolved.some(a=>!Number.isInteger(a.slot)||a.slot<1||a.slot>9))throw Error('各バッチに重複しない9セルが必要です');
  for(const a of resolved){const item=items.find(x=>x.imageId===a.imageId);if(item?.characterId&&item.characterId!==job.characterId)throw Error('別キャラの画像は登録できません');}
  for(const {item,next} of stageCandidateAssignments(items,resolved,current.master))Object.assign(item,next);
  groups.set(batchId,resolved);
 }
 if(job.visualReport){
  if(job.visualReport.entries?.length!==images.size||job.visualReport.entries.some(e=>!images.has(e.imageId)))throw Error('検品記録と割当の件数・画像が不一致');
  await importInspectionReport(items,job.visualReport,{get:api.get,decode:api.decode,save:()=>{}});
 }
 const prepared=[],excluded=[];
 for(const assignments of groups.values()){
  if(job.registrationMode==='approved-only'){
   const result=await prepareApprovedBatch({items,assignments,current,get:api.get});
   excluded.push(...result.excluded);
   if(result.entries.length)prepared.push({payload:{entries:result.entries},manifest:result.manifest});
   continue;
  }
  const selected=assignments.map(a=>items.find(x=>x.imageId===a.imageId));
  const pngs=await Promise.all(selected.map(async item=>{const b=await api.get(item.id);if(!b)throw Error('実PNGがありません');return b.arrayBuffer();}));
  const payload=await prepareAuditedFormalPayload({records:selected.map(x=>x.crop),pngs,assignments,characterId:job.characterId,items,master:current.master});
  const verified=await prepareNineCellHandoff({pending:{masterForCharacter:async()=>current},...payload});
  prepared.push({payload,manifest:verified.manifest});
 }
 let promoted=0;
 for(const {payload,manifest} of prepared){
  const result=await importVerifiedCrops(payload.entries,{items:()=>items,get:api.get,decode:api.decode,write:async()=>{throw Error('既存PNG以外は登録できません');},promote:async(item,record)=>{
   const previous=item.candidateManifest,previousEntry=previous?.entries?.find(e=>e.imageId===item.imageId),nextEntry=manifest.entries.find(e=>e.imageId===item.imageId);
   const sameManifest=previous&&['masterReference','characterId','masterModifiedTime','masterSheet'].every(k=>previous[k]===manifest[k])&&JSON.stringify(previousEntry)===JSON.stringify(nextEntry);
   const same=item.technicalPassed===true&&item.crop?.pngSha256===record.pngSha256&&sameManifest&&JSON.stringify(item.crop?.inspection?.audit)===JSON.stringify(record.inspection.audit);
   if(same)return;
   item.formalRegistrationHistory=[...(item.formalRegistrationHistory||[]),{at:new Date().toISOString(),previousCrop:structuredClone(item.crop),manifest:structuredClone(manifest)}];
   Object.assign(item,{characterId:job.characterId,crop:structuredClone({...item.crop,...record}),technicalPassed:true,technicalStatus:'pass',technicalScope:'actual-source',masterSource:manifest.masterReference,candidateManifest:structuredClone(manifest)});promoted++;
  }},current.master,manifest);
  if(result.errors.length||result.ids.length!==payload.entries.length)throw Error('正式照合失敗：'+result.errors.map(e=>e.message).join('／'));
 }
 for(const e of excluded){const item=items.find(x=>x.imageId===e.imageId);if(item.technicalPassed){item.technicalPassed=false;item.technicalStatus='review';}}
 const result={registered:images.size-excluded.length,batches:groups.size,updated:promoted,...(job.registrationMode==='approved-only'?{excluded}: {})};
 if(api.items()!==original||JSON.stringify(original)!==before)throw Error('処理中に選抜または編集が変更されました。既存操作を保持して停止しました');
 if(!promoted&&JSON.stringify(items)===before)return result;
 api.replaceItems(items);
 try{await api.save();}catch(error){api.replaceItems(original);throw error;}
 return result;
}

export function initBulkFormal(api,pending){
 const details=document.createElement('details');details.innerHTML='<summary>詳細：複数バッチの正式対応・検品を一括登録</summary><p>画像別の検品記録と明示対応を最新マスターで照合し、合格画像だけを登録します。不合格・保留・未確認は元画像と記録を保持します。Drive保存は既存の保存ボタンから行います。</p><input type="file" accept=".json,application/json"><button>正式対応をまとめて照合・登録</button><p role="status"></p>';
 document.querySelector('#selectionScreen header').append(details);
 const input=details.querySelector('input'),button=details.querySelector('button'),status=details.querySelector('[role=status]');
 button.onclick=()=>api.withBusy(async()=>{button.disabled=true;try{await api.ready;const f=input.files[0];if(!f||f.size>2000000)throw Error('2MB以下の一括登録JSONを選んでください');const job=JSON.parse(await f.text());job.registrationMode??='approved-only';const result=await registerBulkFormal(api,pending,job);status.textContent='合格 '+result.registered+'候補を照合・端末登録しました。'+(result.excluded?.length?'保留・不合格・未確認 '+result.excluded.length+'候補は正式登録せず保持しています。':'')+'Drive保存は未実施です。';api.redraw();}catch(error){status.textContent='登録停止：'+error.message;}finally{button.disabled=false;}});
}
