# Deploying Audiobook Project

The cheap setup: one small server runs the app, Cloudflare (free plan) sits in front for DNS and
HTTPS, and the library audio lives in Cloudflare R2. About $5–8 a month plus the domains.

```
visitor → Cloudflare (DNS, HTTPS, cache) → Cloudflare Tunnel → server: node server.js on :4800
                                         → R2 bucket (library audio) at audio.audiobookproject.org
```

## 1. Domains

Register `audiobookproject.org` (and `audiobookproject.com`) with Cloudflare Registrar. Both end up
on Cloudflare's DNS automatically. Redirect the .com with a Cloudflare redirect rule:
`audiobookproject.com/*` → `https://audiobookproject.org/$1` (301).

## 2. The server

A Hetzner Cloud server with 4 vCPUs and 8 GB of RAM is plenty to start (the ARM "CAX21" is the
cheapest). Pick Ubuntu 24.04. Then, as root:

```bash
apt update && apt install -y ffmpeg git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
adduser --disabled-password --gecos "" audiobook
```

Get the code onto it:

```bash
sudo -u audiobook git clone https://github.com/jphilleo/audiobookproject /home/audiobook/app
cd /home/audiobook/app && sudo -u audiobook npm ci --omit=dev
```

The voice model (Kokoro) downloads itself on first start.

### Run it as a service

`/etc/audiobook.env`:

```bash
PUBLIC_URL=https://audiobookproject.org
TRUST_PROXY=1
LIBRARY_AUDIO_URL=https://audio.audiobookproject.org
GITHUB_URL=https://github.com/jphilleo/audiobookproject
# Optional limits (these are the defaults)
MAX_ACTIVE_BOOKS=2
MIN_FREE_GB=5
```

`/etc/systemd/system/audiobook.service`:

```ini
[Unit]
Description=Audiobook Project
After=network-online.target

[Service]
User=audiobook
WorkingDirectory=/home/audiobook/app
EnvironmentFile=/etc/audiobook.env
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now audiobook
journalctl -u audiobook -f     # watch it start; "Kokoro voice model loaded" means it's ready
```

## 3. HTTPS with Cloudflare Tunnel

The tunnel connects out to Cloudflare, so the server needs no open ports and no certificates.
Install `cloudflared` (see Cloudflare's docs for the current package), then:

```bash
cloudflared tunnel login
cloudflared tunnel create audiobookproject
cloudflared tunnel route dns audiobookproject audiobookproject.org
```

`/etc/cloudflared/config.yml`:

```yaml
tunnel: audiobookproject
credentials-file: /root/.cloudflared/<tunnel id>.json
ingress:
  - hostname: audiobookproject.org
    service: http://localhost:4800
  - service: http_status:404
```

```bash
cloudflared service install && systemctl enable --now cloudflared
```

In Cloudflare, set SSL/TLS to "Full", and turn off any firewall rules on the server except SSH.

## 4. Library audio on R2

Create an R2 bucket (`audiobookproject-library`), connect the custom domain
`audio.audiobookproject.org` to it, and upload from your Mac with [rclone](https://rclone.org/s3/#cloudflare-r2):

```bash
rclone sync library r2:audiobookproject-library --include "*/chapters/*.m4a" --include "*/*.m4b" --include "*/*.mp3"
# Make the whole-book files download instead of playing in the browser:
rclone copy library r2:audiobookproject-library --include "*/*.m4b" --include "*/*.mp3" \
  --header-upload "Content-Disposition: attachment"
```

The server only needs each book's `manifest.json` and cover files in `library/` (it makes the small
cover thumbnails itself). Copy those over:

```bash
rsync -av --include "*/" --include "manifest.json" --include "cover*" --exclude "*" \
  library/ audiobook@<server>:/home/audiobook/app/library/
```

Narrate new library books on your Mac (`node scripts/narrate-library.js`, much faster than the
server), then repeat the two commands above.

## 5. Search

1. [Google Search Console](https://search.google.com/search-console): add `audiobookproject.org` as a
   Domain property, verify it with the TXT record Cloudflare's DNS makes easy, and submit
   `https://audiobookproject.org/sitemap.xml`.
2. [Bing Webmaster Tools](https://www.bing.com/webmasters): import the site from Search Console.
3. Turn on Cloudflare Web Analytics (free, no cookies).
4. After a week, check Search Console's Pages report and fix anything it flags.

## 6. Before you announce it

- Register a DMCA agent with the [US Copyright Office](https://www.copyright.gov/dmca-directory/) ($6).
- Check the GitHub links in the footer and About page go to the public repo.
- Upload a book end to end on the live site: upload, sample a voice, narrate a chapter, download
  the M4B, add the podcast feed to your phone.

## Updating

```bash
cd /home/audiobook/app && sudo -u audiobook git pull && sudo -u audiobook npm ci --omit=dev && systemctl restart audiobook
```

A restart puts uploaded books that are mid-narration back to idle, so update when it's quiet.
