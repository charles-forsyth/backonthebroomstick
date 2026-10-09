# Back on the Broomstick

The website for **Back on the Broomstick**, the weekly podcast where Laylla and Chelle talk modern witchcraft, pagan
practice and tarot, plus its predecessor **The Stoned Witches Hour**.

This is the **dev site**: https://charles-forsyth.github.io/backonthebroomstick/

The hosts' real site is **backonthebroomstick.com** (Wix). Nothing here touches it, and it stays live and
authoritative until the hosts choose to switch. The dev site is marked noindex and has no sitemap, so search
engines leave it alone.

## What's on it

The top menu groups the pages: **Listen** (Episodes, Ask the Archive), **Explore** (The Wheel, Draw a Card, The
Grimoire), **Book a Reading**, **About** (Laylla & Chelle, Press), **Shop** and **Support**.

- **Home**: tonight's moon, days to the next sabbat, the card of the day, the newest episode with a player, recent
  episodes, the 3 newest Grimoire posts, Ask the Archive, the Wheel, a three-card draw, the witches, readings, the
  shop, community links.
- **Episodes** (`/episodes/`): every episode of both shows, searchable by title, show notes and guest, filterable by
  show. Each episode has its own page with a player, notes, guests, links, a fan-mail link and any Grimoire posts
  about it.
- **Ask the Archive** (`/ask/`): plain-language search over every word of every transcript, linking to the exact
  moment, served by the archive service (`archive_api` in `_data/links.yml`). Without that key it falls back to
  titles and show notes in the browser.
- **The Grimoire** (`/blog/`): the hosts' blog, with search, category chips and an Atom feed (`/blog/feed.xml`). It
  includes their 13 posts imported from the Wix site.
- **The Wheel** (`/wheel/`), **Draw a Card** (`/tarot/`), **The Witches** (`/witches/`), **Readings** (`/readings/`).
- **Shop** (`/shop/`): links out to Etsy until the hosts' own shop opens. The page and home panel switch on their own
  when `open` and `url` are set in `_data/shop.yml`.
- **Press** (`/press/`): the press kit for sponsors and partners. Every figure carries its source and date.

## Who edits what

The hosts edit the site without touching git. They use the **Studio** on the archive service (the "Studio sign-in"
link in the footer; it has a light look and its own Studio bar, so it is never mistaken for the public site) or
ChatGPT/Claude through its MCP tools. Those edits are commits by the service, and only to:

- `_data/{about,announcement,episode_extras,events,links,offers,press,shop,witches}.yml`
- `assets/img/uploads/` (resized photos)
- `_posts/` (Grimoire posts)

New episodes are published automatically after each weekly refresh. Code, layouts and the theme change only through
pull requests here.

## How it is built

Plain Jekyll on GitHub Pages, one theme (Midnight Grimoire) in `assets/css/grimoire.css`, no build tools.
Episode data is generated, not hand-edited:

```bash
cd ~/Projects/Back_on_the_Broomstick/archive
uv run botbs update          # new episodes from the feeds and YouTube
uv run botbs site-export     # writes _data/*.json and episodes/*.md into this repo
```

Then commit and open a PR here. CI builds the site with the GitHub Pages gems and runs `tools/check_site.py`. It
fails on broken internal links, leftover template code, secrets, bad episode data, inline event handlers or script
URLs (so host-edited text can never run code), and episode notes ending in a bare "Got a question?".

Local build and check:

```bash
bundle exec jekyll build -d /tmp/botbsite && python3 tools/check_site.py /tmp/botbsite
bundle exec jekyll serve      # preview at http://127.0.0.1:4000/backonthebroomstick/
```

GitHub Pages caches pages for up to 10 minutes, so a change can take that long to show.

See `docs/SPEC.md` for the full design. The archive service has its own spec in the `botbs-archive` repo.

## Credits

Tarot images: the public-domain Rider-Waite-Smith deck (Pamela Colman Smith, 1909). Episode text and audio belong to
Back on the Broomstick.
