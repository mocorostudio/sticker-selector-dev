// Generic tag editor helper. No private product data or credentials.
export function launchBulkTags(){
const d=document,S=location.pathname+location.search,K='rui-bulk-tags-v1:'+S;
if(location.origin!=='https://creator.line.me')return alert('LINEのタグ編集画面で使ってください');
if(d.getElementById('rui-bulk'))return;
const b=d.createElement('section');b.id='rui-bulk';b.style.cssText='position:fixed;inset:4%;z-index:2147483647;background:white;color:#222;padding:16px;border:2px solid teal;overflow:auto;font:16px sans-serif';
b.innerHTML='<h2>タグ一括入力・試験版 v3.1</h2><p>既存タグ保持。未追加は記録。審査送信なし。</p><textarea aria-label="タグ一覧" style="width:95%;height:140px;font-size:16px" placeholder="01,ネコ,ダッシュ"></textarea><p><button data-x="trial">2枚まで試す</button> <button data-x="all" disabled>残りを実行</button> <button data-x="stop" disabled>停止</button></p><pre role="status" style="white-space:pre-wrap"></pre><p><button data-x="catalog">タグ一覧をコピー</button> <button data-x="edit">一覧を入れ替え</button> <button data-x="close">閉じる</button></p>';
d.body.append(b);
const q=x=>b.querySelector(x),T=q('textarea'),O=q('[role=status]'),A=q('[data-x=all]'),P=q('[data-x=trial]'),Z=q('[data-x=stop]'),C=q('[data-x=close]'),L=q('[data-x=catalog]'),E=q('[data-x=edit]');
const msg=x=>O.textContent=x,vis=x=>!!x.getClientRects().length,un=x=>[...new Set(x)],eq=(a,c)=>a.length===c.length&&a.every(x=>c.includes(x));
let busy=false,stop=false,job=null;
const check=()=>{if(stop)throw Error('停止しました。途中の追加は保存された可能性があります');if(S!==location.pathname+location.search)throw Error('URLが変わったため停止');};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function read(){
check();const ns=[...d.querySelectorAll('button.btn-dropdown .btn-dropdown-text')].filter(vis);
if(ns.length!==1||!/^\d{1,2}$/.test(ns[0].textContent.trim()))throw Error('画像番号が不明');
const n=Number(ns[0].textContent.trim()),m=new Map();
for(const l of [...d.querySelectorAll('label.cm-product-image-tag')].filter(vis)){
const c=l.querySelector('input[type=checkbox]'),t=l.querySelector('span.cm-product-image-tag-name-text[data-test=tag-name]')?.textContent.trim();
if(!c||!t)throw Error('タグ一覧が未対応');const p=m.get(t);if(p&&p.c.checked!==c.checked)throw Error('同名タグの状態が不一致：'+t);if(!p||p.c.disabled&&!c.disabled)m.set(t,{l,c,t});
}if(!m.size)throw Error('タグ一覧がありません');return {n,m,t:[...m.values()].filter(x=>x.c.checked).map(x=>x.t)};
}
function button(dir){const xs=[...d.querySelectorAll(dir>0?'button.btn-next-image':'button.btn-previous-image')].filter(vis);if(xs.length!==1||xs[0].disabled)throw Error('画像移動ボタンが使えません');return xs[0];}
async function settle(n){let old='',count=0;for(let i=0;i<32;i++){check();let s;try{s=read()}catch(e){if(!['タグ一覧がありません','画像番号が不明','タグ一覧が未対応'].includes(e.message))throw e;old='';count=0;await wait(250);continue;}const key=JSON.stringify([s.n,s.t,[...s.m.keys()]]);if(s.n===n&&key===old)count++;else count=0;if(count>=3)return s;old=key;await wait(250);}throw Error('画像の表示が安定しません');}
async function move(n){for(let i=0;i<40;i++){check();const a=read().n;if(a===n)return settle(n);const dir=n>a?1:-1;button(dir).click();await wait(1000);await settle(a+dir);}throw Error('画像移動が完了しません');}
function parse(){const rows=T.value.trim().split(/\r?\n/).map(x=>x.split(',').map(t=>t.trim()));if(!T.value.trim()||rows.length>40)throw Error('1〜40行を入力してください');const seen=new Set();return rows.map(p=>{const n=Number(p[0]),tags=p.slice(1);if(!/^\d{1,2}$/.test(p[0])||n<1||n>40||seen.has(n)||!tags.length||tags.some(x=>!x)||un(tags).length!==tags.length||tags.length>9)throw Error('番号・重複・タグ数・形式を確認してください');seen.add(n);return {n,tags};});}
const save=()=>sessionStorage.setItem(K,JSON.stringify(job));
function report(extra=''){const a=job?.omitted||[];msg((job?'確認済み '+job.done.length+'/'+job.rows.length+'枚／未追加 '+a.length+'タグ\n':'')+extra+(a.length?'\n未追加一覧：\n'+a.map(x=>x.n+'番 '+x.tag+'（'+x.reason+'）').join('\n'):''));}
async function verify(row){
await move(row.n);let s=read();const expected=[...s.t];job.omitted??=[];
for(const tag of row.tags){let reason='';if(!s.m.has(tag))reason='画面にない';else if(!expected.includes(tag)){if(expected.length>=9)reason='9個上限';else expected.push(tag);}if(reason&&!job.omitted.some(x=>x.n===row.n&&x.tag===tag))job.omitted.push({n:row.n,tag,reason});}
if(job.pending){if(job.pending.n!==row.n)throw Error('前回の確認待ち画像と違います');if(!eq(s.t,job.pending.expected))throw Error('前回と不一致。再追加せず停止');}
else {job.pending={n:row.n,expected,before:s.t};save();for(const tag of expected){check();s=read();if(s.n!==row.n||!s.t.every(t=>expected.includes(t))||!job.pending.before.every(t=>s.t.includes(t)))throw Error('タグが途中で変わりました');const e=s.m.get(tag);if(!e.c.checked){if(e.c.disabled)throw Error('選択できないタグ：'+tag);e.l.click();await wait(500);if(!read().t.includes(tag))throw Error('タグ追加を確認できません');}}}
const expectedTags=job.pending.expected;await settle(row.n);let away;
const next=[...d.querySelectorAll('button.btn-next-image')].filter(vis);if(next.length===1&&!next[0].disabled)away=row.n+1;else away=row.n-1;
await move(away);await move(row.n);s=read();if(!eq(s.t,expectedTags))throw Error(row.n+'番の再表示後のタグが不一致。自動再追加しません');
job.done=un([...job.done,row.n]);job.pending=null;save();
}
async function run(all){if(busy)return;busy=true;stop=false;T.disabled=P.disabled=A.disabled=C.disabled=L.disabled=E.disabled=true;Z.disabled=false;
try{const rows=parse();if(!job){job={scope:S,rows,done:[],pending:null,omitted:[]};save();}if(JSON.stringify(rows)!==JSON.stringify(job.rows)||job.scope!==S)throw Error('確認済みの一覧・対象と違います');if(all&&job.done.length<Math.min(2,rows.length))throw Error('まず2枚までの試験が必要です');
const todo=rows.filter(r=>!job.done.includes(r.n)),items=job.pending?todo.filter(r=>r.n===job.pending.n):all?todo:todo.slice(0,Math.max(0,2-job.done.length));
for(const row of items){report(row.n+'番を処理中');await verify(row);report(row.n+'番の追加と再表示後の一致を確認');}
report(job.done.length===rows.length?'処理終了。未追加は下記。審査送信なし。':'試験確認済み。続行は「残りを実行」。');
}catch(e){report(e.message+'\n停止。進捗は保持しています。');}finally{busy=false;P.disabled=C.disabled=L.disabled=E.disabled=false;T.disabled=!!job;Z.disabled=true;A.disabled=!job||!!job.pending||job.done.length<Math.min(2,job.rows.length)||job.done.length===job.rows.length;}}
L.onclick=async()=>{try{const s=read(),text=JSON.stringify({type:job?.pending?'LINE-tag-diagnostic-v1':'LINE-tag-catalog-v1',image:s.n,available:job?.pending?undefined:[...s.m.keys()],selected:s.t,pending:job?.pending,confirmed:job?.done});let x=b.querySelector('[data-catalog]');if(!x){x=d.createElement('textarea');x.setAttribute('data-catalog','');x.readOnly=true;x.style.cssText='width:95%;height:100px';b.append(x);}x.value=text;try{await navigator.clipboard.writeText(text);report('コピー済み。このチャットへ貼り付けてください。');}catch{report('下の欄を全選択してコピー→チャットへ貼り付けてください。');}x.focus();x.select();}catch(e){report(e.message+'。読込後に取得してください。');}};
E.onclick=()=>{if(busy)return;try{if(job){sessionStorage.setItem(K+':history:'+Date.now(),JSON.stringify(job));sessionStorage.removeItem(K);}job=null;T.disabled=false;P.disabled=false;A.disabled=true;report('旧記録を保管。新一覧を貼り付けてください。');}catch(e){report('記録を保管できないため一覧は変えていません。');}};
P.onclick=()=>run(false);A.onclick=()=>run(true);Z.onclick=()=>{stop=true;};C.onclick=()=>b.remove();
try{const raw=sessionStorage.getItem(K);if(raw){job=JSON.parse(raw);if(job.scope!==S)throw Error('別画面の記録です。元の画面で再開してください');T.value=job.rows.map(r=>[String(r.n).padStart(2,'0'),...r.tags].join(',')).join('\n');T.disabled=true;A.disabled=!!job.pending||job.done.length<Math.min(2,job.rows.length)||job.done.length===job.rows.length;report('一覧と進捗を復元しました。');}else report('現在画像 '+read().n+'。タグ一覧を貼り付けてください。');}catch(e){P.disabled=true;A.disabled=true;msg(e.message);}
}



