import {inspect,visualChecks} from './crop-v9/core.mjs';
export {visualChecks};
export async function pngHash(blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function inspectionIdentity(item){return JSON.stringify([item.imageId,item.candidate||'',item.phrase||'',item.pose||'',!!item.crop?.crossing]);}
export async function automaticInspection(item,blob,decode,at=new Date().toISOString()){
 if(!blob||blob.type!=='image/png'||blob.size<24||blob.size>15000000)throw Error('実PNGを読み込めません。');
 const sha256=await pngHash(blob),qa=inspect(await decode(blob),item.crop?.crossing===true),identity=inspectionIdentity(item),previous=item.inspectionAudit;
 const same=previous?.sha256===sha256&&previous.identity===identity;
 return {schema:'animal-stickers-inspection/v1',imageId:item.imageId,identity,sha256,at,qa,checks:same?[...(previous.checks||[])]:Array(visualChecks.length).fill(false),decision:same&&qa.automatic==='pass'?previous.decision:'review',comment:same?previous.comment||'':'',size:blob.size};
}
export function inspectionDecision(audit,decision,checks,comment='',at=new Date().toISOString()){
 if(!['pass','review','fail'].includes(decision))throw Error('検品結果が不正です。');
 if(decision==='pass'&&(audit.qa?.automatic!=='pass'||checks.length!==visualChecks.length||!checks.every(x=>x===true)))throw Error('自動検査と目視確認をすべて完了してください。');
 return {...structuredClone(audit),checks:checks.map(x=>x===true),decision,comment,reviewedAt:at};
}
export async function verifyInspection(item,blob){const a=item.inspectionAudit;return !!a&&a.identity===inspectionIdentity(item)&&a.sha256===await pngHash(blob);}
