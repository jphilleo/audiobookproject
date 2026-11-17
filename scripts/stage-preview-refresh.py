from pathlib import Path
import json,hashlib,os,sys
root=Path(sys.argv[1]).resolve();old=json.loads(Path(sys.argv[2]).read_text());release='refresh-20261117';upload=root/'upload';stage=root/'manifests';upload.mkdir(exist_ok=True);stage.mkdir(exist_ok=True);records=[]
for b in json.loads((root/'plan.json').read_text()):
 if b['complete']:continue
 d=root/b['slug']
 if not (d/'verification.json').exists():continue
 v=json.loads((d/'verification.json').read_text());m=json.loads((d/'manifest.json').read_text());data=(d/'001.m4a').read_bytes();assert v['fullDecode'] and v['maxTokens']<=510 and v['sha256']==hashlib.sha256(data).hexdigest() and v['bytes']==len(data)
 assert m['preview'] and not m['ready'] and m['voice']['id']==b['voice'] and len(m['chapters'])==1
 baseline=old[b['slug']];assert baseline['preview'] and not baseline['ready']
 m['cover']=baseline['cover'];m['audioStorage']='r2';m['previewRelease']=release;m['chapters'][0]['file']='chapters/001.m4a'
 (stage/(b['slug']+'.json')).write_text(json.dumps(m,indent=2))
 target=upload/(b['slug']+'.m4a')
 if not target.exists():os.link(d/'001.m4a',target)
 records.append({'slug':b['slug'],'authorSlug':b['authorSlug'],'voice':m['voice'],'sha256':v['sha256'],'bytes':len(data),'url':f"https://audio.audiobookproject.org/previews/{release}/{b['slug']}.m4a"})
(root/'release.json').write_text(json.dumps(records,indent=2));print(len(records),'verified previews staged')
