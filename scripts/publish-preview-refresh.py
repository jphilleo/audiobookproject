# Run on the origin only after all release audio has been independently verified in R2.
from pathlib import Path
import sys,json,os,hashlib
stage=Path(sys.argv[1]);library=Path('/var/lib/audiobook/library');old=json.loads((stage/'before.json').read_text());release=json.loads((stage/'release.json').read_text());verified=set(json.loads((stage/'r2-verified.json').read_text()))
assert len(release)==198 and verified=={r['slug'] for r in release}
for r in release:
 slug=r['slug'];current=json.loads((library/slug/'manifest.json').read_text());assert current==old[slug],('Live manifest changed',slug)
 new=json.loads((stage/'manifests'/(slug+'.json')).read_text());assert new['preview'] and not new['ready'] and new['audioSha256']==r['sha256'] and new['previewRelease']=='refresh-20261117'
backup=stage/'backups';backup.mkdir(exist_ok=False)
for r in release:
 slug=r['slug'];dest=library/slug/'manifest.json';(backup/(slug+'.json')).write_bytes(dest.read_bytes());temp=dest.with_name('manifest.refresh.tmp');temp.write_bytes((stage/'manifests'/(slug+'.json')).read_bytes());temp.chmod(0o644);os.replace(temp,dest)
print('Published',len(release),'previews; complete audiobooks unchanged.')
