import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {MemoryDrive,png} from './mock-drive.mjs';
export async function startServer(){
 let drive=new MemoryDrive();
 const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');let body='';for await(const chunk of req)body+=chunk;const data=body?JSON.parse(body):null;
 if(url.pathname.startsWith('/__mock_drive/')){
  const p=url.pathname.slice('/__mock_drive/'.length).split('/').map(decodeURIComponent);let result;
  if(p[0]==='records')result=p[1]?await drive.save(p[1],data):await drive.list();
  else if(p[0]==='files')result=req.method==='PATCH'?await drive.move(p[1],data.from,data.to):await drive.metadata(p[1]);
  else if(p[0]==='events')result=req.method==='POST'?await drive.begin(data):req.method==='PATCH'?await drive.complete(p[1]):await drive.event(p[1]);
  else if(p[0]==='images'){res.setHeader('Content-Type','image/png');res.end(png);return}
  else throw Error('unknown mock endpoint');
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
 }
 const file=path.resolve('.','.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(process.cwd()+path.sep))throw Error('forbidden');
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(bytes);
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}))}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:'http://127.0.0.1:'+server.address().port,server,get drive(){return drive},reset(){drive=new MemoryDrive()}};
}
if(process.argv[1]?.endsWith('/server.mjs')){const s=await startServer();console.log('Mock preview: '+s.url+'/?mock=1')}
