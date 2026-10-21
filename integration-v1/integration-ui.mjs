import {importCrops,confirmLocal} from './crop-handoff.mjs?v=20261021-batch1';
export function initWorkflow(api){
 const $=id=>document.getElementById(id),frame=$('cropFrame');let importing=false;
 function show(screen){const crop=screen==='crop';frame.hidden=!crop;$('selectionScreen').hidden=crop;for(const id of ['cropTab','selectionTab'])$(id).setAttribute('aria-selected',String(id===(crop?'cropTab':'selectionTab')));if(!crop)api.redraw();window.dispatchEvent(new Event('resize'));}
 $('cropTab').onclick=()=>show('crop');$('selectionTab').onclick=()=>show('selection');
 window.addEventListener('workflow-edit',event=>{if(!api.items().some(x=>x.origin==='crop-local'&&x.imageId===event.detail?.imageId))return;show('crop');frame.contentWindow.postMessage({type:'crop-edit-v1',imageId:event.detail.imageId},location.origin);});
 $('loadPending').textContent='切り出し画面へ';$('loadPending').onclick=()=>show('crop');
 $('sync').textContent='選抜を端末内で確定';$('mode').textContent='統合テスト版：切り出し→選抜。Driveへの送信なし。';
 $('driveStatus').textContent='◯・△・✕を選び、最後に端末内で確定してください。';
 $('sync').onclick=()=>api.withBusy(async()=>{const selected=api.visible().filter(x=>x.origin==='crop-local'&&x.touched);if(!selected.length){$('driveStatus').textContent='確定する選抜がありません。初期◯は未選抜です。';return;}if(!confirm(selected.length+'枚の選抜を端末内で確定します。'))return;const before=structuredClone(api.items());try{const count=confirmLocal(selected);api.save();api.redraw();$('driveStatus').textContent='端末内で確定 '+count+'件。Drive送信なし。';}catch(e){api.replaceItems(before);throw e;}});
 window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='crop-handoff-v1')return;
  const {requestId,entries}=event.data;if(typeof requestId!=='string')return;
  const reply=data=>frame.contentWindow.postMessage({type:'crop-handoff-result-v1',requestId,...data},location.origin);
  if(importing||api.isBusy()){reply({error:'処理中です。完了後にもう一度押してください。'});return;}
  importing=true;try{await api.ready;const master=await fetch('./crop-v9/master.json').then(r=>{if(!r.ok)throw Error('候補マスター読込失敗');return r.json();});let result;
   await api.withBusy(async()=>{result=await importCrops(entries,{items:api.items,get:api.get,decode:api.decode,write:async(item,blob)=>{await api.put(item.id,blob);api.items().push(item);try{api.save();}catch(e){api.replaceItems(api.items().filter(x=>x!==item));throw e;}}},master,{forSelection:event.data.forSelection===true});if(result.ids.length){api.setView(result.ids,event.data.append===true);api.redraw();}});
   if(!result)throw Error('受け渡しを完了できませんでした');reply(result);if(result.ids.length){show('selection');$('driveStatus').textContent='切り出しから追加 '+result.added+'枚／取込済み '+result.existing+'枚／失敗 '+result.errors.length+'件。Drive送信なし。';}
  }catch(e){reply({error:e.message});}finally{importing=false;}
 });
 show('crop');
}
