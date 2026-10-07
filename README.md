# Back on the Broomstick

The website for **Back on the Broomstick**, the weekly podcast where Laylla and Chelle talk modern witchcraft, pagan
practice and tarot, plus its predecessor **The Stoned Witches Hour**.

Live: https://charles-forsyth.github.io/backonthebroomstick/

## What's on it

- **Home**: tonight's moon, days to the next sabbat, the card of the day, the newest episode with a player, recent
  episodes, Ask the Archive, the Wheel, a three-card draw, the witches, readings, the shop, community links.
- **Episodes** (`/episodes/`): every episode of both shows, searchable by title, show notes and guest, filterable by
  show. Each episode has its own page with a player, notes, guests and links.
- **Ask the Archive** (`/ask/`): plain-language search. Today it searches titles and show notes in the browser. When
  the archive service is deployed (set `links.archive_api` in `_config.yml`) it searches every word of every transcript
  and links to the exact moment.
- **The Wheel** (`/wheel/`), **Draw a Card** (`/tarot/`), **The Witches** (`/witches/`), **Readings** (`/readings/`),
  **Shop** (`/shop/`, Etsy until the new shop opens).

## How it is built

Plain Jekyll on GitHub Pages, one theme (Midnight Grimoire) in `assets/css/grimoire.css`, no build tools.
Episode data is generated, not hand-edited:

```bash
cd ~/Projects/Back_on_the_Broomstick/archive
uv run botbs update          # new episodes from the feeds and YouTube
uv run botbs site-export     # writes _data/*.json and episodes/*.md into this repo
```

Then commit and open a PR here. CI builds the site with the GitHub Pages gems and runs `tools/check_site.py` (links,
leftover template code, secrets, data sanity).

Local preview:

```bash
bundle exec jekyll serve      # http://127.0.0.1:4000/backonthebroomstick/
```

See `docs/SPEC.md` for the full design.

## Credits

Tarot images: the public-domain Rider-Waite-Smith deck (Pamela Colman Smith, 1909). Episode text and audio belong to
Back on the Broomstick.
