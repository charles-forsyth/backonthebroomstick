#!/usr/bin/env python3
"""Check a built site: internal links resolve, no raw Liquid left, no secrets, data is sane.

Usage: python3 tools/check_site.py /tmp/botbsite   (the jekyll -d output; baseurl /backonthebroomstick)
Exit 1 on any problem.
"""

import html as html_lib
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

BASE = "/backonthebroomstick"
site = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/botbsite")
problems: list[str] = []

pages = sorted(site.rglob("*.html"))
if len(pages) < 50:
    problems.append(f"only {len(pages)} HTML pages built; expected one per episode plus the main pages")

secret_re = re.compile(r"AIza[0-9A-Za-z_-]{30,}|BOTBS_MCP_TOKEN|GEMINI_API_KEY|sk-[A-Za-z0-9]{20,}")
liquid_re = re.compile(r"\{\{|\{%")
href_re = re.compile(r'(?:href|src)="([^"#?]+)')
# Script in host-editable data must never reach a page: no inline event handlers (onclick=, onerror=...) in any tag,
# and no script/HTML URLs in href/src/action/formaction/poster. The site's own JS uses addEventListener only.
handler_re = re.compile(r"<[a-zA-Z][^>]*?[\s\"'/]on[a-z]+\s*=", re.S)
url_attr_re = re.compile(r"""\b(?:href|src|action|formaction|poster|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""", re.I)
bad_url_re = re.compile(r"^(?:javascript|vbscript|livescript):|^data:text/html", re.I)


def squash(url: str) -> str:
    """A URL as a browser reads its scheme: entities decoded, whitespace/control characters dropped."""
    u = url
    for _ in range(3):
        u = html_lib.unescape(u)
    return re.sub(r"[\s\x00-\x1f]+", "", u)


for p in pages:
    html = p.read_text(errors="replace")
    rel = p.relative_to(site)
    if liquid_re.search(re.sub(r"<script.*?</script>", "", html, flags=re.S)):
        problems.append(f"{rel}: raw Liquid in output")
    if secret_re.search(html):
        problems.append(f"{rel}: looks like a secret")
    tags_only = re.sub(r"<script.*?</script>|<style.*?</style>|<!--.*?-->", "", html, flags=re.S | re.I)
    m = handler_re.search(tags_only)
    if m:
        problems.append(f"{rel}: inline event handler attribute: {m.group(0)[-60:]!r}")
    for groups in url_attr_re.findall(tags_only):
        val = next((g for g in groups if g), "")
        if bad_url_re.match(squash(val)):
            problems.append(f"{rel}: script URL in an attribute: {val[:60]!r}")
    for href in href_re.findall(html):
        u = urlparse(href)
        if u.scheme or href.startswith(("mailto:", "data:", "//")):
            continue
        if not href.startswith(BASE + "/") and href != BASE:
            problems.append(f"{rel}: internal link without baseurl: {href}")
            continue
        path = unquote(href[len(BASE) :]) or "/"
        target = site / path.lstrip("/")
        if path.endswith("/"):
            target = target / "index.html"
        if not target.exists() and not target.with_suffix(".html").exists():
            problems.append(f"{rel}: broken link {href}")

eps = json.loads((site / "assets/js/episodes.json").read_text())
if len(eps) < 250:
    problems.append(f"episodes.json has {len(eps)} episodes; expected about 300")
slugs = [e["slug"] for e in eps]
if len(set(slugs)) != len(slugs):
    problems.append("duplicate episode slugs")
for e in eps:
    for k in ("slug", "title", "date", "audio", "show"):
        if not e.get(k):
            problems.append(f"episode {e.get('slug')}: missing {k}")
    if not (site / "episodes" / e["slug"] / "index.html").exists():
        problems.append(f"no page for episode {e['slug']}")
    if re.search(r"Got a question\?\s*$", e.get("notes") or ""):  # the feed's fan-mail link text, cut in half
        problems.append(f"episode {e['slug']}: notes end with a bare 'Got a question?'")

for p in problems[:60]:
    print("PROBLEM", p)
print(f"{len(pages)} pages, {len(eps)} episodes, {len(problems)} problem(s)")
sys.exit(1 if problems else 0)
