"""Bounded, resumable GPU narration of production-prepared text; never truncates phonemes."""
from pathlib import Path
import sys,json,time,hashlib,re,subprocess,os,shutil
import numpy as np
import mlx.core as mx
from mlx_audio.tts.utils import load_model
mx.set_cache_limit(256*1024*1024)
mx.set_memory_limit(4*1024*1024*1024)
root=Path(sys.argv[1]).resolve(); ffmpeg=Path(os.environ['FFMPEG']);model=load_model('mlx-community/Kokoro-82M-bf16');model.repo_id='mlx-community/Kokoro-82M-bf16'
plan=json.loads((root/'plan.json').read_text());wanted=set(sys.argv[2:]);books=[b for b in plan if not b['complete'] and (not wanted or b['slug'] in wanted)]
books.sort(key=lambda b:-b['words'])
def digest(data):return hashlib.sha256(data).hexdigest()
def segments(pipe,text):
 ps,_=pipe.g2p(text)
 if not ps:raise ValueError('No phonemes: '+text)
 tokens=[model.vocab[p] for p in ps if p in model.vocab]
 if len(ps)<=508 and len(tokens)+2<=510:return [(text,ps,len(tokens)+2)]
 spaces=list(re.finditer(r'\s+',text));assert spaces,'Unbreakable over-budget input'
 split=min(spaces,key=lambda m:abs(m.start()-len(text)/2))
 return segments(pipe,text[:split.start()].strip())+segments(pipe,text[split.end():].strip())
errors=[]
for book in books:
 d=root/book['slug'];entry=json.loads((d/'input.json').read_text());start=time.monotonic()
 if (d/'verification.json').exists():continue
 if shutil.disk_usage(root).free < max(300*1024**2,entry['words']*40000):raise SystemExit('Insufficient free space before '+book['slug'])
 print(book['slug'],'START',entry['voice'],entry['words'],flush=True)
 try:
  pipe=model._get_pipeline(entry['voice'][0]);pack=pipe.load_voice(entry['voice']);checkpoint=d/'chunks';checkpoint.mkdir(exist_ok=True);audit=[]
  raw=d/'chapter.pcm'
  with raw.open('wb') as out:
   for i,c in enumerate(entry['chunks']):
    pcmfile=checkpoint/f'{i}.pcm';metafile=checkpoint/f'{i}.json';meta=None
    try:
     meta=json.loads(metafile.read_text());pcm=pcmfile.read_bytes();assert meta['speech']==c['speech'] and digest(pcm)==meta['sha256'] and meta['fingerprint']==entry['fingerprint']
    except (OSError,ValueError,AssertionError):
     parts=segments(pipe,c['speech']);assert ' '.join(s[0] for s in parts).split()==c['speech'].split();audio_parts=[]
     for text,ps,tokens in parts:
      output=model(ps,pack[len(ps)-1],1,return_output=True);audio=np.asarray(output.audio).reshape(-1)
      assert audio.size>=240 and np.isfinite(audio).all();peak=float(np.max(np.abs(audio)));assert peak>0.00001
      if peak>0.98:audio=audio*(0.98/peak)
      if audio_parts:audio_parts.append(bytes(2880*2))
      audio_parts.append((audio*32767).astype('<i2').tobytes())
      del output,audio
      mx.clear_cache()
     pcm=b''.join(audio_parts);meta={'text':c['text'],'speech':c['speech'],'fingerprint':entry['fingerprint'],'segments':[{'text':t,'phonemes':p,'tokens':n} for t,p,n in parts],'bytes':len(pcm),'sha256':digest(pcm)}
     pcmfile.write_bytes(pcm);metafile.write_text(json.dumps(meta))
    out.write(pcm);out.write(bytes(round(24000*(.45 if c['paragraphEnd'] else .12))*2));audit.append(meta)
    if i%25==0:print(book['slug'],'chunk',i+1,'/',len(entry['chunks']),flush=True)
  ms=round(raw.stat().st_size/48);assert entry['words']*140<ms<entry['words']*1500,(entry['words'],ms)
  audio=d/'001.m4a';subprocess.run([str(ffmpeg),'-nostdin','-v','error','-y','-f','s16le','-ar','24000','-ac','1','-i',str(raw),'-c:a','aac','-b:a','64k','-movflags','+faststart',str(audio)],check=True)
  subprocess.run([str(ffmpeg),'-v','error','-i',str(audio),'-map','0:a','-f','null','-'],check=True)
  data=audio.read_bytes();manifest={'ready':False,'preview':True,'voice':{'id':entry['voice'],'name':'Emma' if entry['voice']=='bf_emma' else 'Heart'},'words':entry['words'],'chapters':[{'title':entry['openingTitle'],'words':entry['words'],'file':'001.m4a','durationMs':ms,'fingerprint':entry['fingerprint']}],'durationMs':ms,'audioSha256':digest(data)}
  (d/'manifest.json').write_text(json.dumps(manifest,indent=2));(d/'audit.json').write_text(json.dumps(audit));(d/'verification.json').write_text(json.dumps({'fingerprint':entry['fingerprint'],'chunks':len(audit),'maxTokens':max(s['tokens'] for c in audit for s in c['segments']),'sourceCoverage':'all prepared chunks and split text verified','fullDecode':True,'sha256':digest(data),'bytes':len(data),'durationMs':ms,'engine':'mlx-community/Kokoro-82M-bf16'},indent=2))
  raw.unlink()
  # Only this release's generated PCM is removed after verified compressed output exists.
  for p in checkpoint.iterdir():p.unlink()
  checkpoint.rmdir()
  print(book['slug'],'READY',round(ms/1000),'seconds audio in',round(time.monotonic()-start),'seconds',flush=True)
 except Exception as e:errors.append(book['slug']);print(book['slug'],'FAILED',repr(e),flush=True)
if errors:raise SystemExit('Failed: '+', '.join(errors))
