import {auditedCandidateBinding} from './inspection-core.mjs';
import {buildCandidateManifest} from './candidate-manifest.mjs';

// Retain the explicit complete sheet mapping, but recover its inspected good
// cells independently. Missing/review/failed evidence never grants approval.
export async function prepareApprovedBatch({items,assignments,current,get}){
 if(!Array.isArray(assignments)||assignments.length!==9||new Set(assignments.map(a=>a.imageId)).size!==9||new Set(assignments.map(a=>a.candidateId)).size!==9||new Set(assignments.map(a=>a.slot)).size!==9||assignments.some(a=>!Number.isInteger(a.slot)||a.slot<1||a.slot>9)||new Set(assignments.map(a=>a.batchId)).size!==1)throw Error('重複しない9セルの明示対応が必要です');
 if(!current?.characterId||!current.modifiedTime||!current.masterSheet||!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+\/edit$/.test(current.masterReference||''))throw Error('最新キャラ別マスターを照合できません');
 const entries=[],accepted=[],excluded=[];
 for(const a of assignments){
  const matches=items.filter(x=>x.imageId===a.imageId),m=current.master.find(x=>x.candidateId===a.candidateId);
  const item=matches[0];
  if(matches.length!==1||!m||item.candidate!==m.candidateId||item.phrase!==m.phrase||item.pose!==m.pose||a.phrase!==m.phrase||a.pose!==m.pose)throw Error('最新マスターと画像対応が不一致');
  if(item.inspectionAudit?.decision!=='pass'){
   excluded.push({imageId:item.imageId,candidateId:item.candidate,status:item.inspectionAudit?.decision||'unknown',reason:item.inspectionAudit?.comment||'目視検品未完了'});
   continue;
  }
  // A claimed pass with stale/incomplete evidence is an error, not a skip.
  const blob=await get(item.id),binding=await auditedCandidateBinding(item,blob,current.master,a),r=item.crop;
  if(!r||r.imageId!==item.imageId||r.filename!==item.name||r.pngSha256&&r.pngSha256!==binding.sha256||r.candidateId&&r.candidateId!==m.candidateId||r.phrase&&r.phrase!==m.phrase||r.pose&&r.pose!==m.pose)throw Error('元画像と検品記録が不一致');
  const audit=item.inspectionAudit;
  const record={...r,candidateId:m.candidateId,phrase:m.phrase,pose:m.pose,pngSha256:binding.sha256,qa:structuredClone(audit.qa),technicalStatus:'pass',decision:'pass',review:[...audit.checks],inspection:{scope:'actual-source',at:audit.reviewedAt,audit:structuredClone(audit),visualPassed:true,phraseVerified:true,anatomyVerified:true,styleVerified:true,alphaVerified:true,candidateBinding:binding}};
  entries.push({record,png:await blob.arrayBuffer()});accepted.push(a);
 }
 if(!entries.length)return {entries,manifest:null,excluded};
 const manifest={...buildCandidateManifest(accepted,current.master,entries.map(e=>e.record)),masterReference:current.masterReference,characterId:current.characterId,masterModifiedTime:current.modifiedTime,masterSheet:current.masterSheet};
 return {entries,manifest,excluded};
}
