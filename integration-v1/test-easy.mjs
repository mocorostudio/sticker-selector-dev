// Simplified, reversible test controls. No Google Drive writes.
const frame=document.getElementById('cropFrame');
const selection=document.getElementById('selectionScreen');
const advanced=selection?.querySelector('details');
if(advanced){const text=advanced.querySelector('summary');if(text)text.textContent='詳細設定・バックアップ（通常は不要）';}
function simplifyCrop(){
 const doc=frame.contentDocument;if(!doc)return;
 const main=doc.querySelector('main');if(!main)return;
 if(doc.getElementById('easyModeAdded'))return;
 const bar=doc.createElement('section');bar.id='easyModeAdded';bar.style.cssText='background:#e2eee8;padding:12px;border-radius:12px;margin:12px 0;';
 const heading=doc.createElement('strong');heading.textContent='スタンプの切り出し：①画像を選ぶ → ②まとめて切り出す → ③選抜へ送る';
 bar.append(heading);
 main.insertBefore(bar,main.querySelector('#driveOpen'));
 const run=doc.getElementById('run');if(run){run.textContent='② 選んだ画像を9枚ずつ切り出す';run.style.cssText='display:block;width:100%;font-weight:bold;';}
 const details=doc.createElement('details');details.id='advancedCrop';const summary=doc.createElement('summary');summary.textContent='詳細設定・バックアップ（通常は開かなくてOK）';details.append(summary);
 for(const el of ['grid','prefix','erase','backup','restore','manifest','retry','sourceFilter','showHistory','prevPage','nextPage','pauseQueue']) {
   const node=doc.getElementById(el);if(!node)continue;const wrap=node.closest('label')||node;details.append(wrap);
 }
 const queue=main.querySelector('.queue-panel');if(queue)queue.append(details);else main.append(details);
 const grid=doc.getElementById('grid');if(grid)grid.value='3';
 const legend=doc.getElementById('sourceSelection');if(legend)legend.textContent+='　※過去の画像・評価は保持し、今回の切り出し分を選抜へ送ります';
}
frame.addEventListener('load',simplifyCrop);if(frame.contentDocument?.readyState==='complete')simplifyCrop();
