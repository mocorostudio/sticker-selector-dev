export function orderedFiles(draft,files,setId){
 const selected=files.filter(f=>draft.assignments[f.id]===setId),byId=new Map(selected.map(f=>[f.id,f])),seen=new Set(),result=[];
 for(const id of [...(draft.orders?.[setId]||[]),...selected.map(f=>f.id)])if(byId.has(id)&&!seen.has(id)){seen.add(id);result.push(byId.get(id));}
 return result;
}
const groups=[[/おはよう|こんにちは|こんばんは|はじめまして|よろしく/,0],[/了解|りょうかい|わかった|分かった|承知|(?:^|\W)ok(?:\W|$)|はーい|はい[！!。]?$/i,10],[/ありがと|感謝|助か/,20],[/お願い|おねがい|ください|どうぞ/,30],[/ごめん|すみません|申し訳|失礼/,40],[/仕事|しごと|会議|勉強|べんきょう|作業|手が離せ|忙し/,50],[/到着|着いた|向か|移動|電車|バス|運転|出発|行って|いって/,60],[/ごはん|ご飯|食事|食べ|買い物|お風呂|ふろ/,70],[/休憩|ゴロゴロ|ごろごろ|のんびり|ひま|暇|待って|待つ/,80],[/おつかれ|お疲れ|帰る|ただいま|おかえり|またね|おやすみ|寝る/,90]];
export function recommendedFiles(files){return files.map((f,index)=>({file:f,index,rank:groups.find(([pattern])=>pattern.test(f.phrase||f.name||''))?.[1]??85})).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(x=>x.file);}
export function changeOrder(draft,files,setId,ids,{action='move',at=new Date().toISOString()}={}){
 if(!draft.sets.some(s=>s.id===setId))throw Error('並び替えるセットがありません。');const before=orderedFiles(draft,files,setId).map(f=>f.id),valid=new Set(before);
 if(ids.length!==before.length||new Set(ids).size!==ids.length||ids.some(id=>!valid.has(id)))throw Error('並び替えの画像が一致しません。');
 if(ids.every((id,i)=>id===before[i]))return draft;
 const next=structuredClone(draft);next.orders={...next.orders,[setId]:[...ids]};next.orderUndo={...next.orderUndo,[setId]:[...(next.orderUndo?.[setId]||[]),before]};next.orderHistory=[...(next.orderHistory||[]),{setId,action,before,after:[...ids],at}];return next;
}
export function moveBefore(draft,files,setId,source,target){
 const ids=orderedFiles(draft,files,setId).map(f=>f.id);if(!ids.includes(source)||target!==null&&!ids.includes(target))throw Error('移動する画像が見つかりません。');if(source===target)return draft;
 const next=ids.filter(id=>id!==source);next.splice(target===null?next.length:next.indexOf(target),0,source);return changeOrder(draft,files,setId,next);
}
export function undoOrder(draft,files,setId){
 const stack=draft.orderUndo?.[setId]||[];if(!stack.length)return draft;const before=orderedFiles(draft,files,setId).map(f=>f.id),available=new Set(before),seen=new Set(),after=[];
 for(const id of [...stack.at(-1),...before])if(available.has(id)&&!seen.has(id)){seen.add(id);after.push(id);}
 const next=structuredClone(draft);next.orders={...next.orders,[setId]:after};next.orderUndo={...next.orderUndo,[setId]:stack.slice(0,-1)};next.orderHistory=[...(next.orderHistory||[]),{setId,action:'undo',before,after,at:new Date().toISOString()}];return next;
}
export function orderPlanEntries(draft,files,entries){return draft.sets.flatMap(s=>orderedFiles(draft,files,s.id).map((f,index)=>({...entries.find(e=>e.fileId===f.id&&e.setId===s.id),position:index+1})));}
export function matchesPlanOrder(draft,files,plan){const current=draft.sets.flatMap(s=>orderedFiles(draft,files,s.id).map(f=>s.id+':'+f.id)),planned=(plan.entries||[]).map(e=>e.setId+':'+e.fileId);return current.length===planned.length&&current.every((id,i)=>id===planned[i]);}
