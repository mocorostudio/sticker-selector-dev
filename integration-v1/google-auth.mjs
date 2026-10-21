// Public OAuth client ID is not a client secret. Access tokens stay in closure memory only.
const CLIENT_ID='752498877311-oo7n6mj74h5ano8g8cusltgun01e4uji.apps.googleusercontent.com';
export function googleTestAuth(){
 let token='',expires=0,pending;
 const ready=new Promise((resolve,reject)=>{
  if(globalThis.google?.accounts?.oauth2)return resolve();
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
  const timeout=setTimeout(()=>reject(Error('Google認証の準備がタイムアウトしました。ページを開き直してください。')),15000);
  script.onload=()=>{clearTimeout(timeout);globalThis.google?.accounts?.oauth2?resolve():reject(Error('Google認証を準備できません'))};
  script.onerror=()=>{clearTimeout(timeout);reject(Error('Google認証を読み込めません'))};document.head.append(script);
 });
 ready.catch(()=>{});
 const getToken=()=>{
  if(token&&Date.now()<expires)return Promise.resolve(token);
  if(pending)return pending;
  pending=(async()=>{await ready;return new Promise((resolve,reject)=>{
   let settled=false;const finish=(error,response)=>{if(settled)return;settled=true;clearTimeout(timeout);if(error)return reject(error);token=response.access_token;expires=Date.now()+Math.max(0,Number(response.expires_in||3600)-60)*1000;resolve(token)};
   const timeout=setTimeout(()=>finish(Error('Googleログインが完了していません。Safariの認証画面を確認してください。')),60000);
   google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:'https://www.googleapis.com/auth/drive',include_granted_scopes:false,
    callback:r=>r.access_token?finish(null,r):finish(Error(r.error_description||r.error||'Google認証に失敗しました')),
    error_callback:r=>finish(Error(r.type==='popup_closed'?'Googleログインをキャンセルしました。':'Google認証画面を開けません。Safariで開いてください。'))}).requestAccessToken({prompt:'select_account'});
  })})().finally(()=>{pending=null});return pending;
 };
 return {getToken,ready,disconnect(){token='';expires=0}};
}
