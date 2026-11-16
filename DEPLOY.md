# Deploying Audiobook Project

The public converter runs on an Ubuntu VPS at Contabo. Cloudflare manages both domains and sends
`audiobookproject.com` and `www.audiobookproject.com` to `https://audiobookproject.org` with a
301 that preserves the path and query. Caddy terminates HTTPS on the VPS. Cloudflare R2 serves
public-domain library audio at `audio.audiobookproject.org`. User uploads and conversions live on
the VPS, outside the public library bucket.

## Server

Install Node.js 24, ffmpeg, Git, and Caddy. Create an unprivileged system user named `audiobook`
and give it ownership of `/opt/audiobook` and `/var/lib/audiobook`. Clone this repository into
`/opt/audiobook/app` as that user and run `npm ci --omit=dev`. The Kokoro model downloads on
first startup.

The `audiobook.service` systemd service runs as the `audiobook` user, with
`WorkingDirectory=/opt/audiobook/app` and `ExecStart=/usr/bin/node server.js`. Use these environment
variables in the unit or a systemd drop-in:

```ini
[Service]
Environment=PORT=4800
Environment=PUBLIC_URL=https://audiobookproject.org
Environment=TRUST_PROXY=1
Environment=DATA_DIR=/var/lib/audiobook/books
Environment=LIBRARY_DIR=/var/lib/audiobook/library
Environment=LIBRARY_AUDIO_URL=https://audio.audiobookproject.org
```

Point the DNS-only apex record for `audiobookproject.org` to the VPS. Allow inbound HTTP and HTTPS
for Caddy and keep port 4800 private. Caddy obtains and renews the public certificate:

```caddyfile
audiobookproject.org {
    reverse_proxy 127.0.0.1:4800
}
```

Deploy source updates from GitHub:

```sh
sudo -u audiobook git -C /opt/audiobook/app pull --ff-only
cd /opt/audiobook/app && sudo -u audiobook npm ci --omit=dev
sudo systemctl daemon-reload
sudo systemctl restart audiobook
sudo journalctl -u audiobook -n 30 --no-pager
```

Restart when the conversion queue is idle. Verify the HTTPS homepage, the `.com` redirect, and
an upload, preview, narration, and M4B download using the sample EPUB in `samples/`.

## Public audiobook library

The book catalog is in `src/catalog.js`. Generate audio locally with Node.js and ffmpeg:

```sh
LIBRARY_DIR="$PWD/library" node scripts/narrate-library.js a-christmas-carol
LIBRARY_DIR="$PWD/library-previews" node scripts/narrate-library.js --preview moby-dick
```

Use separate directories for full books and previews. Copy only public-domain library audio to
the Standard-storage R2 bucket `audiobookproject-library`:

- Complete books use `<slug>/chapters/<number>.m4a`, `<slug>/<slug>.m4b`, and `<slug>/<slug>.mp3`.
- First chapters use `previews/<slug>.m4a`.

The R2 custom domain is `audio.audiobookproject.org`. Chapter files and M4B use `audio/mp4`, and
MP3 uses `audio/mpeg`. Full-book files need `Content-Disposition: attachment` for cross-origin
downloads. The Cloudflare response header rules apply these headers to the audio hostname.

Verify that the files respond over HTTPS before publishing. Copy each finished manifest and
cover into `/var/lib/audiobook/library/<slug>/` on the VPS. For complete books, also keep chapter
files there so podcast RSS enclosures include the byte lengths. A preview manifest creates a
playable book page, and a complete manifest also enables downloads and podcast feeds. Generated
audio, ebook inputs, uploads, credentials, and production-only data belong outside Git.

## Tips

Create a live Stripe Payment Link with **Customers choose what to pay**, USD, a suggested
amount of $5, and a minimum of $1. Title it **Support Audiobook Project** and describe it
as an optional one-time tip for the free converter and library.

The Support page shows a checkout link when `DONATION_URL` is set to the verified HTTPS
Stripe Payment Link. Add it to a systemd drop-in, then reload and
restart the service when the converter queue is idle. The public URL is sufficient. The site does
not need payment credentials or payment processing code.

Open `https://audiobookproject.org/donate`, follow the link to Stripe, and confirm the project
name, the $5 preset, and that the amount can be changed to $1.

## Search

Verify the `audiobookproject.org` Domain property in Google Search Console with a Cloudflare DNS
TXT record and submit `https://audiobookproject.org/sitemap.xml`. The sitemap includes the
converter pages, the library, and all playable book pages. Check individual URLs with URL
Inspection and check the Page indexing report after it finishes processing.

The site can also be added to Bing Webmaster Tools. Cloudflare Web Analytics is available if
enabled for the project.
