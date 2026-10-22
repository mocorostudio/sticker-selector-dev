// A top-layer progress screen works above both the main app and nested save dialogs.
// No completion claims: callers must hide it in finally and show their actual result.
export function createBusyScreen({document:doc=globalThis.document,watch}={}){
 const style=doc.createElement('style');style.textContent=`
 .processing-screen{width:min(90vw,440px);max-height:85dvh;overflow:auto;border:0;border-radius:20px;padding:30px 24px;text-align:center;color:#18302c;background:#fff;box-shadow:0 12px 60px #0005}
 .processing-screen::backdrop{background:#10251fba}.processing-screen h2{margin:16px 0;font-size:25px}.processing-screen p{line-height:1.7;overflow-wrap:anywhere}.processing-screen progress{display:block;width:100%;height:16px;margin:18px 0;accent-color:#225b42}
 .processing-spinner{display:inline-block;width:44px;height:44px;border:5px solid #dcebe4;border-top-color:#225b42;border-radius:50%;animation:processing-spin 1s linear infinite}
 @keyframes processing-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.processing-spinner{animation:none}}
 `;doc.head.append(style);
 const screen=doc.createElement('dialog');screen.className='processing-screen';screen.setAttribute('aria-label','処理中');
 const spinner=doc.createElement('span');spinner.className='processing-spinner';spinner.setAttribute('aria-hidden','true');
 const heading=doc.createElement('h2');heading.textContent='処理中です';
 const detail=doc.createElement('p');detail.setAttribute('role','status');detail.setAttribute('aria-live','polite');
 const bar=doc.createElement('progress');bar.setAttribute('aria-label','処理の進み具合');
 const counter=doc.createElement('p');const note=doc.createElement('p');note.textContent='完了するまで、この画面を開いたままお待ちください。';
 screen.append(spinner,heading,detail,bar,counter,note);doc.body.append(screen);
 screen.addEventListener('cancel',e=>e.preventDefault());
 function update(message){detail.textContent=message||'処理を準備しています…';}
 if(watch)new MutationObserver(()=>{if(screen.open)update(watch.textContent);}).observe(watch,{childList:true,subtree:true,characterData:true});
 return {show(message){bar.removeAttribute('value');counter.textContent='';update(message);if(!screen.open)screen.showModal();},update,
 progress(done,total){if(!Number.isFinite(total)||total<=0){bar.removeAttribute('value');counter.textContent='';return;}bar.max=total;bar.value=Math.max(0,Math.min(total,done));counter.textContent=done+' ／ '+total+'件';},
 hide(){if(screen.open)screen.close();}};
}
