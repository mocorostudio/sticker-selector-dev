import {initInspection} from './inspection-ui.mjs?v=20261026-autoqa1';
import {initSubmission} from './submission-ui.mjs?v=20261027-handoff1';
import {importCrops} from './crop-handoff.mjs?v=20261023-merge1';
import {completeSelection} from './selection-completion.mjs?v=20261023-merge1';
import {initDriveExport} from './drive-export-ui.mjs?v=20261027-sourceproof1';
import {initDrivePending} from './drive-pending-ui.mjs?v=20261030-master1';
export function initWorkflow(api){
 initInspection(api);
 const $=id=>document.getElementById(id),frame=$('cropFrame'),submission=initSubmission(api);let importing=false;
 const guide=document.createElement('aside');guide.id='workflowNextGuide';guide.setAttribute('role','status');guide.style.cssText='margin:8px 12px;padding:9px 12px;border:1px solid #b7c9bc;border-radius:10px;background:#f4f8f4;color:#19422e;font-size:14px;line-height:1.5';
 const guideText=document.createElement('span'),guideAction=document.createElement('button');guideAction.style.cssText='margin-left:10px;min-height:40px;border:2px solid #175e40;border-radius:8px;background:#fff;color:#175e40;font-weight:bold';guide.append(guideText,guideAction);document.querySelector('.workflow-tabs').after(guide);
 function nextGuide(screen){
  if(screen==='crop'){guideText.textContent='次：切り出した画像を技術検品へ。';guideAction.textContent='選抜・検品へ';guideAction.onclick=()=>show('selection');}
  else if(screen==='selection'){const images=api.visible().filter(x=>x.origin==='crop-local');const pending=images.filter(x=>x.inspectionAudit?.decision!=='pass'||x.inspectionAudit?.imageId!==x.imageId).length;guideText.textContent=pending?'次：技術検品（未合格・未確認 '+pending+'枚）。選抜より先に確認します。':'次：選抜結果を保存して申請用40枚を確定。';guideAction.textContent=pending?'技術検品を開く':'申請用へ';guideAction.onclick=()=>pending?$('inspectImages')?.click():show('submission');}
  else{guideText.textContent='次：40枚確定後は並べ替え・メイン／タブ確認・新しい申請用ZIP保存。';guideAction.textContent='修正済みZIPを並べ替え';guideAction.onclick=()=>location.assign('reorder-finished.html');}
 }
 function show(screen,{preserve=false}={}){const crop=screen==='crop',selection=screen==='selection';frame.hidden=!crop;$('selectionScreen').hidden=!selection;submission.host.hidden=screen!=='submission';for(const [id,name] of [['cropTab','crop'],['selectionTab','selection'],['submissionTab','submission']])$(id).setAttribute('aria-selected',String(screen===name));if(selection&&!preserve)api.redraw();if(screen==='submission')submission.open();nextGuide(screen);window.dispatchEvent(new Event('resize'));}
 submission.tab.onclick=()=>show('submission');
 $('cropTab').onclick=()=>show('crop');$('selectionTab').onclick=()=>show('selection');
 window.addEventListener('workflow-edit',event=>{if(!api.items().some(x=>x.origin==='crop-local'&&x.imageId===event.detail?.imageId))return;show('crop');frame.contentWindow.postMessage({type:'crop-edit-v1',imageId:event.detail.imageId},location.origin);});
 const pending=initDrivePending(api,{onLoaded:r=>{show('selection',{preserve:true});$('driveStatus').textContent=r.character.name+'：'+r.count+'枚をDriveから読み込みました。'+(r.draft?'仮選抜です。技術検品は未確定で、申請用には進めません。':r.entries.some(e=>e.record.trialSelection)?'試用画像を含みます。申請用の技術合格ではありません。':'検品済みです。')+'◯・△・✕を選んでください。'+(r.skipped?' 検品記録のない画像 '+r.skipped+'枚は読み込んでいません。':'');}});
 $('loadPending').textContent='Driveから全候補を読み込む・再選抜';$('loadPending').onclick=pending.open;
 const driveExport=initDriveExport(api,{onSnapshot:()=>{if(new URLSearchParams(location.search).get('selectionMode')==='trial')show('submission');}});
 $('sync').hidden=true;$('mode').textContent='切り出し → 選抜 → Google Driveに保存';
 $('driveStatus').textContent=new URLSearchParams(location.search).has('character')?'このキャラの画像だけを表示します。画像がなければ「Driveの選抜待ちを読み込む」を押してください。':'◯・△・✕を選び、「Google Driveに保存」を押してください。';
 const completion=document.createElement('dialog');completion.id='selectionComplete';completion.setAttribute('aria-labelledby','completionTitle');const title=document.createElement('h2');title.id='completionTitle';const message=document.createElement('p');message.setAttribute('role','status');const note=document.createElement('p');const back=document.createElement('button');back.textContent='選抜一覧に戻る';back.onclick=()=>completion.close();const next=document.createElement('button');next.textContent='次の元画像を切り出す';next.onclick=()=>{completion.close();show('crop');};const exportButton=document.createElement('button');exportButton.textContent='Google Driveに保存';exportButton.onclick=()=>{completion.close();driveExport.open();};completion.append(title,message,note,exportButton,back,next);document.body.append(completion);
 $('sync').onclick=()=>api.withBusy(async()=>{title.textContent='選抜結果を保存中…';message.textContent='';note.textContent='';next.hidden=true;exportButton.hidden=true;completion.showModal();try{await api.ready;const result=await completeSelection(api);api.redraw();title.textContent=result.empty?'まだ選抜されていません':result.saved?'選抜結果を保存しました':'選抜結果は保存済みです';message.textContent=result.empty?'各画像の◯・△・✕を選んでから、保存ボタンを押してください。':`採用 ◯ ${result.adopted}枚 ／ 保留 △ ${result.held}枚 ／ 不採用 ✕ ${result.rejected}枚`+(result.unrated?`。未選抜は${result.unrated}枚です。`:'。表示中の画像はすべて選抜済みです。');note.textContent=result.empty?'まだ保存する選抜結果がありません。':'選抜結果を端末に保持しました。「Google Driveに保存」で◯・△のPNGと結果を保存できます。技術判定は別に保持します。';next.hidden=result.empty;exportButton.hidden=result.empty;$('driveStatus').textContent=result.empty?'未選抜です。◯・△・✕を選んでください。':`保存済み ${result.confirmed}枚（採用${result.adopted}・保留${result.held}・不採用${result.rejected}）`;}catch(e){title.textContent='保存できませんでした';message.textContent=e.message||'保存中にエラーが起きました';note.textContent='保存は完了していません。一覧に戻って、もう一度お試しください。';$('driveStatus').textContent='保存失敗：'+message.textContent;api.redraw();}});
 window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='crop-handoff-v1')return;
  const {requestId,entries}=event.data;if(typeof requestId!=='string')return;
  const reply=data=>frame.contentWindow.postMessage({type:'crop-handoff-result-v1',requestId,...data},location.origin);
  if(importing||api.isBusy()){reply({error:'処理中です。完了後にもう一度押してください。'});return;}
  importing=true;try{await api.ready;const master=await fetch('./crop-v9/master.json').then(r=>{if(!r.ok)throw Error('候補マスター読込失敗');return r.json();});let result;
   await api.withBusy(async()=>{result=await importCrops(entries,{items:api.items,get:api.get,decode:api.decode,write:async(item,blob)=>{await api.put(item.id,blob);api.items().push(item);try{api.save();}catch(e){api.replaceItems(api.items().filter(x=>x!==item));throw e;}}},master,{forSelection:event.data.forSelection===true});if(result.ids.length){api.setView(result.ids,event.data.append===true);api.redraw();}});
   if(!result)throw Error('受け渡しを完了できませんでした');reply(result);if(result.ids.length){show('selection');$('driveStatus').textContent='切り出しから追加 '+result.added+'枚／取込済み '+result.existing+'枚／失敗 '+result.errors.length+'件。技術検品が未完了の画像は仮選別のみで、採用予定・保留へのPNG保存は停止します。';}
  }catch(e){reply({error:e.message});}finally{importing=false;}
 });
 show(new URLSearchParams(location.search).get('view')==='submission'?'submission':new URLSearchParams(location.search).get('view')==='selection'||new URLSearchParams(location.search).has('character')?'selection':'crop');
}
