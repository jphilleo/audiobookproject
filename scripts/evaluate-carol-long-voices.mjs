// Full-length local transcription comparison; not a subjective listening score.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pipeline} from '@huggingface/transformers';
import {prepareSpeechInput} from '../src/narration-text.js';
const dir=path.resolve(process.argv[2]);
const passages=JSON.parse(await fs.readFile(path.join(dir,'passages.json'),'utf8'));
const samples=JSON.parse(await fs.readFile(path.join(dir,'samples.json'),'utf8'));
const words=t=>t.toLowerCase().replace(/’/g,"'").replace(/re-echoed/g,'reechoed').match(/[a-z0-9]+(?:'[a-z]+)?/g)||[];
function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const prev=row;row=[i+1];for(let j=0;j<b.length;j++)row.push(Math.min(row[j]+1,prev[j+1]+1,prev[j]+(a[i]!==b[j])));}return row[b.length];}
const asr=await pipeline('automatic-speech-recognition','onnx-community/whisper-small.en',{dtype:'q8',device:'cpu'});const results=[];
try{for(const sample of samples){const file=path.join(dir,sample.file);const decoded=spawnSync(process.env.FFMPEG||'ffmpeg',['-v','error','-i',file,'-f','f32le','-ar','16000','-ac','1','-'],{maxBuffer:32*1024*1024});if(decoded.status!==0)throw Error(decoded.stderr.toString());const raw=decoded.stdout;const audio=new Float32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));const windows=[];for(let start=0;start<audio.length;start+=20*16000)windows.push((await asr(audio.slice(start,start+20*16000))).text);const transcript=windows.join(' ');const source=passages.find(p=>p.name===sample.passage).text;const a=words(prepareSpeechInput(source)),b=words(transcript);const edits=distance(a,b);results.push({...sample,transcript,source,edits,referenceWords:a.length,wordErrorRate:edits/a.length,wordsPerMinute:sample.words/sample.seconds*60});console.log(sample.voice,sample.passage,edits,a.length);await fs.writeFile(path.join(dir,'evaluation.json'),JSON.stringify(results,null,2));}}finally{await asr.dispose();}
