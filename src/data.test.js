import test from 'node:test';
import assert from 'node:assert/strict';
import {isFresh,chartPoints,mergeSeconds} from './data.js';
test('missing, future and aged source timestamps never become live',()=>{
 const d={status:'live',generated_ms:100000,observed_ms:99000};
 assert.equal(isFresh(d),true);assert.equal(isFresh(d,14000),false);
 assert.equal(isFresh({...d,observed_ms:null}),false);
 assert.equal(isFresh({...d,observed_ms:100001}),false);
 assert.equal(isFresh({...d,status:'stale'}),false);
});
test('decimal units preserve zero observations while missing data remains a gap',()=>{
 assert.deepEqual(chartPoints([[1000,1e6,2e6,1,1],[2000,0,0,1,1],[3000,null,0,1,1],[4000,0,0,0,1]]),[{t:1000,rx:1,tx:2},{t:2000,rx:0,tx:0}]);
 assert.deepEqual(chartPoints([[60000,6e6,3e6,0,0,1]],true),[{t:60000,rx:6,tx:3}]);
});
test('tail reconciliation removes readings withdrawn by source, preserving earlier history',()=>{
 const prior=new Map([[11000,{t:11000,rx:1,tx:1}],[16000,{t:16000,rx:1,tx:1}],[20000,{t:20000,rx:1,tx:1}]]);
 const next=mergeSeconds(prior,{revision:22000,points:[[21000,2e6,1e6,1,1]]},20000,10000);
 assert.deepEqual([...next.keys()],[11000,21000]);
});
test('minute transition fully reconciles the range, retaining explicit gaps',()=>{
 const next=mergeSeconds(new Map([[58000,{t:58000,rx:1,tx:1}]]),{revision:61000,points:[[59000,0,0,1,1],[61000,2e6,0,1,1]]},59000,1000);
 assert.deepEqual([...next.keys()],[59000,61000]);
});
