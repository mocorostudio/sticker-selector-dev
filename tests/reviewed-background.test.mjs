import test from 'node:test';import assert from 'node:assert/strict';
import {prepareTransparency} from '../integration-v1/crop-v9/transparency.mjs';
test('explicit reviewed region removes colored film, retaining white art, weak fringe and unreviewed decoration',()=>{
 const data=new Uint8ClampedArray(40*40*4);
 for(let y=0;y<10;y++)for(let x=0;x<40;x++)data.set([120,70,40,60],(y*40+x)*4);
 for(let y=12;y<28;y++)for(let x=12;x<28;x++)data.set([255,255,255,255],(y*40+x)*4);
 data.set([100,160,40,40],(11*40+20)*4);data.set([220,80,120,60],(35*40+35)*4);
 const im={width:40,height:40,data},original=data.slice();assert.equal(prepareTransparency(im).data[3],60);
 const result=prepareTransparency(im,{reviewedBackground:{kind:'reviewed-background-regions/v1',regions:[[0,0,40,10]],reason:'operator confirmed colored film in top strip'}});
 assert.equal(result.data[3],0);assert.equal(result.data[(20*40+20)*4+3],255);assert.equal(result.data[(11*40+20)*4+3],40);assert.equal(result.data[(35*40+35)*4+3],60);assert.deepEqual(data,original);assert.ok(result.report.reviewedHazeRemoved>0);assert.equal(result.report.visualReviewRequired,true);
 assert.throws(()=>prepareTransparency(im,{reviewedBackground:{kind:'reviewed-background-regions/v1',regions:[[0,0,41,10]],reason:'x'}}));
});
