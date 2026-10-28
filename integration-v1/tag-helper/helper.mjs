// Original implementation. Selectors are provisional until checked on LINE.
export function launchTagHelper() {
  const d=document, key='rui-line-tag-trial-v1';
  if(location.origin!=='https://creator.line.me')return alert('LINE Creators Marketのタグ編集画面で使ってください。');
  if(d.getElementById('rui-tags'))return;
  const box=d.createElement('section');box.id='rui-tags';
  box.style.cssText='position:fixed;inset:5% 4% auto;z-index:2147483647;background:white;color:#222;padding:18px;border:2px solid #247a64;border-radius:12px;max-height:80vh;overflow:auto;font:16px sans-serif;box-shadow:0 3px 30px #777';
  box.innerHTML='<h2 style="font-size:19px">タグ入力・1枚試験版 v2</h2><p>LINE実画面は未検証。既存タグを残して追加します。</p><p>形式：01,ありがとう,ネコ（1行だけ）</p><textarea aria-label="追加するタグ" style="width:100%;height:85px;font-size:16px"></textarea><p><button data-rui="check">内容を確認</button> <button data-rui="apply" disabled>この1枚を追加して保存</button></p><pre style="white-space:pre-wrap" role="status"></pre><p>保存後、LINEの確認が出たら内容を見てOK。画面を再読み込みし、もう一度このツールを開くと照合します。審査送信は行いません。</p><button data-rui="close">閉じる</button>';
  d.body.append(box);
  const out=box.querySelector('[role="status"]'), input=box.querySelector('textarea'), apply=box.querySelector('[data-rui="apply"]');
  const say=s=>out.textContent=s;
  const visible=e=>!!e.getClientRects().length;
  const unique=xs=>[...new Set(xs)];
  const same=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
  const read=()=>{
    const ns=[...d.querySelectorAll('button.btn-dropdown .btn-dropdown-text')].filter(visible);
    if(ns.length!==1||!/^\d{1,2}$/.test(ns[0].textContent.trim()))throw Error('画像番号が特定できません。タグ編集画面で開いてください。');
    const entries=[...d.querySelectorAll('label.cm-product-image-tag')].filter(visible).map(label=>({label,cb:label.querySelector('input[type="checkbox"]'),name:label.querySelector('span.cm-product-image-tag-name-text[data-test="tag-name"]')?.textContent.trim()}));
    if(!entries.length||entries.some(x=>!x.cb||!x.name))throw Error('タグ一覧が未対応です。診断：候補'+entries.length+'／チェック欄なし'+entries.filter(x=>!x.cb).length+'／名称なし'+entries.filter(x=>!x.name).length+'。保存操作はしていません。');
    const groups=new Map();
    for(const e of entries){const prior=groups.get(e.name);if(prior&&prior.cb.checked!==e.cb.checked)throw Error('同名タグの選択状態が不一致です。保存せず停止：'+e.name);if(!prior||prior.cb.disabled&&!e.cb.disabled)groups.set(e.name,e);}
    entries.splice(0,entries.length,...groups.values());
    return {number:Number(ns[0].textContent.trim()),entries,selected:entries.filter(x=>x.cb.checked).map(x=>x.name)};
  };
  const saveButton=()=>{
    const xs=unique([...d.querySelectorAll('button[data-test="save-btn"],button[data-test="apply-btn"],.cm-save-btn button')]).filter(visible).filter(e=>!box.contains(e));
    if(xs.length!==1||!['保存','Save'].includes(xs[0].textContent.trim())||xs[0].disabled)throw Error('有効なタグ保存ボタンを一意に確認できません。何も保存していません。');
    return xs[0];
  };
  const parse=()=>{
    const raw=input.value.trim();
    if(!raw||raw.includes('\n'))throw Error('試験版は1行だけ入力してください。');
    const parts=raw.split(',').map(s=>s.trim());
    if(!/^\d{1,2}$/.test(parts[0])||Number(parts[0])<1||Number(parts[0])>40||parts.length<2||parts.slice(1).some(s=>!s))throw Error('形式は「01,タグ1,タグ2」です。');
    const tags=parts.slice(1);if(unique(tags).length!==tags.length)throw Error('入力タグが重複しています。');
    const state=read();if(state.number!==Number(parts[0]))throw Error('画像番号が違います。移動や入力はしていません。');
    if(tags.some(t=>!state.entries.some(e=>e.name===t)))throw Error('この画面に存在しないタグがあります。');
    const expected=unique([...state.selected,...tags]);if(expected.length>9)throw Error('既存タグと合わせて9個を超えます。既存タグは削除しません。');
    return {state,expected,add:expected.filter(t=>!state.selected.includes(t))};
  };
  let plan=null;
  input.oninput=()=>{plan=null;apply.disabled=true;};
  box.querySelector('[data-rui="close"]').onclick=()=>box.remove();
  box.querySelector('[data-rui="check"]').onclick=()=>{try{
    if(sessionStorage.getItem(key))throw Error('前回の保存確認が残っています。再読み込み後にこのツールを開いてください。');
    plan=parse();apply.disabled=!plan.add.length;
    say('画像 '+plan.state.number+'\n既存：'+plan.state.selected.join('、')+'\n追加：'+plan.add.join('、')+(plan.add.length?'\n内容と画像を確認して追加ボタンを押してください。':'\n追加は不要です。保存はしません。'));
  }catch(e){plan=null;apply.disabled=true;say(e.message);}};
  apply.onclick=async()=>{apply.disabled=true;input.disabled=true;try{
    const now=parse();if(!plan||!same(now.state.selected,plan.state.selected)||!same(now.expected,plan.expected))throw Error('確認後にタグが変わりました。内容を確認し直してください。');
    const pending={path:location.pathname+location.search,number:now.state.number,expected:now.expected,before:now.state.selected,load:performance.timeOrigin,stage:'prepared'};
    sessionStorage.setItem(key,JSON.stringify(pending));
    for(const tag of now.add){
      const s=read();if(s.number!==pending.number||!s.selected.every(t=>pending.expected.includes(t))||!pending.before.every(t=>s.selected.includes(t)))throw Error('操作途中に画面が変わりました。停止します。');
      const item=s.entries.find(x=>x.name===tag);if(item.cb.disabled)throw Error('タグが選択できません。保存せず停止します。');
      if(!item.cb.checked)item.label.click();
      await new Promise(r=>setTimeout(r,100));
      if(!read().selected.includes(tag))throw Error('タグの選択を確認できません。保存せず停止します。');
    }
    if(!same(read().selected,pending.expected))throw Error('選択結果が一致しません。保存せず停止します。');
    const save=saveButton();pending.stage='save-clicked';sessionStorage.setItem(key,JSON.stringify(pending));save.click();
    say('保存ボタンを押しました。保存成功は未確認です。LINEの確認を終え、再読み込みしてからこのツールを開いてください。');
  }catch(e){say(e.message+'\n変更が途中で残っている可能性があります。自動再試行はしません。');}finally{input.disabled=false;plan=null;}};
  try{
    const raw=sessionStorage.getItem(key);
    if(raw){const p=JSON.parse(raw),s=read();
      if(p.path!==location.pathname+location.search||p.number!==s.number)throw Error('前回と違う画像画面です。元の画像へ戻って確認してください。');
      if(p.load===performance.timeOrigin)throw Error('保存確認待ちです。LINEの確認後に画面を再読み込みしてください。');
      if(p.stage!=='save-clicked'||!same(s.selected,p.expected))throw Error('保存後のタグが一致しません。保存成功とは扱いません。自動再試行はしません。');
      sessionStorage.removeItem(key);say('再読み込み後の一致を確認しました。画像 '+s.number+'：'+s.selected.join('、')+'\nこの1枚のタグ保持を確認。審査送信はしていません。');
    }else{const s=read();say('画像 '+s.number+'／既存 '+s.selected.length+'個。追加するタグを1行で貼り付けてください。');}
  }catch(e){say(e.message);}
}

