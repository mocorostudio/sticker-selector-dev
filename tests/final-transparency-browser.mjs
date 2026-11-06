import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {startServer} from './server.mjs';
const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();await page.goto(server.url+'/integration-v1/');
 const result=await page.evaluate(async()=>{
  const {finalizeTransparency}=await import('/integration-v1/final-transparency.mjs');
  const decode=async blob=>{const bm=await createImageBitmap(blob),c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;const g=c.getContext('2d');g.drawImage(bm,0,0);bm.close();return g.getImageData(0,0,c.width,c.height);};
  const checks=[];for(const [w,h] of [[370,320],[240,240],[96,74]]){
   const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='rgba(120,80,40,0.02)';g.fillRect(5,5,w-10,h-10);g.fillStyle='rgba(255,255,255,0.86)';g.fillRect(Math.floor(w/3),Math.floor(h/3),Math.floor(w/3),Math.floor(h/3));
   const source=await new Promise(r=>c.toBlob(r,'image/png')),before=await decode(source),out=await finalizeTransparency(source,decode),after=await decode(out.blob);
   const p=(Math.floor(h/2)*w+Math.floor(w/2))*4;
   checks.push({w:after.width,h:after.height,removed:out.report.removed,weak:after.data.some((v,i)=>i%4===3&&v>0&&v<=8),protected:before.data[p+3]===after.data[p+3],sourceUnchanged:(await decode(source)).data[(6*w+6)*4+3]>0});
  }return checks;
 });for(const r of result){assert.ok(r.removed>0);assert.equal(r.weak,false);assert.equal(r.protected,true);assert.equal(r.sourceUnchanged,true);}console.log('PASS: real PNG final cleanup, sticker/main/tab, source preservation',result);
}finally{await browser?.close();await server.close();}
