import test from 'node:test';
import assert from 'node:assert/strict';
import {googleTestAuth} from '../integration-v1/google-auth.mjs';
test('Google popup starts inside click; failure and retry retain specific errors',async()=>{
 const original=globalThis.google;let inClick=false,opened=0,settings;
 globalThis.google={accounts:{oauth2:{initTokenClient:o=>{settings=o;return {requestAccessToken:()=>{assert.equal(inClick,true);opened++;}}}}}};
 try{
  const auth=googleTestAuth();await auth.ready;
  inClick=true;const first=auth.getToken();inClick=false;assert.equal(opened,1);assert.equal(auth.getToken(),first);
  settings.callback({access_token:'synthetic',scope:settings.scope,expires_in:3600});assert.equal(await first,'synthetic');
  for(const [type,message] of [['popup_failed_to_open',/ブロック/],['popup_closed',/閉じられ/],['unknown',/unknown/]]){
   auth.disconnect();inClick=true;const failed=auth.getToken();inClick=false;settings.error_callback({type});await assert.rejects(failed,message);
  }
  inClick=true;const retry=auth.getToken();inClick=false;settings.callback({access_token:'retry',scope:settings.scope});assert.equal(await retry,'retry');
  auth.disconnect();inClick=true;const denied=auth.getToken();inClick=false;settings.callback({access_token:'denied',scope:'other'});await assert.rejects(denied,/権限/);
 }finally{globalThis.google=original;}
});
