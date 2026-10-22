import {importCrops} from './crop-handoff.mjs?v=20261021-complete1';
import {completeSelection} from './selection-completion.mjs?v=20261021-complete1';
import {initDriveExport} from './drive-export-ui.mjs?v=20261022-busy1';
export function initWorkflow(api){
 const $=id=>document.getElementById(id),frame=$('cropFrame');let importing=false;
 function show(screen){const crop=screen==='crop';frame.hidden=!crop;$('selectionScreen').hidden=crop;for(const id of ['cropTab','selectionTab'])$(id).setAttribute('aria-selected',String(id===(crop?'cropTab':'selectionTab')));if(!crop)api.redraw();window.dispatchEvent(new Event('resize'));}
 $('cropTab').onclick=()=>show('crop');$('selectionTab').onclick=()=>show('selection');
 window.addEventListener('workflow-edit',event=>{if(!api.items().some(x=>x.origin==='crop-local'&&x.imageId===event.detail?.imageId))return;show('crop');frame.contentWindow.postMessage({type:'crop-edit-v1',imageId:event.detail.imageId},location.origin);});
 $('loadPending').textContent='切り出し画面へ';$('loadPending').onclick=()=>show('crop');
 const driveExport=initDriveExport(api);
 $('sync').textContent='選抜結果を端末に保存';$('mode').textContent='切り出し → 選抜 → Google Driveに保存';
 $('driveStatus').textContent='◯・△・✕を選び、最後に端末内で確定してください。';
 const completion=document.createElement('dialog');completion.id='selectionComplete';completion.setAttribute('aria-labelledby','completionTitle');const title=document.createElement('h2');title.id='completionTitle';const message=document.createElement('p');message.setAttribute('role','status');const note=document.createElement('p');const back=document.createElement('button');back.textContent='選抜一覧に戻る';back.onclick=()=>completion.close();const next=document.createElement('button');next.textContent='次の元画像を切り出す';next.onclick=()=>{completion.close();show('crop');};const exportButton=document.createElement('button');exportButton.textContent='Google Driveに保存';exportButton.onclick=()=>{completion.close();driveExport.open();};completion.append(title,message,note,exportButton,back,next);document.body.append(completion);
 $('sync').onclick=()=>api.withBusy(async()=>{title.textContent='選抜結果を保存中…';message.textContent='';note.textContent='';next.hidden=true;exportButton.hidden=true;completion.showModal();try{await api.ready;const result=await completeSelection(api);api.redraw();title.textContent=result.empty?'まだ選抜されていません':result.saved?'選抜結果を保存しました':'選抜結果は保存済みです';message.textContent=result.empty?'各画像の◯・△・✕を選んでから、保存ボタンを押してください。':`採用 ◯ ${result.adopted}枚 ／ 保留 △ ${result.held}枚 ／ 不採用 ✕ ${result.rejected}枚`+(result.unrated?`。未選抜は${result.unrated}枚です。`:'。表示中の画像はすべて選抜済みです。');note.textContent=result.empty?'まだ保存する選抜結果がありません。':'選抜結果を端末に保存しました。「Google Driveに保存」で採用PNGと結果をまとめて保存できます。';next.hidden=result.empty;exportButton.hidden=result.empty;$('driveStatus').textContent=result.empty?'未選抜です。◯・△・✕を選んでください。':`保存済み ${result.confirmed}枚（採用${result.adopted}・保留${result.held}・不採用${result.rejected}）`;}catch(e){title.textContent='保存できませんでした';message.textContent=e.message||'保存中にエラーが起きました';note.textContent='保存は完了していません。一覧に戻って、もう一度お試しください。';$('driveStatus').textContent='保存失敗：'+message.textContent;api.redraw();}});
 window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='crop-handoff-v1')return;
  const {requestId,entries}=event.data;if(typeof requestId!=='string')return;
  const reply=data=>frame.contentWindow.postMessage({type:'crop-handoff-result-v1',requestId,...data},location.origin);
  if(importing||api.isBusy()){reply({error:'処理中です。完了後にもう一度押してください。'});return;}
  importing=true;try{await api.ready;const master=await fetch('./crop-v9/master.json').then(r=>{if(!r.ok)throw Error('候補マスター読込失敗');return r.json();});let result;
   await api.withBusy(async()=>{result=await importCrops(entries,{items:api.items,get:api.get,decode:api.decode,write:async(item,blob)=>{await api.put(item.id,blob);api.items().push(item);try{api.save();}catch(e){api.replaceItems(api.items().filter(x=>x!==item));throw e;}}},master,{forSelection:event.data.forSelection===true});if(result.ids.length){api.setView(result.ids,true);api.redraw();}});
   if(!result)throw Error('受け渡しを完了できませんでした');reply(result);if(result.ids.length){show('selection');$('driveStatus').textContent='切り出しから追加 '+result.added+'枚／取込済み '+result.existing+'枚／失敗 '+result.errors.length+'件。「Google Driveに保存」で採用PNGと結果を保存できます。';}
  }catch(e){reply({error:e.message});}finally{importing=false;}
 });
 show('crop');
}
