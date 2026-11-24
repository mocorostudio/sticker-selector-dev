import test from 'node:test';
import assert from 'node:assert/strict';
import {byteCache} from '../integration-v1/image-preview.mjs';

test('thumbnail cache evicts least recently used bytes across products',()=>{
 const cache=byteCache(12);
 const entry=size=>({blob:new Blob([new Uint8Array(size)])});
 cache.set('product-a:1',entry(5));
 cache.set('product-a:2',entry(5));
 assert.equal(cache.get('product-a:1').blob.size,5);
 cache.set('product-b:1',entry(6));
 assert.equal(cache.get('product-a:2'),undefined);
 assert.equal(cache.bytes,11);
 cache.set('product-b:1',entry(13));
 assert.equal(cache.get('product-b:1'),undefined);
 assert.equal(cache.bytes,5);
 cache.clear();
 assert.equal(cache.bytes,0);
});
