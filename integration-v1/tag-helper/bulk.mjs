// Generic tag editor helper. No private product data or credentials.
export function launchBulkTags(){
const d=document,S=location.pathname+location.search,K='rui-bulk-tags-v1:'+S;
if(location.origin!=='https://creator.line.me')return alert('LINEタグ編集画面用です');
if(d.getElementById('rui-bulk'))return;
const b=d.createElement('section');b.id='rui-bulk';b.style.cssText='position:fixed;inset:4%;z-index:2147483647;background:white;color:#222;padding:16px;border:2px solid teal;overflow:auto;font:16px sans-serif';
b.innerHTML='<h2>タグ一括 v4</h2><textarea aria-label="タグ一覧" style="width:95%;height:120px"></textarea><p><button data-x="trial">2枚まで試す</button> <button data-x="all" disabled>残りを実行</button> <button data-x="stop" disabled>停止</button></p><pre role="status" style="white-space:pre-wrap"></pre><p><button data-x="catalog">タグ一覧をコピー</button> <button data-x="edit">一覧を入れ替え</button> <button data-x="close">閉じる</button></p>';
d.body.append(b);
const q=x=>b.querySelector(x),T=q('textarea'),O=q('[role=status]'),A=q('[data-x=all]'),P=q('[data-x=trial]'),Z=q('[data-x=stop]'),C=q('[data-x=close]'),L=q('[data-x=catalog]'),E=q('[data-x=edit]');
const msg=x=>O.textContent=x,vis=x=>!!x.getClientRects().length,un=x=>[...new Set(x)],eq=(a,c)=>a.length===c.length&&a.every(x=>c.includes(x));
let busy=false,stop=false,job=null;
const check=()=>{if(stop)throw Error('停止。途中分は保存の可能性あり');if(S!==location.pathname+location.search)throw Error('URLが変わったため停止');};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function read(){
check();const ns=[...d.querySelectorAll('button.btn-dropdown .btn-dropdown-text')].filter(vis);
if(ns.length!==1||!/^\d{1,2}$/.test(ns[0].textContent.trim()))throw Error('画像番号が不明');
const n=Number(ns[0].textContent.trim()),m=new Map();
for(const l of [...d.querySelectorAll('label.cm-product-image-tag')].filter(vis)){
const c=l.querySelector('input[type=checkbox]'),t=l.querySelector('span.cm-product-image-tag-name-text[data-test=tag-name]')?.textContent.trim();
if(!c||!t)throw Error('タグ一覧が未対応');const p=m.get(t);if(p&&p.c.checked!==c.checked)throw Error('同名タグ不一致：'+t);if(!p||p.c.disabled&&!c.disabled)m.set(t,{l,c,t});
}if(!m.size)throw Error('タグ一覧がありません');return {n,m,t:[...m.values()].filter(x=>x.c.checked).map(x=>x.t)};
}
function button(dir){const xs=[...d.querySelectorAll(dir>0?'button.btn-next-image':'button.btn-previous-image')].filter(vis);if(xs.length!==1||xs[0].disabled)throw Error('画像移動不可');return xs[0];}
async function settle(n){let old='',count=0;for(let i=0;i<32;i++){check();let s;try{s=read()}catch(e){if(!['タグ一覧がありません','画像番号が不明','タグ一覧が未対応'].includes(e.message))throw e;old='';count=0;await wait(250);continue;}const key=JSON.stringify([s.n,s.t,[...s.m.keys()]]);if(s.n===n&&key===old)count++;else count=0;if(count>=3)return s;old=key;await wait(250);}throw Error('表示待ち時間超過');}
async function move(n){for(let i=0;i<40;i++){check();const a=read().n;if(a===n)return settle(n);const dir=n>a?1:-1;button(dir).click();await wait(1000);await settle(a+dir);}throw Error('画像移動未完了');}
function parse(){const rows=T.value.trim().split(/\r?\n/).map(x=>x.split(',').map(t=>t.trim()));if(!T.value.trim()||rows.length>40)throw Error('入力は1〜40行');const seen=new Set();return rows.map(p=>{const n=Number(p[0]),tags=p.slice(1);if(!/^\d{1,2}$/.test(p[0])||n<1||n>40||seen.has(n)||!tags.length||tags.some(x=>!x)||un(tags).length!==tags.length||tags.length>9)throw Error('番号・重複・個数・形式エラー');seen.add(n);return {n,tags};});}
const save=()=>sessionStorage.setItem(K,JSON.stringify(job));
function report(extra=''){const a=job?.omitted||[];msg((job?'確認済み '+job.done.length+'/'+job.rows.length+'枚／未追加 '+a.length+'タグ\n':'')+extra+(a.length?'\n未追加一覧：\n'+a.map(x=>x.n+'番 '+x.tag+'（'+x.reason+'）').join('\n'):''));}
async function select(e){
let active=0,seen=0,last=performance.now(),bad=false;const codes=[],F=window.fetch;
const begin=()=>{active++;seen++;},end=s=>{active--;last=performance.now();codes.push(s);if(s<200||s>=300)bad=true;};
function f(...a){begin();let p;try{p=F.apply(this,a);}catch(e){end(0);throw e;}p.then(r=>end(r.status),()=>end(0));return p;}

try{window.fetch=f;e.l.click();for(let i=0;i<60;i++){await wait(250);check();if(bad)throw Error('保存通信失敗：'+codes.join(','));if(seen&&!active&&performance.now()-last>=750)return{seen,codes};}throw Error('保存通信未確認');}
finally{if(window.fetch===f)window.fetch=F;}
}
async function verify(row,repair){
await move(row.n);let s=read();const expected=[...s.t];job.omitted??=[];
for(const tag of row.tags){let reason='';if(!s.m.has(tag))reason='画面にない';else if(!expected.includes(tag)){if(expected.length>=9)reason='9個上限';else expected.push(tag);}if(reason&&!job.omitted.some(x=>x.n===row.n&&x.tag===tag))job.omitted.push({n:row.n,tag,reason});}
if(job.pending){if(job.pending.n!==row.n)throw Error('確認待ち番号違い');if(!eq(s.t,job.pending.expected)){if(!repair||s.t.some(t=>!job.pending.expected.includes(t))||!job.pending.before.every(t=>s.t.includes(t)))throw Error('不足は再開ボタンで確認');sessionStorage.setItem(K+':history:'+Date.now(),JSON.stringify(job));job.pending.before=s.t;job.pending.recovery=(job.pending.recovery||0)+1;save();}}
else {job.pending={n:row.n,expected,before:s.t};save();}
for(const tag of job.pending.expected){check();s=read();if(s.n!==row.n||!s.t.every(t=>job.pending.expected.includes(t))||!job.pending.before.every(t=>s.t.includes(t)))throw Error('タグ変更検知');const e=s.m.get(tag);if(!e.c.checked){if(e.c.disabled)throw Error('選択できないタグ：'+tag);const ack=await select(e);job.pending.lastWrite={tag,...ack};save();if(!read().t.includes(tag))throw Error('タグ追加未確認');}}
const expectedTags=job.pending.expected;await settle(row.n);let away;
const next=[...d.querySelectorAll('button.btn-next-image')].filter(vis);if(next.length===1&&!next[0].disabled)away=row.n+1;else away=row.n-1;
await move(away);await move(row.n);s=read();if(!eq(s.t,expectedTags))throw Error(row.n+'番の再表示が不一致。再追加なし');
job.done=un([...job.done,row.n]);job.pending=null;save();
}
async function run(all,repair=false){if(busy)return;busy=true;stop=false;T.disabled=P.disabled=A.disabled=C.disabled=L.disabled=E.disabled=true;Z.disabled=false;
try{const rows=parse();if(!job){job={scope:S,rows,done:[],pending:null,omitted:[]};save();}if(JSON.stringify(rows)!==JSON.stringify(job.rows)||job.scope!==S)throw Error('一覧・対象違い');if(all&&job.done.length<Math.min(2,rows.length))throw Error('先に2枚の試験が必要です');
const todo=rows.filter(r=>!job.done.includes(r.n)),items=job.pending?todo.filter(r=>r.n===job.pending.n):all?todo:todo.slice(0,Math.max(0,2-job.done.length));
for(const row of items){report(row.n+'番を処理中');await verify(row,repair);report(row.n+'番の再表示一致を確認');}
report(job.done.length===rows.length?'終了。未追加は下記。':'試験済み。「残りを実行」で続行。');
}catch(e){report(e.message+'\n停止。進捗保持。');}finally{busy=false;P.disabled=C.disabled=L.disabled=E.disabled=false;P.textContent=job?.pending?'不足だけ再開':'2枚まで試す';T.disabled=!!job;Z.disabled=true;A.disabled=!job||!!job.pending||job.done.length<Math.min(2,job.rows.length)||job.done.length===job.rows.length;}}
L.onclick=async()=>{try{const s=read(),text=JSON.stringify({type:job?.pending?'LINE-tag-diagnostic-v1':'LINE-tag-catalog-v1',image:s.n,available:job?.pending?undefined:[...s.m.keys()],selected:s.t,pending:job?.pending,confirmed:job?.done});try{await navigator.clipboard.writeText(text);report('コピー済み。チャットへ貼付。');}catch{prompt('コピーしてチャットへ',text);}}catch(e){report(e.message);}};
E.onclick=()=>{if(busy)return;try{if(job){sessionStorage.setItem(K+':history:'+Date.now(),JSON.stringify(job));sessionStorage.removeItem(K);}job=null;T.disabled=false;P.disabled=false;A.disabled=true;report('旧記録保管。新一覧を貼付。');}catch(e){report('記録保管失敗。一覧変更なし。');}};
P.onclick=()=>run(false,!!job?.pending);A.onclick=()=>run(true);Z.onclick=()=>{stop=true;};C.onclick=()=>b.remove();
try{const raw=sessionStorage.getItem(K);if(raw){job=JSON.parse(raw);if(job.scope!==S)throw Error('別画面の記録です');T.value=job.rows.map(r=>[String(r.n).padStart(2,'0'),...r.tags].join(',')).join('\n');T.disabled=true;A.disabled=!!job.pending||job.done.length<Math.min(2,job.rows.length)||job.done.length===job.rows.length;report('一覧・進捗を復元。');}else report('現在画像 '+read().n+'。一覧を貼付。');}catch(e){P.disabled=true;A.disabled=true;msg(e.message);}if(job?.pending)P.textContent='不足だけ再開';
}



