// A top-layer progress screen works above both the main app and nested save dialogs.
// No completion claims: callers must hide it in finally and show their actual result.
export function createBusyScreen({document:doc=globalThis.document,watch,nonBlocking=false}={}){
 const style=doc.createElement('style');style.textContent=`
 .processing-screen{width:min(90vw,440px);max-height:85dvh;overflow:auto;border:0;border-radius:20px;padding:30px 24px;text-align:center;color:#18302c;background:#fff;box-shadow:0 12px 60px #0005}
 .processing-screen::backdrop{background:#10251fba}.processing-screen h2{margin:16px 0;font-size:25px}.processing-screen p{line-height:1.7;overflow-wrap:anywhere}.processing-screen progress{display:block;width:100%;height:16px;margin:18px 0;accent-color:#225b42}
 .processing-spinner{display:inline-block;width:44px;height:44px;border:5px solid #dcebe4;border-top-color:#225b42;border-radius:50%;animation:processing-spin 1s linear infinite}
 @keyframes processing-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.processing-spinner{animation:none}}
 .processing-screen.compact{position:fixed;z-index:1000;top:auto;bottom:calc(12px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(90vw,390px);max-height:110px;overflow:hidden;padding:9px 14px;border:1px solid #a9cbb6;border-radius:12px;box-shadow:0 2px 12px #0003;text-align:left;pointer-events:none}.processing-screen.compact .processing-spinner{width:16px;height:16px;border-width:3px;vertical-align:middle;margin-right:6px}.processing-screen.compact h2{display:inline;font-size:13px;margin:0}.processing-screen.compact p{font-size:12px;line-height:1.25;margin:4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.processing-screen.compact progress{height:5px;margin:5px 0}.processing-screen.compact p:last-child{display:none}
 `;doc.head.append(style);
 const screen=doc.createElement('dialog');screen.className='processing-screen'+(nonBlocking?' compact':'');screen.setAttribute('aria-label','処理中');
 const spinner=doc.createElement('span');spinner.className='processing-spinner';spinner.setAttribute('aria-hidden','true');
 const heading=doc.createElement('h2');heading.textContent='処理中です';
 const detail=doc.createElement('p');detail.setAttribute('role','status');detail.setAttribute('aria-live','polite');
 const bar=doc.createElement('progress');bar.setAttribute('aria-label','処理の進み具合');
 const counter=doc.createElement('p');const note=doc.createElement('p');note.textContent='完了するまで、この画面を開いたままお待ちください。';
 screen.append(spinner,heading,detail,bar,counter,note);doc.body.append(screen);
 screen.addEventListener('cancel',e=>e.preventDefault());
 function update(message){detail.textContent=message||'処理を準備しています…';}
 if(watch)new MutationObserver(()=>{if(screen.open)update(watch.textContent);}).observe(watch,{childList:true,subtree:true,characterData:true});
 return {show(message){bar.removeAttribute('value');counter.textContent='';update(message);if(!screen.open)(nonBlocking?screen.show():screen.showModal());},update,
 progress(done,total){if(!Number.isFinite(total)||total<=0){bar.removeAttribute('value');counter.textContent='';return;}bar.max=total;bar.value=Math.max(0,Math.min(total,done));counter.textContent=done+' ／ '+total+'件';},
 hide(){if(screen.open)screen.close();}};
}
