// Generic tag editor helper. No private product data or credentials.
export function launchBulkTags(){
const d=document,S=location.pathname+location.search,K='rui-bulk-tags-v1:'+S;
if(location.origin!=='https://creator.line.me')return alert('LINEのタグ編集画面で使ってください');
if(d.getElementById('rui-bulk'))return;
const b=d.createElement('section');b.id='rui-bulk';b.style.cssText='position:fixed;inset:4%;z-index:2147483647;background:white;color:#222;padding:16px;border:2px solid teal;overflow:auto;font:16px sans-serif';
b.innerHTML='<h2>タグ一括入力・試験版</h2><p>既存タグを残します。まず2枚で移動と再表示を検証。審査送信は行いません。</p><textarea aria-label="タグ一覧" style="width:95%;height:140px;font-size:16px" placeholder="01,ネコ,ダッシュ"></textarea><p><button data-x="trial">2枚まで試す</button> <button data-x="all" disabled>残りを実行</button> <button data-x="stop" disabled>停止</button></p><pre role="status" style="white-space:pre-wrap"></pre><button data-x="close">閉じる</button>';
d.body.append(b);
const q=x=>b.querySelector(x),T=q('textarea'),O=q('[role=status]'),A=q('[data-x=all]'),P=q('[data-x=trial]'),Z=q('[data-x=stop]'),C=q('[data-x=close]');
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
async function settle(n){let old='',count=0;for(let i=0;i<32;i++){check();const s=read(),key=JSON.stringify([s.n,s.t,[...s.m.keys()]]);if(s.n===n&&key===old)count++;else count=0;if(count>=3)return s;old=key;await wait(250);}throw Error('画像の表示が安定しません');}
async function move(n){for(let i=0;i<40;i++){check();const a=read().n;if(a===n)return settle(n);const dir=n>a?1:-1;button(dir).click();await wait(1000);await settle(a+dir);}throw Error('画像移動が完了しません');}
function parse(){const rows=T.value.trim().split(/\r?\n/).map(x=>x.split(',').map(t=>t.trim()));if(!T.value.trim()||rows.length>40)throw Error('1〜40行を入力してください');const seen=new Set();return rows.map(p=>{const n=Number(p[0]),tags=p.slice(1);if(!/^\d{1,2}$/.test(p[0])||n<1||n>40||seen.has(n)||!tags.length||tags.some(x=>!x)||un(tags).length!==tags.length||tags.length>9)throw Error('番号・重複・タグ数・形式を確認してください');seen.add(n);return {n,tags};});}
const save=()=>sessionStorage.setItem(K,JSON.stringify(job));
function report(extra=''){msg((job?'確認済み '+job.done.length+'/'+job.rows.length+'枚\n':'')+extra);}
async function verify(row){
await move(row.n);let s=read();if(row.tags.some(t=>!s.m.has(t)))throw Error(row.n+'番に存在しないタグがあります');
const expected=un([...s.t,...row.tags]);if(expected.length>9)throw Error(row.n+'番が既存タグと合わせて9個を超えます');
if(job.pending){if(job.pending.n!==row.n)throw Error('前回の確認待ち画像と違います');if(!eq(s.t,job.pending.expected))throw Error('前回の追加結果が不一致。自動再追加しません');}
else {job.pending={n:row.n,expected,before:s.t};save();for(const tag of expected){check();s=read();if(s.n!==row.n||!s.t.every(t=>expected.includes(t))||!job.pending.before.every(t=>s.t.includes(t)))throw Error('タグが途中で変わりました');const e=s.m.get(tag);if(!e.c.checked){if(e.c.disabled)throw Error('選択できないタグ：'+tag);e.l.click();await wait(500);if(!read().t.includes(tag))throw Error('タグ追加を確認できません');}}}
const expectedTags=job.pending.expected;await settle(row.n);let away;
const next=[...d.querySelectorAll('button.btn-next-image')].filter(vis);if(next.length===1&&!next[0].disabled)away=row.n+1;else away=row.n-1;
await move(away);await move(row.n);s=read();if(!eq(s.t,expectedTags))throw Error(row.n+'番の再表示後のタグが不一致。自動再追加しません');
job.done=un([...job.done,row.n]);job.pending=null;save();
}
async function run(all){if(busy)return;busy=true;stop=false;T.disabled=P.disabled=A.disabled=C.disabled=true;Z.disabled=false;
try{const rows=parse();if(!job){job={scope:S,rows,done:[],pending:null};save();}if(JSON.stringify(rows)!==JSON.stringify(job.rows)||job.scope!==S)throw Error('確認済みの一覧・対象と違います');if(all&&job.done.length<Math.min(2,rows.length))throw Error('まず2枚までの試験が必要です');
const todo=rows.filter(r=>!job.done.includes(r.n)),items=job.pending?todo.filter(r=>r.n===job.pending.n):all?todo:todo.slice(0,Math.max(0,2-job.done.length));
for(const row of items){report(row.n+'番を処理中');await verify(row);report(row.n+'番の追加と再表示後の一致を確認');}
report(job.done.length===rows.length?'全行の再表示照合が終了。審査送信はしていません。':'試験分を確認。内容を見て「残りを実行」を押してください。');
}catch(e){report(e.message+'\nここで停止。確認済み分と確認待ちを保持しています。');}finally{busy=false;P.disabled=C.disabled=false;T.disabled=!!job;Z.disabled=true;A.disabled=!job||!!job.pending||job.done.length<Math.min(2,job.rows.length)||job.done.length===job.rows.length;}}
P.onclick=()=>run(false);A.onclick=()=>run(true);Z.onclick=()=>{stop=true;};C.onclick=()=>b.remove();
try{const raw=sessionStorage.getItem(K);if(raw){job=JSON.parse(raw);if(job.scope!==S)throw Error('別のタグ画面の確認記録があります。元の画面で再開してください');T.value=job.rows.map(r=>[String(r.n).padStart(2,'0'),...r.tags].join(',')).join('\n');T.disabled=true;A.disabled=!!job.pending||job.done.length<Math.min(2,job.rows.length)||job.done.length===job.rows.length;report('前回の一覧と進捗を復元。確認待ちがあれば、その画像を先に照合します。');}else report('現在画像 '+read().n+'。タグ一覧を貼り付けてください。');}catch(e){P.disabled=true;A.disabled=true;msg(e.message);}
}
