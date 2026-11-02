#!/usr/bin/env python3
"""Build the Sky page's data files from the same sources as the Hedge Almanac app.

Writes assets/data/astro/:
  interpretations.json  the reading library (copied from the app, our own text)
  witches.json          "The witches on this": short transcript moments per topic, linked to episode pages at the second
  places.json           town list for the birth-place search (GeoNames, CC BY 4.0)

Usage (from the repo root):
  python3 tools/astro/build_sky_data.py \
      --index ~/.hermes/cache/scratch/hi.db \
      --app ~/Projects/botb-android/app/src/main/assets/astro \
      --geonames ~/.cache/botbs/astro

--index is the app's offline index (hedge_index.db, gunzipped). Only Back on the Broomstick episodes are quoted.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import zipfile
from pathlib import Path

SIGNS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"]
PAIR_WORDS = ["sun", "moon", "rising", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
              "full moon", "new moon", "eclipse", "retrograde", "node"]
EXTRA_TOPICS = {  # topic key -> FTS query, on top of the app's curated topics
    "jupiter_return": '"jupiter return"', "nodal_return": '"north node"', "void_of_course": '"void of course"',
    "planetary_hours": '"planetary hour"', "tarot": "tarot astrology", "crystals": "crystals astrology",
}
MAX_PER_KEY = 4
SIGN_RE = {s: re.compile(rf"\b{s}\b", re.I) for s in SIGNS}


def near_ok(text: str, sign: str, word: str, span: int = 45) -> bool:
    low = text.lower()
    others = [x for x in SIGNS if x != sign]
    for m in SIGN_RE[sign].finditer(text):
        for w in re.finditer(rf"\b{re.escape(word)}\b", low):
            a, b = sorted((m.start(), w.start()))
            if b - a <= span:
                between = low[a:b + len(word)]
                if not any(re.search(rf"\b{o}\b", between) for o in others):
                    return True
    return False


def tidy(s: str) -> str:
    t = re.sub(r"\s+(Laylla|Chelle|[A-Z][a-z]+):\s*\u2026?$", "\u2026", s.strip())
    lead = ""
    while t.startswith("\u2026"):
        lead += "\u2026"
        t = t[1:]
    t = t.lstrip()
    return lead + (t[:1].upper() + t[1:])


def excerpt(text: str, words: list[str]) -> str:
    """About 260 characters around the first topic word, starting at a sentence or speaker turn when one is near
    (same rules as the app's Astro.excerpt)."""
    lower = text.lower()
    hits = [lower.find(w.replace("_", " ").lower()) for w in words]
    hits = [h for h in hits if h >= 0]
    at = min(hits) if hits else 0
    back = max(0, at - 140)
    seg = text[back:at]
    ms = list(re.finditer(r"(?:[.!?]\s+|\b(?:Laylla|Chelle):\s*)", seg))
    sentence = ms[-1] if ms else None
    if back == 0 and sentence is None:
        start = 0
    elif sentence is not None:
        start = back + sentence.end()
    else:
        sp = seg.find(" ")
        start = back + (sp + 1 if sp >= 0 else 0)
    hard_end = min(start + 280, len(text))
    ends = list(re.finditer(r"[.!?](?=\s|$)", text[start:hard_end]))
    end_sentence = ends[-1].end() - 1 if ends else None
    if hard_end == len(text):
        end = hard_end
    elif end_sentence is not None and end_sentence > 120:
        end = start + end_sentence + 1
    else:
        sp = text.rfind(" ", 0, hard_end)
        end = hard_end if sp <= start else sp
    out = ("\u2026" if start > 0 and sentence is None else "") + text[start:end].strip()
    if end < len(text) and text[end - 1] not in ".!?":
        out += "\u2026"
    return tidy(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", required=True)
    ap.add_argument("--app", required=True)
    ap.add_argument("--geonames", required=True)
    ap.add_argument("--out", default="assets/data/astro")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    app = Path(a.app).expanduser()

    # 1. interpretations (verbatim)
    interp = json.loads((app / "interpretations.json").read_text())
    (out / "interpretations.json").write_text(json.dumps(interp, ensure_ascii=False, separators=(",", ":")))

    # 2. witches
    site_eps = json.loads(Path("_data/episodes.json").read_text())
    slug_by_bz = {str(e["buzzsprout"]): e for e in site_eps if e.get("buzzsprout")}
    db = sqlite3.connect(Path(a.index).expanduser())
    db.row_factory = sqlite3.Row
    eps = {r["ep_key"]: r for r in db.execute("SELECT ep_key, show FROM episodes")}

    def to_quote(row, words: list[str]) -> dict | None:
        ep = eps.get(row["ep_key"])
        if not ep or ep["show"] != "botbs":
            return None
        site = slug_by_bz.get(row["ep_key"].split("-", 1)[-1])
        if not site:
            return None
        return {"s": site["slug"], "t": int(row["start_s"] or 0), "q": excerpt(row["text"], words)}

    def fts(query: str, limit: int = 30) -> list[sqlite3.Row]:
        try:
            return list(db.execute(
                "SELECT p.id, p.ep_key, p.start_s, p.text FROM passages_fts f JOIN passages p ON p.id = f.rowid "
                "WHERE passages_fts MATCH ? ORDER BY bm25(passages_fts) LIMIT ?", (query, limit)))
        except sqlite3.OperationalError:
            return []

    def collect(rows, words: list[str], sign: str | None = None, cap: int = MAX_PER_KEY, near: str | None = None) -> list[dict]:
        res, seen = [], set()
        for r in rows:
            if len(res) >= cap or r["ep_key"] in seen:
                continue
            if sign:
                txt = r["text"]
                if not SIGN_RE[sign].search(txt):
                    continue
                # the sign and the paired word must sit close together, and no other sign may be named in between
                # (keeps lists like "Libra Justice, Scorpio Death ... Pisces the Moon" out)
                if near and not near_ok(txt, sign, near):
                    continue
            q = to_quote(r, words)
            if q and len(q["q"]) > 60:
                res.append(q)
                seen.add(r["ep_key"])
        return res

    witches: dict[str, list[dict]] = {}
    curated = json.loads((app / "astro_passages.json").read_text())["passages"]
    for key, ids in curated.items():
        rows = [db.execute("SELECT id, ep_key, start_s, text FROM passages WHERE id=?", (i,)).fetchone() for i in ids]
        rows = [r for r in rows if r]
        word = key.replace("_", " ")
        rows += fts(f'"{word}"')
        witches["t:" + key] = collect(rows, [word, key.split("_")[0]])
    for key, q in EXTRA_TOPICS.items():
        witches["t:" + key] = collect(fts(q), [key.replace("_", " "), q.strip('"').split()[0]])
    for s in SIGNS:
        for w in PAIR_WORDS:
            rows = fts(f'"{s}" "{w}"' if " " in w else f'"{s}" {w}')
            got = collect(rows, [s, w], sign=s, cap=3, near=w)
            if got:
                witches[f"p:{s}|{w}"] = got
    witches = {k: v for k, v in witches.items() if v}
    (out / "witches.json").write_text(json.dumps(witches, ensure_ascii=False, separators=(",", ":")))

    # 3. places: every town of 15,000+ worldwide, plus US places of 1,000+ (so small towns like Wellsboro are there)
    g = Path(a.geonames).expanduser()
    admin = {}
    for line in (g / "admin1CodesASCII.txt").read_text(encoding="utf-8").splitlines():
        p = line.split("\t")
        if len(p) >= 2:
            admin[p[0]] = p[1]
    countries = {}
    for line in (g / "countryInfo.txt").read_text(encoding="utf-8").splitlines():
        if line.startswith("#"):
            continue
        p = line.split("\t")
        if len(p) > 4:
            countries[p[0]] = p[4]
    rows = {}
    for zname, keep in (("cities15000.zip", lambda p: True), ("cities1000.zip", lambda p: p[8] == "US")):
        with zipfile.ZipFile(g / zname) as z:
            name = z.namelist()[0]
            for line in z.read(name).decode("utf-8").splitlines():
                p = line.split("\t")
                if len(p) < 18 or not keep(p):
                    continue
                rows[p[0]] = p
    tzs: list[str] = []
    tzi: dict[str, int] = {}
    places = []
    for p in sorted(rows.values(), key=lambda p: -int(p[14] or 0)):
        tz = p[17]
        if tz not in tzi:
            tzi[tz] = len(tzs)
            tzs.append(tz)
        region = admin.get(f"{p[8]}.{p[10]}", "")
        places.append([p[1], region, countries.get(p[8], p[8]), round(float(p[4]), 4), round(float(p[5]), 4), tzi[tz]])
    (out / "places.json").write_text(json.dumps({"tz": tzs, "p": places}, ensure_ascii=False, separators=(",", ":")))

    sizes = {f.name: f.stat().st_size for f in out.iterdir()}
    print(json.dumps({"witches_keys": len(witches), "quotes": sum(len(v) for v in witches.values()), "places": len(places), "bytes": sizes}))


if __name__ == "__main__":
    main()
