import fs from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {pipeline} from '@huggingface/transformers';
const asr=await pipeline('automatic-speech-recognition','onnx-community/whisper-base.en',{dtype:'q8',device:'cpu'});
const results=[];
for(const file of process.argv.slice(2)){
 const r=spawnSync(process.env.FFMPEG||'ffmpeg',['-v','error','-i',file,'-t','35','-f','f32le','-ar','16000','-ac','1','-'],{maxBuffer:16000*4*40});if(r.status!==0)throw new Error(r.stderr.toString());
 const raw=r.stdout;const samples=new Float32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));const result=await asr(samples);results.push({file,text:result.text});console.log(JSON.stringify(results.at(-1)));
}
await fs.writeFile(process.env.ASR_REPORT||'/tmp/carol-transcripts.json',JSON.stringify(results,null,2));await asr.dispose();
