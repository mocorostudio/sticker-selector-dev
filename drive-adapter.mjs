// No production write transport. This build's sync endpoint is strictly same-origin mock.
export class MockDriveAdapter {
 mode='mock';
 async request(path,method='GET',body){
  const response=await fetch('/__mock_drive/'+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('模擬Drive HTTP '+response.status);
  return response.json();
 }
 list(){return this.request('records')}
 metadata(id){return this.request('files/'+encodeURIComponent(id))}
 async image(id){const r=await fetch('/__mock_drive/images/'+encodeURIComponent(id),{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('PNG読込 HTTP '+r.status);return r.blob()}
 event(id){return this.request('events/'+encodeURIComponent(id))}
 begin(event){return this.request('events','POST',event)}
 move(id,from,to){return this.request('files/'+encodeURIComponent(id),'PATCH',{from,to})}
 save(id,patch){return this.request('records/'+encodeURIComponent(id),'PATCH',patch)}
 complete(id){return this.request('events/'+encodeURIComponent(id),'PATCH',{status:'complete'})}
}
