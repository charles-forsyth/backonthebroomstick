# Back on the Broomstick website: specification

Version 0.13 (2026-11-08). Owner: Chuck Forsyth, for Laylla and Chelle.


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
| `/sky/` | The Sky (section 3.2): 3D sky now, tonight, season ahead, birth chart (2D/3D wheel) and full reading with the witches' quotes, sign pages, compatibility, sky finder |
| `/tarot/` | Today's card, 3-card and 1-card draws |
| `/witches/` | Hosts, story, podcast history, guests with their episodes, Crystal City Circle |
| `/readings/` | The five reading offers; booking goes to the current Wix booking page |
| `/shop/` | Categories and notice from `shop.yml`. Closed: kicker "Coming soon", coming-soon lead, Etsy button. Open (`open: true` and a `url`): kicker/lead switch to the `kicker_open`/`lead_open` front matter, button goes to the shop. The home page shop panel follows the same switch |
| `/blog/` | The Grimoire (the witches' blog): newest post as a feature card, then the rest as cards (cover or sigil art); search over titles, summaries, tags and full text with highlighted snippets; category chips; state in `?q=` and `?cat=`; archive by year once there are more than 6; Atom feed at `/blog/feed.xml` |
| `/blog/<slug>/` | One post: category kicker, title, author, date (and updated), reading time, cover, Markdown body with drop cap, tags (link to a search), Listen cards for linked episodes (title, date, player), Share (phones) and Copy link, older/newer, up to 3 related posts by category |
| `/press/` | Press kit for sponsors and press: chart positions, ratings, downloads (when supplied), catalog facts, sponsor packages, past partners; every figure links its source and carries an as-of date; prints to a clean white PDF (Save as PDF) |

### 3.1 Top menu (`_includes/header.html`)

Grouped so visitors see five choices, not ten (Chuck, 2026-10-09; the home page itself is unchanged):

| Menu | Opens |
| --- | --- |
| Listen (dropdown) | All episodes, Ask the Archive, Archive insights (`links.archive_api` + `/insights`, the charts page on botb-mcp; same tab) |
| Explore (dropdown) | The Wheel of the Year, The Sky, Draw a Card, The Grimoire |
| Book a Reading | `/readings/` |
| About (dropdown) | Laylla & Chelle (`/witches/`), Press & partners |
| Shop | `/shop/` |
| Support (gold button) | `links.benefactor` |

Each dropdown item has a one-line description. Desktop: opens on hover or click, Enter/Space toggles, Escape or a
click elsewhere closes; the group holding the current page is gold (`.dd.here`), and an episode page lights Listen,
a post lights Explore. Phone (860 px and below): the menu button shows every group as a gold heading with its links
underneath, no second tap. The menu is code, not host-editable data; the Studio and MCP tools are unaffected.

### 3.2 The Sky (`/sky/`, site 0.12)

The website version of the Hedge Almanac app's Sky tab (app 0.2.0). Everything runs in the browser; no birth data, location
or chart leaves the page. "Remember me" stores the visitor's own and partner's details in `localStorage` (`botb.sky.v1`) only
when ticked; "forget it" removes them.

| Part | What |
| --- | --- |
| Tabs | The sky now, Your chart, Sign by sign, Compatibility, Sky finder. `#chart`, `#signs`, `#match`, `#finder` open a tab; `#<sign>` (e.g. `#scorpio`) opens that sign |
| The sky now | 3D sky from Earth (canvas, drag/pinch/wheel/arrow keys, tap a planet), slide or play a year either way, retrograde loops; Tonight (Sun/Moon/rising here, moon phase and % lit, sun and moon rise/set, planetary hour, void-of-course Moon, retrogrades) for Wellsboro or "Use my location"; the season ahead (lunations, eclipses, stations, ingresses for 120 days, each with its meaning and the witches' clips) |
| Your chart | Name, date, time or "don't know", town (search). Shows the time zone and daylight saving it used. Wheel (Placidus or Whole Sign, Whole Sign above the polar circles) that tilts into 3D; tap a planet, house, sign or aspect. Table of positions and elements. Full reading in the app's 18 sections, each followed by "The witches on this"; copy or print/save as PDF |
| Sign by sign | 12 signs: motto, element, mode, rulers, profile, shadow, tarot card (site art), keywords, crystals, herbs, colours, the witches on it |
| Compatibility | Second person's details; the app's synastry reading |
| Sky finder | Where each body is in the local sky (altitude/azimuth), horizon and compass; drag to look, or the phone's compass (iOS asks permission) |

Files: `sky.html`; `assets/js/lib/astronomy.min.js` (Astronomy Engine 2.1.19, MIT, unmodified); `astro-engine.js` (positions,
houses, aspects, patterns, transits, returns, events, rise/set, planetary hours, void of course; same maths as the app's
`Houses.kt`/`ChartEngine.kt`); `astro-reading.js` (the app's `ReadingComposer`); `astro-3d.js` (the app's `Orrery.kt` and
`ChartWheel.kt` on canvas); `astro-page.js` (page controller); `assets/css/astro-glyphs.woff2` (35 Noto Sans Symbols glyphs, so
signs never turn into emoji); `assets/data/astro/` (`interpretations.json` = the app's reading text, `witches.json` = quotes,
`places.json` = towns).

Accuracy: `node tools/astro/check_engine.js` compares the engine with the 8 Swiss Ephemeris reference charts the app's tests use
(planets within 0.05 deg, angles 0.2, cusps 0.3; currently worst 0.005 / 0.01 / 0.01). `node tools/astro/check_reading.js`
composes readings (with/without time, polar) and fails on any empty section or template hole. Run both after touching the
engine, the reading or `interpretations.json`.

Data: `tools/astro/build_sky_data.py` rebuilds `assets/data/astro/` from the app's offline index (Back on the Broomstick episodes
only, never SWH), the app's `interpretations.json`/`astro_passages.json` and GeoNames (every town of 15,000+ worldwide plus US
places of 1,000+; CC BY 4.0). Quotes carry episode slug and second; they link to `/episodes/<slug>/?t=<s>`, and the episode
page starts the player 5 s before that moment. A sign+word pair quote is kept only when the two words sit within 45 characters
with no other sign between (keeps zodiac-list passages out). Re-run after big new astrology episodes.

## 4. Data (`_data/`, generated)

`episodes.json`: one object per feed episode (deduped by Buzzsprout GUID), newest first:
`slug, show (botbs|swh), number, title (number stripped), full_title, date (YYYY-MM-DD aired), minutes, notes, audio
(Buzzsprout MP3), youtube (id or null), buzzsprout (id), sabbat (name or null, from the title), guests [names]`.
Notes are plain text without the feed's shared sign-off (fan-mail link, support link, PO Box); the episode page adds
the fan-mail link itself.


`stats.json`: `episodes, botbs, swh, hours, words, guests, latest`.
`guests.json`: `[{name, episodes: [slug]}]`. Guests come from titles ("... with Judika Illes") and transcript speaker
labels confirmed by a full name in the title or notes. The cloud publish only adds guests: it merges with the
guests.json already on the site and never removes a guest or episode (the cloud DB has no speaker labels, so it can't
see guests found only by label; archive 0.13.2). Removing or correcting a guest is a laptop `botbs site-export` and a PR.

`assets/js/episodes.json` is the same list, emitted by Jekyll for the browser.

Episode pages `episodes/<slug>.md` hold only front matter (layout, slug, title, permalink); the layout looks the
episode up by slug. Slugs are stable: `<number>-<title words>`, `swh-` prefix for the old show.

## 4.1 Host-editable content (`_data/*.yml`)

Laylla and Chelle edit these through the archive service (Studio > Change the dev site, or ChatGPT with the connector); nobody
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

One Markdown file per post, `_posts/YYYY-MM-DD-<slug>.md`, written only by the archive service (Studio > Write a post, or
the `blog_*` MCP tools from ChatGPT/Claude). Front matter: `layout: post`, `title`, `date`, `author`, optional
`summary` (list cards, link previews; mirrored to `description`), `cover` + `cover_alt` (an upload under
`assets/img/uploads/`; mirrored to `image` for link previews), `categories` (up to 3), `tags` (up to 10),
`episodes` (episode slugs, shown as Listen cards), `updated`, `draft_id`. Permalink `/blog/:title/` from the file
name, so the address never changes when the title is edited. Bodies are checked by the service: no HTML, Liquid or
kramdown attribute lists; links are https:// or site pages written from the root (`/episodes/...`, which the post
layout prefixes with the base path); pictures only from uploads. Drafts never reach this repo. Episode pages list
the posts that link them ("In the Grimoire"); the home page shows the 3 newest posts once there is one.

New episode pages and `_data/episodes|stats|guests.json` are committed automatically by the archive service on every
refresh, new episodes or not; it commits only what changed, so a failed publish heals on the next run, and it never
deletes pages (archive 0.13.1). These commits ("New episode: ...", "Photo: ...") are data, not spec changes, and don't
bump this spec's version.

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

## 5. Visual design (the Hybrid look, matching the Hedge Almanac app; site 0.13)

The site looks and behaves like the Hedge Almanac Android app (app SPEC section 12). Midnight Grimoire (purple and candle
gold, four fonts) was retired on 2026-11-08 at Chuck's request ("make the webpage look and act like the app").

Tokens live in `assets/css/grimoire.css` (block "Theme tokens: the Hybrid look"), one set per look, the same values as the
app's `ui/theme/Looks.kt`:

| Token | Original | Moonlit | Stoned Witches |
| --- | --- | --- | --- |
| `--bg` / `--bg2` / `--panel` | `#05070D` / `#080B13` / `#0B0F18` | `#03050C` / `#060A16` / `#0A1022` | `#040805` / `#07100A` / `#0B170F` |
| `--line` / `--line-strong` | `#182033` / `#26324D` | `#16213F` / `#253662` | `#17291C` / `#26422F` |
| `--text` / `--muted` / `--kicker` | `#FFFFFF` / `#8B97AB` / `#C9D4E4` | same / `#8C9BB8` / `#D2DDF0` | `#F4FAF3` / `#8EA594` / `#CDE3CF` |
| `--accent` (the ONE accent) | `#4C8DFF` | `#5A9CFF` | `#7CCB80` |
| `--glow` (behind the hero only) | `#0E2A5C` | `#123574` | `#123D1F` |
| `--swh` (Stoned Witches Hour identity) | `#6FBF73` | `#6FBF73` | `#9BD99E` |
| `--silver`, `--ice`, `--card-hi/lo`, `--danger` | frame silver, ice blue, card back, `#C4584A` | | |

Type: Cinzel (wordmark, h1/h2, sabbat and card names) and Inter (everything else, kickers in silver caps with the four-point
star). Cards: 14-16 px corners, `--line-strong` hairline; SWH episode cards edged green. The Sky page canvases read the
tokens (`theme()` in `astro-3d.js`): zodiac ring and glyphs silver, harmonious aspects accent, hard aspects danger.

**Looks** (moon button in the top bar, panel `#looks`): Original (default), Moonlit, Stoned Witches. Stoned Witches is
offered only after "I am 18 or older" is ticked; if that is unticked later the site falls back to Original. A second switch,
"Show AI-made art", hides every AI-made picture (painted pentacle, sabbat scenes, cauldron, leaf wreath), leaving the show's
own sigil, the NASA moon and the 1909 tarot, as in the app. All three choices live in `localStorage` (`botb.look`,
`botb.adult`, `botb.aiart`) and are applied to `<html data-look data-aiart>` by an inline script in `default.html` before
first paint. Nothing is sent anywhere.

**Today hero** (home): Original = the painted besom pentacle (`assets/img/brand/hero_pentacle.webp`, breathing slowly);
AI art off = the glowing sigil, turning once every 3 minutes; Moonlit = tonight's real Moon (`assets/img/moonbig/`, 30
phases, slow rock); Stoned Witches = the Moon in the leaf wreath with drifting smoke. On a sabbat day (the fixed dates in
`sky.js`) the hero becomes that sabbat's painting (`assets/img/sabbat/`, 1080 px copies of the app's 2K masters) and the date
line reads "Blessed <Sabbat>". Under it: Cinzel wordmark, date kicker, moon line (real render + phase + % lit), next
sabbat, then two cards: newest episode with the jewel play button (plays in place) and card of the day.

**Art shared with the app** (copied from `botb-android/app/src/main/assets`; masters in `~/Projects/botb-concepts`):
30 moon renders at 384 px (`assets/img/moon/`, the tonight's-sky widgets) and 768 px (`moonbig/`), Blender from NASA
LRO/LOLA maps; 23 silver 3D sign/planet glyphs (`astro3d/`, Sky sign chips and sign pages); the 22 tarot cards at 720 px
(1909 Pamela Colman Smith, public domain); brand art (`brand/`). Favicon, apple-touch and 512 icon = the app's launcher icon.

**Tarot frame** (`.tcard`, port of the app's `TarotCard3D`): breathing accent halo, silver edge, a light sheen that slides
across, idle 3D turn, drag to turn, tap/Enter to flip to the card back (navy, glowing pentacle, silver border), and a faded
floor reflection on the big card (`/tarot/`). The three-card draw uses the same card back. Do not put `mix-blend-mode`,
`isolation` or `-webkit-box-reflect` on the card: each one flattens the 3D context and the back never shows.

**Phone bar**: below 860 px a fixed bottom bar (`_includes/tabbar.html`) gives the app's five tabs: Today (/), Listen
(/episodes/), Search (/ask/), Sky (/sky/), Almanac (/wheel/), active tab = accent pill.

Motion plays slowly and stops entirely under `prefers-reduced-motion`.

The Ask the Archive service (Cloud Run) still has its own copy of the old Midnight Grimoire stylesheet; bringing it over is
open item W-11.

## 6. Behaviour (`assets/js/`)

- `sky.js` (pure, no DOM): moon phase from a reference new moon (good to a few hours), next sabbat from fixed dates,
  card of the day (`(dayNumber * 7) mod 22`, same for everyone that day). Shared with the archive service.
- `botb.js`: sky widgets, draws (25% reversed), wheel (SVG, counts, panel, hash), episode browser (show chips,
  `?show=` / `?q=`, clearing the search restores the full list), blog browser (search + category chips, `?q=` /
  `?cat=`), Ask, share, menu (burger + grouped dropdowns, 3.1), print button, reveal. Each feature has its own state; none reads another's variables.

## 7. Ask the Archive service (separate, Cloud Run `botb-mcp`)

Live at https://botb-mcp-dsfh6rrlia-uc.a.run.app (source and full spec: `Back_on_the_Broomstick/archive`,
`docs/SPEC.md`). Its public pages still use the old Midnight Grimoire copy of `grimoire.css` (W-11); the
signed-in Studio is a light "workroom" version of it with its own Studio bar (archive 0.13.0), so the hosts can always
tell the back office from the public site.

Public: archive search (`/api/search?q=`, rate limited per visitor plus a daily cap), insights charts
(`/insights`), and episode pages with full transcripts. Private (three logins: Chuck, Laylla, Chelle): the Studio
(home tiles: write a post, change the dev site, ask the archive, who's listening, find sponsors, more) and the MCP endpoint for Hermes, ChatGPT and Claude. The service
checks the feeds itself Friday 7pm, Saturday 1am and Saturday 9am Eastern (episodes post at varying times).

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
| W-2 | Done 0.11 (2026-11-01): Insights linked from the Listen menu |
| W-3 | Own booking and shop when the hosts move off Wix (today: links out) |
| W-4 | Custom domain if the hosts adopt the site (backonthebroomstick.com) |
| W-5 | Newsletter ("Wheel of the Year Newsletter") once they pick a provider |
| W-6 | Done 2026-10-08: the blog (The Grimoire, 4.2), and all 13 Wix posts (Sep 2023 to May 2026) imported with their 23 pictures (4.3) |
| W-7 | Done 2026-10-07: new episodes publish automatically; hosts edit content (4.1) |
| W-8 | Press kit: fill Buzzsprout downloads and package prices with the hosts; source for any "#1 pagan podcast" claim (none found in public rankings on 2026-10-07; Apple Spirituality chart is the verifiable claim) |
| W-9 | Real video on YouTube (today: audio over a still image from the feed) |
| W-11 | Ask the Archive service (botb-mcp public pages: /, /insights, /episode) still in Midnight Grimoire; copy the 0.13 stylesheet and art into `web/static`, check the light Studio theme on top, redeploy |
| W-12 | Spell Witch: a no-AI spell builder (intent, timing from moon/sabbat/planetary hour, correspondences, the witches' own clips, saved to an on-device spellbook). Chuck 2026-11-08: dev site first, then the app; after the 0.13 look |
| W-10 | Search engines: the dev site and botb-mcp are noindex (meta tag here; header + robots.txt on botb-mcp; no sitemap) until the hosts adopt the site as their main one. Remove all three together on their say-so |

## 10. Change log

| Version | Date | Change |
| --- | --- | --- |
| 0.13 | 2026-11-08 | The Hybrid look from the Hedge Almanac app (5): cobalt/silver tokens, Cinzel + Inter, three Looks (Original, Moonlit, Stoned Witches 18+) and an AI-art switch, Today hero (pentacle / real Moon / leaf wreath / sabbat painting on the day), jewel play, real moon renders, 3D sign glyphs, tarot frame with flip and reflection, sabbat paintings on the Wheel, cauldron empty states, episode cards, phone bottom bar, app icon. Sky canvases follow the look |
| 0.11 | 2026-11-01 | W-2: Listen menu adds "Archive insights" (botb-mcp `/insights` charts) |
| docs | 2026-11-01 | Spec review, no site change: refresh schedule adds Sat 1am, guest merge rule (4), every-refresh self-healing publish and auto commits don't bump the version (4.2), W-2 status |
| 0.10 | 2026-10-09 | Top menu grouped (3.1): Listen / Explore / Book a Reading / About / Shop / Support, dropdowns with one-line descriptions, current group highlighted, phone menu shows groups as headings. Home page unchanged |
| 0.9 | 2026-10-08 | Review phase 2: Spotify links go to the real show page (was a Spotify search); shop kicker/lead and the home shop panel follow `shop.yml` `open` + `url` instead of hard-coded "coming soon"; episode pages link fan mail (`links.fan_mail`) and the 212 notes that ended in a bare "Got a question?" were regenerated without it (archive 0.12.1); `check_site.py` refuses that orphan (8) |
| 0.8 | 2026-10-08 | Review fixes: the episode browser threw `cat is not defined` on every load (lines pasted from the blog code in 0.6), breaking the show chips, `?show=swh` and clearing the search; restored. Every host-editable and episode value printed with `\| escape`; Press "Save as PDF" no longer an inline `onclick`; `check_site.py` refuses inline event handlers and script URLs (8) |
| 0.7 | 2026-10-08 | Imported the 13 Wix blog posts and 23 pictures (4.3); covers that must show whole (`cover_fit: contain`); in-post pictures capped at screen height |
| 0.6 | 2026-10-08 | The Grimoire blog: `/blog/`, post layout, search/filter, Atom feed, home band, episode back-links (4.2); nav Grimoire; broom-pentacle sigil and favicon; full-retranscribe data export |
| 0.5 | 2026-10-07 | Dev site naming, press kit, host editing, noindex |
