import {confirmLocal,isLocalConfirmed} from './crop-handoff.mjs?v=20261023-merge1';
export function selectionSummary(items){
 const summary={adopted:0,held:0,rejected:0,unrated:0,confirmed:0,pending:0};
 for(const item of items.filter(x=>x.origin==='crop-local')){if(!item.touched||!['o','h','x'].includes(item.rating)){summary.unrated++;continue;}summary[{o:'adopted',h:'held',x:'rejected'}[item.rating]]++;if(isLocalConfirmed(item))summary.confirmed++;else summary.pending++;}
 return summary;
}
export async function completeSelection(api){
 const selected=api.visible().filter(x=>x.origin==='crop-local'&&x.touched);
 if(selected.some(x=>!x.revision||!['o','h','x'].includes(x.rating)))throw Error('選択内容を確認できません。◯・△・✕を選び直してください。');
 if(!selected.length)return {saved:0,empty:true,...selectionSummary(api.visible())};
 const before=structuredClone(api.items());
 try{const saved=confirmLocal(selected);await api.save();return {saved,empty:false,...selectionSummary(api.visible())};}
 catch(e){api.replaceItems(before);throw e;}
}
