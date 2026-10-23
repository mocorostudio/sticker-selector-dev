// Public OAuth client ID is not a client secret. Access tokens stay in closure memory only.
const CLIENT_ID='752498877311-oo7n6mj74h5ano8g8cusltgun01e4uji.apps.googleusercontent.com';
export function googleTestAuth({readOnly=false,fileOnly=false}={}){
 const scope='https://www.googleapis.com/auth/drive'+(fileOnly?'.file':readOnly?'.readonly':'');
 let token='',expires=0,pending,prepared=false;
 const ready=new Promise((resolve,reject)=>{
  if(globalThis.google?.accounts?.oauth2){prepared=true;return resolve();}
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
  const timeout=setTimeout(()=>reject(Error('Google認証の準備がタイムアウトしました。ページを開き直してください。')),15000);
  script.onload=()=>{clearTimeout(timeout);globalThis.google?.accounts?.oauth2?(prepared=true,resolve()):reject(Error('Google認証を準備できません'))};
  script.onerror=()=>{clearTimeout(timeout);reject(Error('Google認証を読み込めません'))};document.head.append(script);
 });
 ready.catch(()=>{});
 const getToken=()=>{
  if(token&&Date.now()<expires)return Promise.resolve(token);
  if(pending)return pending;
  if(!prepared)return Promise.reject(Error('Google接続を準備中です。接続ボタンが有効になってから押してください。'));
  // Open Google's popup within the button click, before any asynchronous work.
  pending=new Promise((resolve,reject)=>{
   let settled=false;const finish=(error,response)=>{if(settled)return;settled=true;clearTimeout(timeout);if(error)return reject(error);token=response.access_token;expires=Date.now()+Math.max(0,Number(response.expires_in||3600)-60)*1000;resolve(token)};
   const timeout=setTimeout(()=>finish(Error('Googleログインが完了していません。Safariの認証画面を確認してください。')),60000);
   google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope,include_granted_scopes:false,
    callback:r=>r.access_token&&r.scope?.split(' ').includes(scope)?finish(null,r):finish(Error(r.error_description||r.error||(readOnly?'Google認証または読み取り権限の確認に失敗しました':'Google認証または保存権限の確認に失敗しました'))),
    error_callback:r=>finish(Error(r.type==='popup_closed'?'Google認証画面が閉じられ、接続を完了できませんでした。もう一度接続してください。':r.type==='popup_failed_to_open'?'Google認証画面がブロックされました。Safariのこのサイトのポップアップを許可して、もう一度接続してください。':'Googleとの接続を完了できませんでした（'+String(r.type||'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60)+'）。選択結果は端末に残っています。もう一度接続してください。'))}).requestAccessToken({prompt:'select_account'});
  }).finally(()=>{pending=null});return pending;
 };
 return {getToken,ready,disconnect(){token='';expires=0}};
}
