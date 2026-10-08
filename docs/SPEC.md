# Back on the Broomstick website: specification

Version 0.9 (2026-10-08). Owner: Chuck Forsyth, for Laylla and Chelle.


> Naming (Chuck, 2026-10-07): the GitHub Pages site is the **dev site**. The hosts' **real site** is backonthebroomstick.com (Wix); nothing in these repos or services touches it. Only call ours the real site if the hosts ever switch over.

## 1. Purpose

A professional home for the podcast that shows fans and customers what the show is, lets them listen, find any
episode, play with the Wheel and the cards, book readings and support the show. It is meant to be good enough that the
hosts choose to move off their current Wix site (backonthebroomstick.com), which stays live and authoritative until
they decide.

## 2. Principles

- Content from the current site, style from Nordhaven's tooling, theme of its own (Midnight Grimoire).
- Episode facts come from the archive, never typed by hand. `botbs site-export` writes them.
- Public facts only: titles, dates, show notes, guest names, links. No transcripts on the static site, no keys.
- Static and free to host. The only paid part is the Ask the Archive service, which is separate (section 7).
- Works without JavaScript for reading (episode lists and pages are plain HTML); JS adds search, the wheel, the sky,
  the cards.
- Phone first: nothing scrolls sideways at 400 px.

## 3. Pages

| URL | What |
| --- | --- |
| `/` | Hero + tonight's sky, newest episode with player, 6 recent, Ask, Wheel, Draw, sabbat/this-week/card panels, witches + guests, readings, community |
| `/episodes/` | All episodes; search (title, notes, guests), show filter; state in `?q=` and `?show=` |
| `/episodes/<slug>/` | One episode: kicker (show, number, date, minutes), title, player, YouTube/Apple/Spotify, guests, notes, sabbat link, "Got a question for the witches?" fan-mail link (`links.fan_mail`, hidden when empty), Ask CTA |
| `/ask/` | Ask the Archive; `?q=` runs a query on load |
| `/wheel/` | Wheel of the Year with episode counts; `#samhain` selects a sabbat; opens on the next one |
| `/tarot/` | Today's card, 3-card and 1-card draws |
| `/witches/` | Hosts, story, podcast history, guests with their episodes, Crystal City Circle |
| `/readings/` | The five reading offers; booking goes to the current Wix booking page |
| `/shop/` | Categories and notice from `shop.yml`. Closed: kicker "Coming soon", coming-soon lead, Etsy button. Open (`open: true` and a `url`): kicker/lead switch to the `kicker_open`/`lead_open` front matter, button goes to the shop. The home page shop panel follows the same switch |
| `/blog/` | The Grimoire (the witches' blog): newest post as a feature card, then the rest as cards (cover or sigil art); search over titles, summaries, tags and full text with highlighted snippets; category chips; state in `?q=` and `?cat=`; archive by year once there are more than 6; Atom feed at `/blog/feed.xml` |
| `/blog/<slug>/` | One post: category kicker, title, author, date (and updated), reading time, cover, Markdown body with drop cap, tags (link to a search), Listen cards for linked episodes (title, date, player), Share (phones) and Copy link, older/newer, up to 3 related posts by category |
| `/press/` | Press kit for sponsors and press: chart positions, ratings, downloads (when supplied), catalog facts, sponsor packages, past partners; every figure links its source and carries an as-of date; prints to a clean white PDF (Save as PDF) |

## 4. Data (`_data/`, generated)

`episodes.json`: one object per feed episode (deduped by Buzzsprout GUID), newest first:
`slug, show (botbs|swh), number, title (number stripped), full_title, date (YYYY-MM-DD aired), minutes, notes, audio
(Buzzsprout MP3), youtube (id or null), buzzsprout (id), sabbat (name or null, from the title), guests [names]`.
Notes are plain text without the feed's shared sign-off (fan-mail link, support link, PO Box); the episode page adds
the fan-mail link itself.


`stats.json`: `episodes, botbs, swh, hours, words, guests, latest`.
`guests.json`: `[{name, episodes: [slug]}]`. Guests come from titles ("... with Judika Illes") and transcript speaker
labels confirmed by a full name in the title or notes.

`assets/js/episodes.json` is the same list, emitted by Jekyll for the browser.

Episode pages `episodes/<slug>.md` hold only front matter (layout, slug, title, permalink); the layout looks the
episode up by slug. Slugs are stable: `<number>-<title words>`, `swh-` prefix for the old show.

## 4.1 Host-editable content (`_data/*.yml`)

Laylla and Chelle edit these through the archive service (Studio > Edit site, or ChatGPT with the connector); nobody
needs to touch the repo. The service can write ONLY these files plus resized photos in `assets/img/uploads/`,
validates every value (plain text, https links, real dates, whole-dollar prices), shows a plain-words preview, and
commits with the editor's name. Every change is undoable from the Studio (unless the same file changed again
since; then the undo is refused rather than wiping the later edit).

Escaping: templates print every value from these files, and every episode/guest field from the generated data, with
`| escape` (links too, inside `href="..."`; the API base in `window.BOTB` with `| jsonify`), on top of the service's
validation (no `<` or `>` at all, `https://` links only, a strict email pattern). The site has no inline event
handlers; buttons are wired in `botb.js` (e.g. Press "Save as PDF" is `data-print`).

| File | Holds |
| --- | --- |
| `offers.yml` | readings: name, price, length, blurb, featured, available, booked_up |
| `links.yml` | booking, shop, socials, email, support, Spotify show page, `fan_mail` (Buzzsprout fan mail form, optional); `feed`, `feed_swh`, `archive_api` are locked |
| `announcement.yml` | banner text, link, last day shown (also hidden in the browser after that day) |
| `events.yml` | upcoming events; past ones hide at build and in the browser |
| `witches.yml` | names, initials, bios, photo paths |
| `about.yml` | Our story, The podcast, Crystal City Circle (plain text, blank line = new paragraph) |
| `shop.yml` | open switch, own shop url, notice, categories; `open` + `url` also switch the home panel and shop page copy |
| `episode_extras.yml` | per-episode note; one featured episode on the home page |
| `press.yml` | Press page: as-of date, headline, charts, audience, downloads (empty rows hidden), lists, packages (empty price shows "Ask us"), past partners. Charts move daily; re-check before a pitch. Research and quotes behind each figure: `strategy/research/2026-10-07_BotB_Rankings_and_Reach.md` in the archive project |

## 4.2 Blog posts (`_posts/`)

One Markdown file per post, `_posts/YYYY-MM-DD-<slug>.md`, written only by the archive service (Studio > Blog, or
the `blog_*` MCP tools from ChatGPT/Claude). Front matter: `layout: post`, `title`, `date`, `author`, optional
`summary` (list cards, link previews; mirrored to `description`), `cover` + `cover_alt` (an upload under
`assets/img/uploads/`; mirrored to `image` for link previews), `categories` (up to 3), `tags` (up to 10),
`episodes` (episode slugs, shown as Listen cards), `updated`, `draft_id`. Permalink `/blog/:title/` from the file
name, so the address never changes when the title is edited. Bodies are checked by the service: no HTML, Liquid or
kramdown attribute lists; links are https:// or site pages written from the root (`/episodes/...`, which the post
layout prefixes with the base path); pictures only from uploads. Drafts never reach this repo. Episode pages list
the posts that link them ("In the Grimoire"); the home page shows the 3 newest posts once there is one.

New episode pages and `_data/episodes|stats|guests.json` are committed automatically by the archive service after
each refresh (never deletes pages).

## 4.3 Imported Wix posts

`tools/import_wix_blog.py` (one-off; run with `uv run --no-project --with beautifulsoup4 --with pillow --with pyyaml
--with httpx --with markdown-it-py python tools/import_wix_blog.py`) copied the 13 posts from
backonthebroomstick.com/blog on 2026-10-08. It reads each post page's server-rendered text (the Wix feed has only
excerpts), keeps the Wix slug, date and title, and turns the one-paragraph-per-line Wix layout into Markdown: bold lines
and labels (Ingredients, You'll Need, Instructions...) become headings, item runs under them become lists, quoted chants
become blockquotes, packed listing fields get their own lines. Pictures are downloaded full size, saved as 1200 px WebP
(`assets/img/uploads/wix-<slug>-<n>.webp`, metadata dropped), the first becomes the cover and repeats are dropped.
Portrait photos, charts and card spreads get `cover_fit: contain` so they show whole. Each post records
`imported_from:` (its Wix URL); categories were picked by reading each post. Bodies pass the archive's `check_body`, so
the hosts can edit or take down any of them through the blog tools like their own new posts.

## 5. Visual design (Midnight Grimoire)

Tokens in the `:root` block of `assets/css/grimoire.css`:

| Token | Value | Use |
| --- | --- | --- |
| `--bg` / `--bg2` / `--panel` | `#120d1a` / `#19122a` / `#211735` | Page, alternate bands, cards |
| `--line` | `#3a2a55` | Hairlines |
| `--text` / `--muted` | `#eee4d3` / `#b0a3bf` | Body, secondary |
| `--accent` | `#d9a74a` | Candle gold: kickers, buttons, links |
| `--accent2` | `#a67fd8` | Amethyst: SWH tags, glows |

Type: Cinzel (h1), Cormorant Garamond (display), EB Garamond (body), JetBrains Mono (kickers, labels). Motifs: starfield
hero, broom-pentacle sigil (header, footer, favicon; faint pencil version behind the home hero), kickers with a four-point star, gold top rule on panels.

The Ask the Archive service (Cloud Run) uses the same stylesheet and tokens so the two read as one site.

## 6. Behaviour (`assets/js/`)

- `sky.js` (pure, no DOM): moon phase from a reference new moon (good to a few hours), next sabbat from fixed dates,
  card of the day (`(dayNumber * 7) mod 22`, same for everyone that day). Shared with the archive service.
- `botb.js`: sky widgets, draws (25% reversed), wheel (SVG, counts, panel, hash), episode browser (show chips,
  `?show=` / `?q=`, clearing the search restores the full list), blog browser (search + category chips, `?q=` /
  `?cat=`), Ask, share, menu, print button, reveal. Each feature has its own state; none reads another's variables.

## 7. Ask the Archive service (separate, Cloud Run `botb-mcp`)

Live at https://botb-mcp-dsfh6rrlia-uc.a.run.app (source and full spec: `Back_on_the_Broomstick/archive`,
`docs/SPEC.md`). Same Midnight Grimoire theme (`grimoire.css` copied from this repo).

Public: archive search (`/api/search?q=`, rate limited per visitor plus a daily cap), insights charts
(`/insights`), and episode pages with full transcripts. Private (three logins: Chuck, Laylla, Chelle): the Studio
(answers with citations, "check for new episodes") and the MCP endpoint for Hermes, ChatGPT and Claude. The service
checks the feeds itself every Friday 7pm and Saturday 9am Eastern.

`links.archive_api` points at the service, so `/ask/` searches every word of every transcript.

## 8. Build, check, ship

- Local: `bundle exec jekyll build -d /tmp/botbsite && python3 tools/check_site.py /tmp/botbsite`.
- `check_site.py` fails on: broken internal links, raw Liquid, secrets, bad episode data, and (since 0.8) any inline
  event-handler attribute (`on[a-z]+=` in a tag) or a `javascript:`/`vbscript:`/`data:text/html` URL in
  `href`/`src`/`action`/`formaction`/`poster` (checked after decoding entities and dropping whitespace), and (since
  0.9) episode notes ending in a bare "Got a question?" (the fan-mail link text cut in half).
- CI (`.github/workflows/check.yml`): the same two steps on every PR and push to main.
- Changes go through a branch and PR; merge when Check is green. Pages deploys main.

## 9. Open items

| # | Item |
| --- | --- |
| W-1 | Real photos of Laylla and Chelle (portraits are initials for now) |
| W-2 | Link Insights from the nav |
| W-3 | Own booking and shop when the hosts move off Wix (today: links out) |
| W-4 | Custom domain if the hosts adopt the site (backonthebroomstick.com) |
| W-5 | Newsletter ("Wheel of the Year Newsletter") once they pick a provider |
| W-6 | Done 2026-10-08: the blog (The Grimoire, 4.2), and all 13 Wix posts (Sep 2023 to May 2026) imported with their 23 pictures (4.3) |
| W-7 | Done 2026-10-07: new episodes publish automatically; hosts edit content (4.1) |
| W-8 | Press kit: fill Buzzsprout downloads and package prices with the hosts; source for any "#1 pagan podcast" claim (none found in public rankings on 2026-10-07; Apple Spirituality chart is the verifiable claim) |
| W-9 | Real video on YouTube (today: audio over a still image from the feed) |
| W-10 | Search engines: the dev site and botb-mcp are noindex (meta tag here; header + robots.txt on botb-mcp; no sitemap) until the hosts adopt the site as their main one. Remove all three together on their say-so |

## 10. Change log

| Version | Date | Change |
| --- | --- | --- |
| 0.9 | 2026-10-08 | Review phase 2: Spotify links go to the real show page (was a Spotify search); shop kicker/lead and the home shop panel follow `shop.yml` `open` + `url` instead of hard-coded "coming soon"; episode pages link fan mail (`links.fan_mail`) and the 212 notes that ended in a bare "Got a question?" were regenerated without it (archive 0.12.1); `check_site.py` refuses that orphan (8) |
| 0.8 | 2026-10-08 | Review fixes: the episode browser threw `cat is not defined` on every load (lines pasted from the blog code in 0.6), breaking the show chips, `?show=swh` and clearing the search; restored. Every host-editable and episode value printed with `\| escape`; Press "Save as PDF" no longer an inline `onclick`; `check_site.py` refuses inline event handlers and script URLs (8) |
| 0.7 | 2026-10-08 | Imported the 13 Wix blog posts and 23 pictures (4.3); covers that must show whole (`cover_fit: contain`); in-post pictures capped at screen height |
| 0.6 | 2026-10-08 | The Grimoire blog: `/blog/`, post layout, search/filter, Atom feed, home band, episode back-links (4.2); nav Grimoire; broom-pentacle sigil and favicon; full-retranscribe data export |
| 0.5 | 2026-10-07 | Dev site naming, press kit, host editing, noindex |
