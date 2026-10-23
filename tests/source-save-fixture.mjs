import {digest} from '../integration-v1/drive-export.mjs';
export class SourceFixture{
 constructor(){this.files=new Map([['char',{id:'char',name:'Synthetic character',mimeType:'application/vnd.google-apps.folder',parents:['root']}],['history',{id:'history',name:'03_元画像・生成履歴',mimeType:'application/vnd.google-apps.folder',parents:['char']}]]);this.blobs=new Map();this.serial=0;this.posts=0;this.lose=false;this.delayed=false;this.badReadback=false;}
 async fetch(url,options={}){
  const u=new URL(url),method=options.method||'GET',json=(x,status=200)=>Response.json(x,{status});
  if(method==='PATCH'||method==='DELETE')throw Error('destructive request');
  if(u.pathname.endsWith('/about'))return json({user:{permissionId:'account'}});
  if(u.pathname.endsWith('/generateIds'))return json({ids:['new'+ ++this.serial]});
  if(u.pathname.startsWith('/upload/')){
   this.posts++;const bytes=Buffer.from(await options.body.arrayBuffer()),boundary=options.headers['Content-Type'].split('boundary=')[1];
   const parts=bytes.toString('latin1').split('--'+boundary),metadata=JSON.parse(parts[1].split('\r\n\r\n')[1]);
   if(this.files.has(metadata.id))return json({},409);
   const content=parts[2].slice(parts[2].indexOf('\r\n\r\n')+4,-2),blob=new Blob([Buffer.from(content,'latin1')],{type:'image/png'});
   this.files.set(metadata.id,{...metadata,size:String(blob.size),sha256Checksum:await digest(blob)});this.blobs.set(metadata.id,blob);
   if(this.lose){this.lose=false;throw Error('lost upload response');}if(this.conflict)return json({},409);return json({id:metadata.id});
  }
  if(u.pathname.endsWith('/files')){
   const q=u.searchParams.get('q'),parent=q.match(/'([-\w]+)' in parents/)?.[1],name=q.match(/name = '([^']+)'/)?.[1];
   return json({files:[...this.files.values()].filter(f=>!f.trashed&&f.parents?.includes(parent)&&(!name||f.name===name)&&!(this.delayed&&f.id.startsWith('new')))});
  }
  const id=u.pathname.split('/').pop(),file=this.files.get(id);if(!file)return json({},404);
  if(u.searchParams.get('alt')==='media')return new Response(this.blobs.get(id));
  return json(this.badReadback&&id.startsWith('new')?{...file,size:'1'}:file);
 }
}
