import test from 'node:test';import assert from 'node:assert/strict';
import {planSpeech,validateWaveform,MAX_MODEL_TOKENS} from '../src/token-safe-tts.js';
import {htmlToText,parseEpub} from '../src/epub.js';
import {chunkText} from '../src/tts.js';
const model={tokenizer(text,opts){assert.equal(opts.truncation,false);return {dims:[1,text.length*10+2]};},async generate(text,options){return this.generate_from_ids(this.tokenizer(text,{truncation:true}),options);}};
test('token planning preserves all words while budgeting expanded tokens',async()=>{const text='1234567890 '.repeat(30).trim();const segments=await planSpeech(model,text,'af_heart');assert.equal(segments.map(s=>s.text).join(' '),text);assert.ok(segments.length>1);assert.ok(segments.every(s=>s.tokens<=MAX_MODEL_TOKENS));});
test('unbreakable over-budget tokens fail rather than silently lose text',async()=>{await assert.rejects(planSpeech(model,'1'.repeat(100),'af_heart'),/unbroken/);});
test('invalid and silent generated audio cannot be marked complete',()=>{for(const value of [new Float32Array(),new Float32Array(500),new Float32Array(500).fill(NaN)])assert.throws(()=>validateWaveform(value));const valid=validateWaveform(new Float32Array(500).fill(2));assert.ok(valid[0]<=.981);});
test('semantic notes precede exponent conversion and literal numbers survive',()=>{assert.equal(htmlToText('<p>Word<sup epub:type="noteref">2</sup>; values[1]; 10<sup>2</sup>.</p>').text,'Word; values[1]; 10 squared .');});
test('hidden and deleted drafts are excluded',()=>{assert.equal(htmlToText('<p hidden>Draft</p><p><del>Wrong</del><ins>Correct</ins></p>').text,'Correct');});
test('hard chunk boundaries preserve supplementary characters',()=>{const chunks=chunkText('a'.repeat(379)+'\u{10400}'+'b');assert.ok(chunks.every(c=>c.text.isWellFormed()));});

import {prepareSpeechInput} from '../src/narration-text.js';
test('isolated dialogue drops only outer speech delimiters',()=>{assert.equal(prepareSpeechInput('“It is.”'),'It is.');assert.equal(prepareSpeechInput('“A golden one.”'),'A golden one.');assert.equal(prepareSpeechInput('“No,” he said. “Go.”'),'“No,” he said. “Go.”');});

test('reviewed pronunciation spellings preserve ordinary prose',()=>{assert.equal(prepareSpeechInput('Which all the family reechoed.'),'Which all the family re-echoed.');assert.equal(prepareSpeechInput('“Ding, dong!”'),'Ding-dong!');assert.equal(prepareSpeechInput('“Ha, ha! Ha, ha, ha, ha!”'),'Ha-ha! Ha-ha-ha-ha!');assert.equal(prepareSpeechInput('He said ha, then left.'),'He said ha, then left.');});
