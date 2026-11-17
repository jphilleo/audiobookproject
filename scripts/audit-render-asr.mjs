// Independent local transcription is a review aid, not proof of perfect pronunciation.
import fs from 'node:fs/promises';import path from 'node:path';import {pipeline} from '@huggingface/transformers';
const dir=path.resolve(process.argv[2]);const cacheDir=path.join(dir,'asr');await fs.mkdir(cacheDir,{recursive:true});
const model=await pipeline('automatic-speech-recognition','onnx-community/whisper-base.en',{dtype:'q8',device:'cpu'});
const words=t=>t.toLowerCase().replace(/\bmr\./g,'mister').replace(/\bmrs\./g,'missus').replace(/\bst\./g,'saint').replace(/’/g,"'").match(/[a-z0-9]+(?:'[a-z]+)?/g)||[];
function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){let prev=row;row=[i+1];for(let j=0;j<b.length;j++)row.push(Math.min(row[j]+1,prev[j+1]+1,prev[j]+(a[i]!==b[j])));}return row[b.length];}
const results=[];
try{for(const file of (await fs.readdir(path.join(dir,'chapters'))).filter(f=>f.endsWith('.audit.json')).sort()){
 const audit=JSON.parse(await fs.readFile(path.join(dir,'chapters',file),'utf8'));
 for(const [index,c]of audit.chunks.entries()){
  const cacheFile=path.join(cacheDir,`${c.sha256}.json`);let transcript;
  try{transcript=JSON.parse(await fs.readFile(cacheFile,'utf8')).text;}catch{
   const raw=await fs.readFile(path.join(dir,'checkpoints',audit.fingerprint,`${index}.pcm`));
   // Resample 24kHz PCM to 16kHz for Whisper with linear interpolation.
   const count=Math.floor(raw.length/2/1.5),audio=new Float32Array(count);
   for(let j=0;j<count;j++){const x=j*1.5,k=Math.floor(x),mix=x-k;audio[j]=(raw.readInt16LE(k*2)*(1-mix)+raw.readInt16LE(Math.min(k+1,raw.length/2-1)*2)*mix)/32768;}
   transcript=(await model(audio)).text;await fs.writeFile(cacheFile,JSON.stringify({text:transcript}));
  }
  const expected=words(c.text),actual=words(transcript);const rate=distance(expected,actual)/Math.max(1,expected.length);
  results.push({chapter:file,index,expected:c.text,transcript,wordErrorRate:rate,review:rate>.3||(expected.length>10&&actual.length<expected.length*.7)});
  if(index%50===0)console.log(file,index,'transcribed');
 }
}}
finally{await model.dispose();}
await fs.writeFile(path.join(dir,'asr-review.json'),JSON.stringify({note:'Automated transcription can itself be wrong. Review flags manually; this is not a pronunciation certification.',checked:results.length,flagged:results.filter(r=>r.review).length,results},null,2));console.log('Checked',results.length,'flagged',results.filter(r=>r.review).length);
