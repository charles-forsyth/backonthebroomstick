"""Import the hosts' Wix blog posts (backonthebroomstick.com/blog) into the dev site's blog as Markdown posts.

One-off, run from the laptop:  uv run --no-project --with beautifulsoup4 --with pillow --with pyyaml --with httpx \
    python tools/import_wix_blog.py --site ~/Projects/backonthebroomstick [--html /tmp/botb_bg/wix]

Reads each post page's server-rendered rich text (section[data-hook=post-description]) and the page's JSON-LD for
title, date and author. Converts paragraphs, bold/italic (underline -> bold), links (https only; http upgraded where
the site serves https), bullet lists, single images and galleries. Short Title-Case lines ending in a colon or
standing alone before a list become ## headings; consecutive one-line items become lists. Images are downloaded
full size, resized to 1200 px WebP (metadata dropped) into assets/img/uploads/wix-<post>-<n>.webp; the first image
becomes the cover unless it is the only image in the post body, in which case it stays inline AND is the cover.
Every body goes through botbs.blog.check_body, the same rules as posts written through the archive.
"""

from __future__ import annotations

import argparse
import html as htmlmod
import io
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

import httpx
import yaml
from bs4 import BeautifulSoup, NavigableString, Tag
from PIL import Image, ImageOps

sys.path.insert(0, str(Path.home() / "Projects/Back_on_the_Broomstick/archive/src"))
from botbs.blog import check_body, excerpt_of, slugify  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) botb-dev-site-import"}
MEDIA_RE = re.compile(r"(5d5d7e_[0-9a-f]{32}~mv2\.(?:jpg|jpeg|png|webp|gif))", re.I)

# Categories per post, chosen by reading each one (the hosts can change them later through the archive).
CATS = {
    "light-in-dark-corners-spell": ["Spells"],
    "late-spring-magick-in-a-bottle": ["Spells", "Sabbats"],
    "nine-sacred-woods-of-the-ne-usa": ["Herbs", "Sabbats"],
    "balefire-tarot-spread": ["Tarot", "Sabbats"],
    "botb-s-12-nights-of-yule": ["Sabbats", "Tarot"],
    "pythagorean-numerology": ["Divination"],
    "crown-of-becoming-a-beltane-rite-of-sovereignty": ["Sabbats", "Spells"],
    "the-seed-a-tarot-spread-for-ostara-spring-by-tarot-dreams-tumblr": ["Tarot", "Sabbats"],
    "spiritual-growth-spread-by-lalania-simone": ["Tarot"],
    "pagan-festivals-of-2025": ["Community"],
    "itchy-asshole-spell": ["Spells"],
    "home-protection-spells": ["Spells"],
    "ancestral-roots-meditation-to-connect-with-an-unknown-ancestor": ["Ancestors", "Spells"],
}


def norm(s: str) -> str:
    s = s.replace("\u00a0", " ").replace("\u200b", "")
    return re.sub(r"[ \t]+", " ", s)


def inline(node: Tag, in_bold: bool = False, in_ital: bool = False) -> str:
    """Rich-text paragraph -> Markdown inline text (no nested ** or *)."""
    out = []
    for c in node.children:
        if isinstance(c, NavigableString):
            out.append(norm(str(c)))
            continue
        if not isinstance(c, Tag):
            continue
        if c.name == "br":
            out.append("\n")
            continue
        style = str(c.get("style", "") or "").replace(" ", "")
        bold = (c.name in ("strong", "b", "u") or "font-weight:bold" in style or "font-weight:700" in style) and not in_bold
        ital = (c.name in ("em", "i") or "font-style:italic" in style) and not in_ital
        inner = inline(c, in_bold or bold, in_ital or ital)
        if not inner.strip():
            out.append(inner)
            continue
        if c.name == "a" and c.get("href"):
            href = str(c["href"]).strip()
            if href.startswith("http://"):
                href = "https://" + href[7:]
            if href.startswith("https://"):
                text = inner.strip().strip("*").strip()
                if text.startswith(("http://", "https://")):
                    text = re.sub(r"^https?://(www\.)?", "", text).rstrip("/")
                out.append(f"[{text}]({href})")
                continue
        lead = inner[: len(inner) - len(inner.lstrip())]
        trail = inner[len(inner.rstrip()) :]
        core = inner.strip()
        if bold:
            core = f"**{core}**"
        if ital:
            core = f"*{core}*"
        out.append(lead + core + trail)
    s = "".join(out)
    return s


def fetch_image(url_or_id: str, dest: Path, http: httpx.Client) -> tuple[int, int] | None:
    mid = MEDIA_RE.search(url_or_id)
    if not mid:
        return None
    url = f"https://static.wixstatic.com/media/{mid.group(1)}"
    r = http.get(url, headers=UA, follow_redirects=True)
    if r.status_code != 200:
        print("  image failed", r.status_code, url)
        return None
    im = Image.open(io.BytesIO(r.content))
    im = ImageOps.exif_transpose(im).convert("RGB")
    im.thumbnail((1200, 1200))
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=82, method=6)
    return im.size


def images_in(block: Tag) -> list[tuple[str, str]]:
    """(media id, alt/caption) for every image in a block, in order, de-duplicated."""
    seen, out = set(), []
    for img in block.find_all("img"):
        src = img.get("data-pin-media") or img.get("src") or ""
        m = MEDIA_RE.search(src)
        if m and m.group(1) not in seen:
            seen.add(m.group(1))
            out.append((m.group(1), (img.get("alt") or "").strip()))
    for m in MEDIA_RE.finditer(str(block)):  # galleries keep items in data attributes
        if m.group(1) not in seen:
            seen.add(m.group(1))
            out.append((m.group(1), ""))
    cap = block.find("figcaption")
    if cap and out and not out[0][1]:
        out[0] = (out[0][0], cap.get_text(" ", strip=True))
    return out


LABELS = {"ingredients", "you'll need", "you will need", "materials", "supplies", "instructions", "directions",
          "method", "steps", "notes", "variations", "the spell", "the ritual", "the spread", "closing", "preparation",
          "what you'll need", "what you need", "tools", "correspondences", "how to use it", "how to use"}


def looks_heading(line: str) -> bool:
    t = line.strip().strip("*").strip()
    if "**" in t or "](" in t:  # "**Date:** March 29" is a field, not a heading
        return False
    if t.rstrip(":").lower().replace("\u2019", "'") in LABELS:
        return True
    if t.endswith(":") and len(t.split()) == 1:  # a lone "Location:" field with nothing after it
        return False
    if not t or len(t) > 60 or t.endswith((".", "?", "!", ",", ";")) or t.startswith(("“", '"', "-", "(")):
        return False
    words = t.rstrip(":").split()
    if len(words) < 2 and not line.strip().startswith("**"):
        return False
    if not 1 <= len(words) <= 8:
        return False
    if t.endswith(":"):
        return True
    caps = sum(w[:1].isupper() for w in words if len(w) > 3)
    return caps >= max(1, len([w for w in words if len(w) > 3]) - 1) and line.strip().startswith("**")


def convert(html: str, slug: str, site: Path, http: httpx.Client) -> dict:
    s = BeautifulSoup(html, "html.parser")
    ld = json.loads(s.find("script", type="application/ld+json").string)
    title = htmlmod.unescape(norm(ld["headline"])).strip()
    date = ld["datePublished"][:10]
    modified = (ld.get("dateModified") or "")[:10]
    body_root = s.find("section", attrs={"data-hook": "post-description"}).find("div", class_="pCgbR")
    blocks = [b for b in body_root.children if isinstance(b, Tag)]
    md: list[str] = []
    imgs: list[tuple[str, str, str]] = []  # (site path, alt, media id)
    n_img = 0
    for b in blocks:
        typ = b.get("type")
        if typ:  # the marker siblings ('paragraph', 'image'...) carry no content
            continue
        if b.find("figure") or b.find(attrs={"data-hook": re.compile("gallery|image-viewer")}):
            for mid, alt in images_in(b):
                n_img += 1
                path = f"assets/img/uploads/wix-{slugify(slug, 40)}-{n_img}.webp"
                if fetch_image(mid, site / path, http):
                    imgs.append(("/" + path, alt, mid))
                    md.append(f"![{alt or title}](/{path})")
            continue
        if b.find(["ul", "ol"]):
            for li in b.find_all("li"):
                t = inline(li).strip()
                if t:
                    md.append(("1. " if li.parent.name == "ol" else "- ") + t)
            continue
        p = b.find("p")
        if p is None:
            if b.get_text(strip=True) == "":
                md.append("")  # an empty line block: paragraph break
            continue
        t = inline(p).strip()
        md.append(t if t else "")
    return {"title": title, "date": date, "modified": modified, "lines": md, "images": imgs, "ld": ld}


def verses(lines: list[str]) -> list[str]:
    """Runs of short lines that open with a quote mark and end with a closing one become one blockquote (a chant)."""
    out, i = [], 0
    while i < len(lines):
        x = lines[i].strip("*").lstrip()
        if x.startswith(("“", '"')) and len(lines[i]) <= 90:
            j = i
            while j < len(lines) and j - i < 16:
                y = lines[j].rstrip("*").rstrip()
                if y.endswith(("”", '"', "”.", '".', '!"', "!”")) and j > i:
                    break
                if len(lines[j]) > 120:
                    j = -1
                    break
                j += 1
            if j > i and j < len(lines):
                out.append("> " + "  \n> ".join(lines[i : j + 1]))
                i = j + 1
                continue
        out.append(lines[i])
        i += 1
    return out


def join_chants(groups: list[list[str]]) -> list[list[str]]:
    """A chant split over several short groups (Wix blank lines between stanzas): an opening-quote line, then short
    lines, until a closing-quote line. Merge those groups into one so verses() turns the whole chant into a quote."""
    def opens(x: str) -> bool:
        f = x.strip("*").lstrip()
        return f.startswith(("\u201c", '"')) and not closes(x)

    def closes(x: str) -> bool:
        return x.rstrip("*").rstrip().endswith(("\u201d", '"', '".', "\u201d.", '!"', "!\u201d"))

    out: list[list[str]] = []
    i = 0
    while i < len(groups):
        g = groups[i]
        if opens(g[0]) and all(len(x) <= 90 for x in g) and not any(closes(x) for x in g):
            j, acc = i + 1, list(g)
            while j < len(groups) and j - i < 12 and all(len(x) <= 90 for x in groups[j]):
                acc.extend(groups[j])
                if any(closes(x) for x in groups[j]):
                    break
                j += 1
            if j < len(groups) and any(closes(x) for x in groups[j]):
                out.append(acc)
                i = j + 1
                continue
        out.append(g)
        i += 1
    return out


def is_label(line: str) -> bool:
    if line.strip().strip("*").strip().endswith(":") and len(line.split()) == 1 and line.strip().strip("*").strip().rstrip(":").lower() not in LABELS:
        return False
    return line.strip().strip("*").strip().rstrip(":").lower().replace("\u2019", "'") in LABELS


def is_bold_heading(line: str) -> bool:
    """A whole line in bold, short, no sentence ending: the author's heading."""
    s = line.strip()
    if not (s.startswith("**") and s.endswith("**")) or s.count("**") != 2:
        return False
    core = s[2:-2].strip()
    if core.endswith(":") and len(core.split()) == 1:  # an empty "Location:" field
        return False
    return 0 < len(core) <= 70 and not core.endswith((".", ",", ";")) and len(core.split()) <= 10


FIELD_SPLIT = re.compile(r"\s+(?=\*\*(?:Dates?|Location|Description|When|Where|Website):\*\*)")


def unpack_fields(lines: list[str]) -> list[str]:
    """Wix posts sometimes pack a whole listing into one paragraph; give each field its own line."""
    out: list[str] = []
    for ln in lines:
        parts = FIELD_SPLIT.split(ln) if ln.count(":**") >= 2 else [ln]
        if len(parts) > 1 and is_bold_heading(parts[0]):
            out.append(parts[0])  # the listing's name
            out.extend(parts[1:])
        else:
            out.extend(parts)
    return out


def tidy(lines: list[str]) -> str:
    """Join Wix's one-paragraph-per-line structure into readable Markdown: headings, lists, verse, paragraphs."""
    out: list[str] = []
    lines = unpack_fields(lines)
    # group runs of non-empty lines separated by empty-line blocks
    groups: list[list[str]] = [[]]
    for ln in lines:
        if ln == "":
            if groups[-1]:
                groups.append([])
        else:
            groups[-1].append(ln)
    groups = [g for g in groups if g]
    groups = join_chants(groups)
    # split groups at standalone bold short lines (Wix authors bold a line to make a heading)
    split: list[list[str]] = []
    for g in groups:
        cur: list[str] = []
        for x in g:
            if (is_bold_heading(x) or is_label(x)) and cur and not (len(cur) == 1 and (is_bold_heading(cur[0]) or looks_heading(cur[0]))):
                split.append(cur)
                cur = []
            cur.append(x)
        split.append(cur)
    for g in split:
        i = 0
        # a heading-looking first line
        while i < len(g) and (((i < len(g) - 1) and looks_heading(g[i])) or is_bold_heading(g[i]) or is_label(g[i])) and not g[i].startswith(("- ", "1. ", "![", "> ")):
            out.append(("### " if i and is_label(g[i]) else "## ") + g[i].strip().strip("*").strip().rstrip(":"))
            i += 1
        rest = g[i:]
        if not rest:
            continue
        if all(x.startswith("![") for x in rest):
            out.extend(rest)
            continue
        if all(x.startswith(("- ", "1. ")) for x in rest):
            out.append("\n".join(rest))
            continue
        short = [x for x in rest if not x.startswith("![")]
        is_list = (len(short) >= 3 and all(len(x) <= 90 and not x.rstrip("*").endswith(".") for x in short)
                   and not any(x.startswith("**") and ":**" in x for x in short))  # "**Date:** ..." fields stay lines
        # under an ingredients/components label: the leading run of item-like lines is a list, the rest prose
        label = out[-1].lstrip("#").strip().lower() if out and out[-1].startswith("#") else ""
        if not is_list and (label.rstrip(":").replace("\u2019", "'") in LABELS or "component" in label or "ingredient" in label):
            k = 0
            while k < len(rest) and (rest[k].startswith("![") or re.match(r"^\*[^*]{2,40}\*\s*[-–]?|^\*[^*]{2,40}[-–]\s*\*", rest[k]) or (len(rest[k]) <= 200 and not rest[k].startswith(("- ", "> ")))
                                     and not (rest[k].rstrip("*").rstrip().endswith((".", ":")) and len(rest[k]) < 60) or rest[k].startswith("(")):
                k += 1
            items = [x for x in rest[:k] if not x.startswith("![") and not x.startswith("(")]
            if len(items) >= 2:
                pics = [x for x in rest[:k] if x.startswith("![")]
                notes = [x for x in rest[:k] if x.startswith("(")]
                out.append("\n".join("- " + x for x in items))
                out.extend(notes + pics)
                rest = rest[k:]
                if not rest:
                    continue
                short = [x for x in rest if not x.startswith("![")]
        is_verse = False
        rest = verses(rest)
        buf: list[str] = []
        for x in rest:
            if x.startswith("!["):
                if buf:
                    out.append("\n".join(buf) if (is_list or is_verse) else "\n\n".join(buf))
                    buf = []
                out.append(x)
                continue
            if is_list and not x.startswith(("- ", "1. ", "> ")):
                x = "- " + x
            buf.append(x)
        if buf:
            if is_verse:
                out.append("> " + "  \n> ".join(buf))
            elif is_list:
                out.append("\n".join(buf))
            else:
                out.append("\n\n".join(buf))
    md = "\n\n".join(out)
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    return md


def lead_of(body: str) -> str:
    """First real paragraph (not a heading, list, quote or picture), trimmed to about 32 words."""
    for para in body.split("\n\n"):
        if para.startswith(("#", "- ", "> ", "![", "1. ")) or len(para.split()) < 12:
            continue
        return excerpt_of(para, 32)
    return excerpt_of(body, 32)


def same_picture(a: Path, b: Path) -> bool:
    """Two downloaded images show the same photo (Wix re-uploads give new ids): compare 16x16 grey thumbnails."""
    try:
        ia = Image.open(a).convert("L").resize((16, 16))
        ib = Image.open(b).convert("L").resize((16, 16))
    except OSError:
        return False
    diff = sum(abs(x - y) for x, y in zip(ia.getdata(), ib.getdata(), strict=True)) / 256
    return diff < 6


CONTAIN = {"pythagorean-numerology", "balefire-tarot-spread", "spiritual-growth-spread-by-lalania-simone",
           "the-seed-a-tarot-spread-for-ostara-spring-by-tarot-dreams-tumblr", "ancestral-roots-meditation-to-connect-with-an-unknown-ancestor"}


def categories(slug: str) -> list[str]:
    return CATS.get(slug, ["Life"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default=str(Path.home() / "Projects/backonthebroomstick"))
    ap.add_argument("--html", default="/tmp/botb_bg/wix")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    site, src = Path(a.site).expanduser(), Path(a.html)
    items = json.loads((src / "items.json").read_text())
    http = httpx.Client(timeout=60)
    report = []
    for it in items:
        slug = it["link"].rsplit("/", 1)[1]
        page = src / f"{slug}.html"
        if not page.exists():
            r = http.get(it["link"], headers=UA, follow_redirects=True)
            page.write_text(r.text)
            time.sleep(1.5)
        d = convert(page.read_text(encoding="utf-8", errors="replace"), slug, site, http)
        body = tidy(d["lines"])
        cover, cover_alt = "", ""
        if d["images"]:
            cover, cover_alt = d["images"][0][0], d["images"][0][1] or d["title"]
            # the first picture becomes the cover; drop it from the body if it opens the post
            first = f"![{d['images'][0][1] or d['title']}]({cover})"
            if body.startswith(first):
                body = body[len(first) :].lstrip()
        # Wix posts often show the same photo twice (as the cover and again inline): keep the first appearance only
        seen_ids: dict[str, str] = {}
        for path, _alt, mid in d["images"]:
            if mid in seen_ids or any(same_picture(site / path.lstrip("/"), site / q.lstrip("/")) for q in seen_ids.values()):
                body = re.sub(r"\n*!\[[^\]]*\]\(" + re.escape(path) + r"\)\n*", "\n\n", body).strip()
                (site / path.lstrip("/")).unlink(missing_ok=True)
                continue
            seen_ids[mid] = path
        if cover and f"]({cover})" in body:
            body = re.sub(r"\n*!\[[^\]]*\]\(" + re.escape(cover) + r"\)\n*", "\n\n", body).strip()
        body = check_body(body)
        ascii_title = unicodedata.normalize("NFKC", d["title"]).replace("\u201c", '"').replace("\u201d", '"').replace("\u2019", "'")
        fm = {
            "layout": "post",
            "title": ascii_title,
            "date": d["date"],
            "author": "Laylla & Chelle",
            "summary": lead_of(body),
            "description": lead_of(body),
        }
        if cover:
            fm.update(cover=cover, cover_alt=cover_alt, image=cover)
            with Image.open(site / cover.lstrip("/")) as im:
                w, h = im.size
            if slug in CONTAIN or w / h < 1.2:  # portrait photos and charts show whole, not cropped to 16:9
                fm["cover_fit"] = "contain"
        fm["categories"] = categories(slug)
        fm["imported_from"] = it["link"]
        name = f"_posts/{d['date']}-{slugify(slug)}.md"  # same slug as the Wix URL
        text = "---\n" + yaml.safe_dump(fm, sort_keys=False, allow_unicode=True, width=1000) + "---\n" + body + "\n"
        if not a.dry_run:
            (site / "_posts").mkdir(exist_ok=True)
            (site / name).write_text(text)
        report.append((name, len(body.split()), len(d["images"]), fm["categories"]))
        print(f"{name}  {len(body.split())} words, {len(d['images'])} images, {fm['categories']}")
    print(f"{len(report)} posts")


if __name__ == "__main__":
    main()
