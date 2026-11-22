import test from 'node:test';
import assert from 'node:assert/strict';
import { selectJob, requestedBooks, recover, finishAttempt } from '../src/narration-scheduler.js';
const jobs=()=>({a:{slug:'a',order:0,status:'queued'},b:{slug:'b',order:1,status:'queued'},c:{slug:'c',order:2,status:'queued'}});
const request=(slug,created=10)=>({slug,created,confirmed:true,expires:1000});
test('reader requests preempt background and deduplicate readers',()=>{
 const j=jobs(),r={requests:{one:request('c'),two:request('c',20)}};
 assert.equal(selectJob(j,r,[],100).slug,'c');assert.equal(requestedBooks(r,100).size,1);
});
test('oldest reader first; unconfirmed and expired requests cannot promote',()=>{
 const r={requests:{a:{...request('a'),confirmed:false},b:request('b',20),c:request('c',10)}};
 assert.equal(selectJob(jobs(),r,[],100).slug,'c');assert.equal(selectJob(jobs(),r,[],2000).slug,'a');
});
test('Mac reservations exclude duplicate work even when a reader requests it',()=>{
 assert.equal(selectJob(jobs(),{requests:{r:request('a')}},['a'],100).slug,'b');
});
test('restart recovers in-flight stages and preserves completed jobs',()=>{
 const j=jobs();j.a.status='generating';j.b.status='checking';j.c.status='complete';recover(j);
 assert.equal(j.a.status,'paused');assert.equal(j.b.status,'paused');assert.equal(j.c.status,'complete');
 assert.equal(selectJob(j,{},[],100).slug,'a');
});
test('preemption does not consume retries; repeated failures back off and quarantine',()=>{
 const j=jobs().a;finishAttempt(j,75,100);assert.equal(j.failures,undefined);
 finishAttempt(j,1,100);assert.equal(selectJob({a:j},{},[],101),undefined);
 finishAttempt(j,1,100);finishAttempt(j,1,100);assert.equal(j.status,'failed');
 assert.equal(selectJob({a:j},{},[],1e9),undefined);
});
test('completed books never generate again',()=>{
 const j=jobs();finishAttempt(j.a,0,100);assert.equal(selectJob(j,{requests:{a:request('a')}},[],200).slug,'b');
});
