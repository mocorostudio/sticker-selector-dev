import test from 'node:test';
import assert from 'node:assert/strict';
import {isolateComponents} from '../integration-v1/crop-v9/component-crops.mjs';
import {gate,visualChecks} from '../integration-v1/crop-v9/core.mjs';
import {createPendingDrive} from '../integration-v1/drive-pending.mjs';
import {PendingFixture} from './pending-drive-fixture.mjs';

test('whole-component crop preserves overhanging boots and text without neighboring fragments',()=>{
 const width=150,height=150,data=new Uint8ClampedArray(width*height*4);
 function fill(x,y,w,h,a=255){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const k=(j*width+i)*4;data[k]=180;data[k+3]=a;}}
 for(let row=0;row<3;row++)for(let col=0;col<3;col++)fill(col*50+10,row*50+15,24,25);
 // The first boot extends past x=50 but belongs wholly to the first candidate.
 fill(30,30,25,7);fill(41,9,8,4);fill(55,32,5,1,15);
 const before=new Uint8ClampedArray(data),cells=isolateComponents({width,height,data});
 assert.equal(cells.length,9);assert.ok(cells[0].bounds.x1>=55&&cells[0].bounds.x1<=60);
 assert.ok(cells[1].bounds.x0>=55&&cells[1].bounds.x0<=60);assert.deepEqual(data,before);
 assert.ok(cells.every(c=>c.pixels.width>0&&!c.crossing));
});
test('textless approval requires explicit marker, automatic QA and every visual check',()=>{
 const r={candidateId:'D',phrase:'',qa:{automatic:'pass',issues:[]},review:visualChecks.map(()=>true),decision:'pass'};
 assert.equal(gate(r),'review');assert.equal(gate({...r,textless:true}),'pass');
 assert.notEqual(gate({...r,textless:true,review:[] }),'pass');
});
test('inspected reader uses manifest-selected character sheet and verifies textless against live master',async()=>{
 const png=new Uint8Array([137,80,78,71,13,10,26,10,...Array(30).fill(0)]),f=await new PendingFixture().setup(png,1);
 f.rows[1][2]='';f.rows[1][3]='文字なしの踊り';f.manifest.masterSheet='CharacterCandidates';Object.assign(f.manifest.entries[0].record,{phrase:'',textless:true});f.saveManifest();
 const fetchImpl=async(url,o)=>{
  const u=new URL(url);
  if(u.origin==='https://sheets.googleapis.com'&&!u.pathname.includes('/values/'))return Response.json({sheets:[{properties:{title:'CharacterCandidates',gridProperties:{rowCount:100,columnCount:19}}}]});
  return f.fetch(url,o);
 };
 const reader=createPendingDrive({getToken:()=> 'fixture',fetchImpl});
 const decode=async()=>{const data=new Uint8ClampedArray(370*320*4);for(let y=60;y<260;y++)for(let x=70;x<300;x++)data[(y*370+x)*4+3]=255;return {width:370,height:320,data};};
 const result=await reader.load('char',{decode});assert.equal(result.entries.length,1);
 assert.ok(f.calls.some(c=>decodeURIComponent(c.url).includes("'CharacterCandidates'!")));
 f.rows[1][3]='';await assert.rejects(reader.load('char',{decode}),/マスター/);
});
