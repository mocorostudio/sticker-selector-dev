import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyInspection} from '../inspection-policy.mjs';
test('minor differences remain review without promoting to pass',()=>{
 for(const reason of ['小物がマスターと違う','ポーズ不一致','軽微な切り出し欠け','修正可能な小さな透過ノイズ'])assert.equal(classifyInspection('fail',reason),'review');
 for(const reason of ['文字の濁点が重複','他候補の混入','ひれの増殖','重大な形状破綻','使用不能な透過不良','軽微な画風の差。誤字あり'])assert.equal(classifyInspection('fail',reason),'fail');
 assert.equal(classifyInspection('review','見た目は使いたい'),'review');
});
