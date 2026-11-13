# Vendor block pages in the Wayback Machine

`misc/filterProbe/buildProbeData.ts` reruns block-page check itself. Use only for new research.

- CDX ignores path in `url=*.securly.com/blocked*`: leading `*.` makes it domain match, drops path. Use `url=securly.com&matchType=domain&filter=original:.*securly\.com(:443)?/blocked.*`.
- Wayback MCP `search_archives` times out at 30 s on domain-wide regex scan (Securly took 35 s with curl). `get_archived_url` rejects numeric timestamp: pass `"latest"` for unique URL. Curl or script for bulk work, MCP for spot checks.
- Internet Archive refuses parallel CDX and capture requests (connection refused, 429, 503). One request at a time, with pause.
- Raw `id_` captures keep archived encoding (Linewize's come back gzipped). Check for bytes `1f 8b` and gunzip.
- Archived Securly and GoGuardian block URLs carry students' emails. Redact before printing. Never commit.
- Hosted block pages found so far: `*.securly.com/blocked` (www, useast, useast2, uk, euwest), `blocked.goguardian.com`, `blocked.lsfilter.com`, `block.lsclassroom.com`, Lightspeed `lsrelay-config-production.s3.amazonaws.com/<hash>/block_screen.html`, `blocked.syd-1.linewize.net/blocked` (SPA: text in JS), `block.opendns.com/swg`, iboss `*.ibosscloud.com/syncCustomBranding/block_page/...`, ContentKeeper `wh.contentkeeper.net/<id>/blockpage.html` (two captures; script fills text, so marker is `<title>`). Every other vendor blocks with page inside its extension (`~/extensions/<folder>/blocked.html` and similar).