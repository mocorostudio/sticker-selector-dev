import {inspectionIdentity,pngHash} from './inspection-core.mjs?v=20261030-reviewlabels1';
import {gate} from './crop-v9/core.mjs';

const strings=value=>Array.isArray(value)?value.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):[];
const reasons=(...values)=>[...new Set(values.flatMap(v=>typeof v==='string'&&v.trim()?[v.trim()]:strings(v)))];
const summary=(status,detail,source)=>({status,label:{fail:'× 明らかな不良',review:'△ 注意点あり',pass:'問題なし（検品済み）',unknown:'未検品・未確認'}[status],reasons:detail,source});
// Display only: never changes votes, technical approval, or submission eligibility.
export async function inspectionSummary(item,blob){
 if(!blob)return summary('unknown',['画像を取得できないため検品記録を照合できません。'],'unverified');
 const sha=await pngHash(blob),audit=item.inspectionAudit;
 if(audit){
  if(audit.imageId!==item.imageId||audit.identity!==inspectionIdentity(item)||audit.sha256!==sha)return summary('unknown',['画像または候補情報が変わっています。検品記録の再確認が必要です。'],'stale');
  const detail=reasons(audit.comment,audit.qa?.issues);
  if(audit.decision==='fail')return summary('fail',detail.length?detail:['理由未記録。検品画面で確認してください。'],'inspection');
  if(audit.decision==='review')return detail.length?summary('review',detail,'inspection'):summary('unknown',['一次検査済み。目視確認と理由の記録は未完了です。'],'inspection');
  if(audit.decision==='pass'&&audit.qa?.automatic==='pass'&&audit.checks?.length===9&&audit.checks.every(x=>x===true))return summary('pass',detail,'inspection');
  return summary('unknown',detail.length?detail:['検品記録が完了していません。'],'inspection');
 }
 const r=item.crop,proof=r?.pendingDrive;
 if(r&&r.imageId===item.imageId&&r.candidateId===item.candidate&&r.phrase===item.phrase&&r.pose===item.pose&&proof?.sha256===sha&&r.inspection?.scope==='actual-source'){
  const detail=reasons(r.inspection?.unresolved,r.inspection?.reasons,r.reviewReason,r.inspection?.comment,r.qa?.issues);
  if(r.decision==='fail')return summary('fail',detail.length?detail:['理由未記録。検品画面で確認してください。'],'source');
  if(gate(r)==='pass')return summary('pass',detail,'source');
  if(detail.length)return summary('review',detail,'source');
 }
 return summary('unknown',['検品結果・理由の記録がありません。'],'missing');
}

export function renderInspectionSummary(host,value){
 host.replaceChildren();host.dataset.inspectionStatus=value.status;
 const title=document.createElement('strong');title.textContent='ルイの検品：'+value.label;host.append(title);
 if(value.reasons.length){const list=document.createElement('ul');for(const reason of value.reasons){const line=document.createElement('li');line.textContent=reason;list.append(line);}host.append(list);}
 const note=document.createElement('small');note.textContent='下の◯△×は、あなたの採用希望です。検品結果とは別に保存します。';host.append(note);
}
