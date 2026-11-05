// Classification never grants approval. Unknown failures remain failures.
export function classifyInspection(decision,reason=''){
 if(decision!=='fail')return decision;
 const parts=reason.split(/[。\n；;]/).map(x=>x.trim()).filter(Boolean);
 const severe=/誤字|脱字|濁点|文字.*欠落|混入|増殖|重大|使用不能/;
 const minor=/小物.*(違|不一致)|ポーズ.*(違|不一致)|軽微|小さな透過ノイズ|画風の差|表情が不自然|輪郭や余白/;
 return parts.length&&parts.every(x=>minor.test(x)&&!severe.test(x))?'review':'fail';
}
