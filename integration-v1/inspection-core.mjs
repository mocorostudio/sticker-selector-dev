import {classifyInspection} from './inspection-policy.mjs';
import {inspect,visualChecks} from './crop-v9/core.mjs';
export {visualChecks};
export async function pngHash(blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function inspectionIdentity(item){return JSON.stringify([item.imageId,item.candidate||'',item.phrase||'',item.pose||'',!!item.crop?.crossing]);}
export async function automaticInspection(item,blob,decode,at=new Date().toISOString()){
 if(!blob||blob.type!=='image/png'||blob.size<24||blob.size>15000000)throw Error('実PNGを読み込めません。');
 const sha256=await pngHash(blob),qa=inspect(await decode(blob),item.crop?.crossing===true),identity=inspectionIdentity(item),previous=item.inspectionAudit;
 if(item.crop?.transparencyCleanup?.status==='hold'){qa.issues=[...new Set([...qa.issues,...item.crop.transparencyCleanup.issues])];qa.automatic='fail';}
 const same=previous?.sha256===sha256&&previous.identity===identity;
 return {schema:'animal-stickers-inspection/v1',imageId:item.imageId,identity,sha256,at,qa,checks:same?[...(previous.checks||[])]:Array(visualChecks.length).fill(false),decision:same&&(previous.decision==='fail'||qa.automatic==='pass')?previous.decision:'review',comment:same?previous.comment||'':'',...(same&&previous.reviewedAt?{reviewedAt:previous.reviewedAt}:{}),size:blob.size};
}
export function inspectionDecision(audit,decision,checks,comment='',at=new Date().toISOString()){
 if(!['pass','review','fail'].includes(decision))throw Error('検品結果が不正です。');
 if(['review','fail'].includes(decision)&&!comment.trim())throw Error('×・△には具体的な理由を入力してください。');
 if(decision==='pass'&&(audit.qa?.automatic!=='pass'||checks.length!==visualChecks.length||!checks.every(x=>x===true)))throw Error('自動検査と目視確認をすべて完了してください。');
 decision=classifyInspection(decision,comment);
 return {...structuredClone(audit),checks:checks.map(x=>x===true),decision,comment,reviewedAt:at};
}
export async function verifyInspection(item,blob){const a=item.inspectionAudit;return !!a&&a.identity===inspectionIdentity(item)&&a.sha256===await pngHash(blob);}

// Existing reviewed-ZIP evidence is already an explicit per-image visual
// decision. Rebind those unchanged bytes to the fresh master without inventing
// a new visual audit or requiring the operator's browser to have created it.
export async function reviewedCandidateBinding(item,blob,master){
 const r=item?.crop,m=master?.find(x=>x.candidateId===item?.candidate),proof=r?.importedReview;
 if(!m||m.phrase!==item.phrase||m.pose!==item.pose||r?.imageId!==item.imageId||r.candidateId!==item.candidate||r.phrase!==item.phrase||r.pose!==item.pose)throw Error('検品済みZIPと最新マスターが不一致');
 if(proof?.source!=='reviewed-bundle'||!blob||blob.type!=='image/png'||proof.sha256!==await pngHash(blob)||r.pngSha256!==proof.sha256||r.decision!=='pass'||r.qa?.automatic!=='pass'||r.crossing!==false||r.review?.length!==visualChecks.length||!r.review.every(x=>x===true)||r.inspection?.scope!=='actual-source'||!Number.isFinite(Date.parse(r.inspection?.at)))throw Error('検品済みZIPの実画像・検品証拠が不一致');
 const a=item.inspectionAudit;if(a?.reviewedAt&&(!await verifyInspection(item,blob)||a.decision!=='pass'||a.qa?.automatic!=='pass'||a.checks?.length!==visualChecks.length||!a.checks.every(x=>x===true)))throw Error('新しい検品結果は技術合格ではありません');
 return {imageId:item.imageId,candidateId:item.candidate,phrase:item.phrase,pose:item.pose,sha256:proof.sha256};
}

// Derive candidate binding only from the inspected image's unchanged audit.
export async function auditedCandidateBinding(item,blob,master,assignment){
 const m=master?.find(x=>x.candidateId===assignment?.candidateId),a=item?.inspectionAudit;
 if(!m||m.phrase!==assignment.phrase||m.pose!==assignment.pose)throw Error('最新マスター不一致');
 if(item.imageId!==assignment.imageId||item.candidate!==m.candidateId||item.phrase!==m.phrase||item.pose!==m.pose)throw Error('検品対象と候補が不一致');
 if(!blob||blob.type!=='image/png'||!await verifyInspection(item,blob))throw Error('検品した実PNGが一致しません');
 if(a.imageId!==item.imageId||a.decision!=='pass'||a.qa?.automatic!=='pass'||!a.reviewedAt||!Array.isArray(a.checks)||a.checks.length!==visualChecks.length||!a.checks.every(x=>x===true))throw Error('目視・機械検品未完了');
 return {imageId:item.imageId,candidateId:m.candidateId,phrase:m.phrase,pose:m.pose,sha256:a.sha256,inspectionIdentity:a.identity};
}

// Stage metadata before visual inspection. An assignment never grants approval.
export function stageCandidateAssignments(items,assignments,master){
 if(!Array.isArray(assignments)||assignments.length!==9||new Set(assignments.map(a=>a.imageId)).size!==9||new Set(assignments.map(a=>a.candidateId)).size!==9)throw Error('9候補の重複しない対応が必要です');
 return assignments.map(a=>{
  const matches=items.filter(x=>x.imageId===a.imageId&&x.origin==='crop-local'),m=master.find(x=>x.candidateId===a.candidateId);
  if(matches.length!==1||!m||m.phrase!==a.phrase||m.pose!==a.pose)throw Error('最新マスターと画像対応が不一致');
  const item=matches[0];
  if(item.candidate&&item.candidate!==m.candidateId||item.phrase&&item.phrase!==m.phrase||item.pose&&item.pose!==m.pose)throw Error('既存の候補対応は変更できません');
  if(item.candidate===m.candidateId&&item.phrase===m.phrase&&item.pose===m.pose)return {item,next:item};
  return {item,next:{...item,candidate:m.candidateId,phrase:m.phrase,pose:m.pose,inspectionAudit:undefined,candidateBindingHistory:[...(item.candidateBindingHistory||[]),{at:new Date().toISOString(),candidateId:m.candidateId,phrase:m.phrase,pose:m.pose}]}};
 });
}
