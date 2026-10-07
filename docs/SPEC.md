# Back on the Broomstick website: specification

Version 0.3 (2026-10-07). Owner: Chuck Forsyth, for Laylla and Chelle.


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
| `/episodes/<slug>/` | One episode: kicker (show, number, date, minutes), title, player, YouTube/Apple/Spotify, guests, notes, sabbat link, Ask CTA |
| `/ask/` | Ask the Archive; `?q=` runs a query on load |
| `/wheel/` | Wheel of the Year with episode counts; `#samhain` selects a sabbat; opens on the next one |
| `/tarot/` | Today's card, 3-card and 1-card draws |
| `/witches/` | Hosts, story, podcast history, guests with their episodes, Crystal City Circle |
| `/readings/` | The five reading offers; booking goes to the current Wix booking page |
| `/shop/` | Coming-soon placeholder, links to Etsy |

## 4. Data (`_data/`, generated)

`episodes.json`: one object per feed episode (deduped by Buzzsprout GUID), newest first:
`slug, show (botbs|swh), number, title (number stripped), full_title, date (YYYY-MM-DD aired), minutes, notes, audio
(Buzzsprout MP3), youtube (id or null), buzzsprout (id), sabbat (name or null, from the title), guests [names]`.

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
commits with the editor's name. Every change is undoable from the Studio.

| File | Holds |
| --- | --- |
| `offers.yml` | readings: name, price, length, blurb, featured, available, booked_up |
| `links.yml` | booking, shop, socials, email, support; `feed`, `feed_swh`, `archive_api` are locked |
| `announcement.yml` | banner text, link, last day shown (also hidden in the browser after that day) |
| `events.yml` | upcoming events; past ones hide at build and in the browser |
| `witches.yml` | names, initials, bios, photo paths |
| `about.yml` | Our story, The podcast, Crystal City Circle (plain text, blank line = new paragraph) |
| `shop.yml` | open switch, own shop url, notice, categories |
| `episode_extras.yml` | per-episode note; one featured episode on the home page |

New episode pages and `_data/episodes|stats|guests.json` are committed automatically by the archive service after
each refresh (never deletes pages).

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
hero, crescent moon sigil, kickers with a four-point star, gold top rule on panels.

The Ask the Archive service (Cloud Run) uses the same stylesheet and tokens so the two read as one site.

## 6. Behaviour (`assets/js/`)

- `sky.js` (pure, no DOM): moon phase from a reference new moon (good to a few hours), next sabbat from fixed dates,
  card of the day (`(dayNumber * 7) mod 22`, same for everyone that day). Shared with the archive service.
- `botb.js`: sky widgets, draws (25% reversed), wheel (SVG, counts, panel, hash), episode browser, Ask, menu, reveal.

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
| W-6 | Their blog ("Musings") is not mirrored; link or import if they want |
| W-7 | Done 2026-10-07: new episodes publish automatically; hosts edit content (4.1) |
