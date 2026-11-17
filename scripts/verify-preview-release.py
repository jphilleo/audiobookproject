from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import sys,json,urllib.request,hashlib
root=Path(sys.argv[1]);mode=sys.argv[2];records=json.loads((root/'release.json').read_text())
def get(url,headers={}):return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0',**headers}),timeout=120)
def verify(r):
 if mode=='live':
  with get(f"https://audiobookproject.org/library/{r['authorSlug']}/{r['slug']}") as f:page=f.read().decode()
  assert f'data-src="{r["url"]}"' in page and r['voice']['name'] in page,r['slug']
 else:
  h=hashlib.sha256();size=0
  with get(r['url']) as f:
   assert f.status==200 and f.headers['Content-Type'].startswith('audio/'),r['slug']
   while chunk:=f.read(1024*1024):h.update(chunk);size+=len(chunk)
  assert size==r['bytes'] and h.hexdigest()==r['sha256'],r['slug']
 with get(r['url'],{'Range':'bytes=0-4095'}) as f:
  assert f.status==206 and f.headers['Content-Range']==f"bytes 0-4095/{r['bytes']}",r['slug']
  assert f.read()==(root/'upload'/(r['slug']+'.m4a')).read_bytes()[:4096],r['slug']
 return r['slug']
with ThreadPoolExecutor(max_workers=4) as pool:
 passed=list(pool.map(verify,records))
(root/(mode+'-verified.json')).write_text(json.dumps(passed));print('Verified',len(passed),mode)
