/* Back on the Broomstick: page behaviour. One IIFE, no dependencies. Each feature checks for its root
   element and does nothing on pages without it. Episode data comes from assets/js/episodes.json (built by
   Jekyll from _data/episodes.json), fetched once. */
(function () {
  'use strict';
  const S = window.BotbSky, B = window.BOTB || { base: '' };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fmt = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const url = (p) => B.base + p;
  const epUrl = (e) => url('/episodes/' + e.slug + '/');
  const tag = (show) => `<span class="tag ${show}">${show === 'swh' ? 'SWH' : 'BotB'}</span>`;
  let EPS = null;
  const aiArt = () => document.documentElement.dataset.aiart !== 'off';
  const cauldron = () => (aiArt() ? `<img class="cauldron" src="${url('/assets/img/brand/cauldron.webp')}" alt="" width="150" height="150" loading="lazy">` : '');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const episodes = () => (EPS ||= fetch(url('/assets/js/episodes.json')).then((r) => r.json()));

  /* ---------- Tonight's sky (home hero, wheel page, tarot page) ---------- */
  function sky() {
    const now = new Date(), m = S.moon(now), s = S.nextSabbat(now), c = S.cardOfDay(now);
    $$('[data-moon-disc]').forEach((el) => (el.innerHTML = S.moonImg(m.f, +el.dataset.moonDisc || 54, B.base)));
    $$('[data-today-date]').forEach((el) => (el.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })));
    $$('[data-moon-name]').forEach((el) => (el.textContent = m.name));
    $$('[data-moon-lit]').forEach((el) => (el.textContent = Math.round(m.lit * 100) + '% lit'));
    $$('[data-sabbat-name]').forEach((el) => (el.textContent = s.n));
    $$('[data-sabbat-days]').forEach((el) => (el.textContent = s.days === 0 ? 'is today' : `in ${s.days} day${s.days === 1 ? '' : 's'}`));
    $$('[data-sabbat-blurb]').forEach((el) => (el.textContent = s.b));
    $$('[data-sabbat-link]').forEach((el) => (el.href = url('/wheel/#' + s.n.toLowerCase())));
    $$('[data-card-img]').forEach((el) => { el.src = url('/assets/img/tarot/' + c[0] + '.webp'); el.alt = c[1]; });
    $$('[data-card-name]').forEach((el) => (el.textContent = c[1]));
    $$('[data-card-meaning]').forEach((el) => (el.textContent = c[2]));
    const eps = $('[data-sabbat-eps]');
    if (eps) episodes().then((all) => {
      eps.innerHTML = all.filter((e) => e.sabbat === s.n).slice(0, 3)
        .map((e) => `<li><a href="${epUrl(e)}">${esc(e.title)}</a> <span class="muted">${e.date.slice(0, 4)}</span></li>`).join('');
    });
    const otd = $('[data-onthisday]');
    if (otd) episodes().then((all) => {
      const y = now.getFullYear(), key = (d) => (d.getMonth() + 1) * 100 + d.getDate();
      const lo = new Date(now - 3 * 864e5), hi = new Date(+now + 3 * 864e5);
      const hit = all.filter((e) => {
        const d = new Date(e.date + 'T12:00:00');
        return d.getFullYear() < y && key(d) >= key(lo) && key(d) <= key(hi);
      }).slice(0, 4);
      otd.innerHTML = hit.length
        ? hit.map((e) => `<li><b>${e.date.slice(0, 4)}</b> <a href="${epUrl(e)}">${esc(e.title)}</a></li>`).join('')
        : '<li class="muted">Nothing aired this week in years past. A quiet week for the coven.</li>';
    });
  }

  /* ---------- Draw three cards ---------- */
  function draw() {
    $$('[data-draw]').forEach((root) => {
      const btn = $('[data-draw-btn]', root), slots = $$('[data-draw-slot]', root);
      const labels = (root.dataset.draw || 'Past,Present,Path').split(',');
      btn?.addEventListener('click', () => {
        const pool = S.CARDS.slice().sort(() => Math.random() - 0.5).slice(0, slots.length);
        slots.forEach((slot, i) => {
          slot.classList.remove('flipped');
          setTimeout(() => {
            const [id, name, mean] = pool[i], rev = Math.random() < 0.25;
            $('.face', slot).innerHTML = `<img src="${url('/assets/img/tarot/' + id + '.webp')}" alt="${esc(name)}" class="${rev ? 'rev' : ''}">`;
            $('.cap', slot).innerHTML = `<b>${esc(labels[i] || '')}:</b> ${esc(name)}${rev ? ' (reversed)' : ''}<br><span>${esc(mean)}</span>`;
            slot.classList.add('flipped');
          }, 250 + i * 380);
        });
        btn.textContent = 'Draw again';
      });
    });
  }

  /* ---------- Wheel of the Year ---------- */
  function wheel() {
    $$('[data-wheel]').forEach((root) => episodes().then((all) => {
      const svg = $('svg', root), panel = $('[data-wheel-panel]', root);
      const order = ['Yule', 'Imbolc', 'Ostara', 'Beltane', 'Litha', 'Lughnasadh', 'Mabon', 'Samhain'];
      const by = Object.fromEntries(order.map((n) => [n, all.filter((e) => e.sabbat === n)]));
      const R = 130, C = 160;
      let h = `<circle cx="${C}" cy="${C}" r="${R}" class="ring"/><circle cx="${C}" cy="${C}" r="58" class="ring inner"/>`;
      order.forEach((n, i) => {
        const a = (i / 8) * 2 * Math.PI - Math.PI / 2, x = C + R * Math.cos(a), y = C + R * Math.sin(a);
        h += `<line x1="${C + 58 * Math.cos(a)}" y1="${C + 58 * Math.sin(a)}" x2="${x}" y2="${y}" class="spoke"/>`;
        h += `<g class="node" data-n="${n}" tabindex="0" role="button" aria-label="${n}, ${by[n].length} episodes"><circle cx="${x}" cy="${y}" r="17"/>
              <text x="${x}" y="${y + 4}" text-anchor="middle">${by[n].length}</text>
              <text x="${C + (R + 34 + 14 * Math.abs(Math.cos(a))) * Math.cos(a)}" y="${C + (R + 34) * Math.sin(a) + 4}" text-anchor="middle" class="lbl">${n}</text></g>`;
      });
      h += `<text x="${C}" y="${C - 4}" text-anchor="middle" class="hub">${all.length}</text><text x="${C}" y="${C + 14}" text-anchor="middle" class="hub-sub">episodes</text>`;
      svg.setAttribute('viewBox', '-44 -10 408 340');
      svg.innerHTML = h;
      function pick(n, push) {
        $$('.node', svg).forEach((g) => g.classList.toggle('on', g.dataset.n === n));
        const s = S.SABBATS.find((x) => x[0] === n);
        panel.innerHTML = (aiArt() ? `<img class="wheel-scene" src="${url('/assets/img/sabbat/' + n.toLowerCase() + '.webp')}" alt="" width="1080" height="1935" loading="lazy">` : '') + `<h3>${n}</h3><p class="muted">${esc(s[3])}</p><ul class="eplist">${by[n].map((e) =>
          `<li>${tag(e.show)} <a href="${epUrl(e)}">${esc(e.title)}</a> <span class="muted">${fmt(e.date)}</span></li>`).join('')}</ul>`;
        if (push) history.replaceState(null, '', '#' + n.toLowerCase());
      }
      svg.addEventListener('click', (e) => { const g = e.target.closest('.node'); g && pick(g.dataset.n, true); });
      svg.addEventListener('keydown', (e) => { const g = e.target.closest('.node'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(g.dataset.n, true); } });
      const fromHash = order.find((n) => n.toLowerCase() === location.hash.slice(1).toLowerCase());
      pick(fromHash || S.nextSabbat(new Date()).n, false);
      wheelRefresh = () => pick(($('.node.on', svg) || {}).dataset?.n || S.nextSabbat(new Date()).n, false);
    }));
  }

  /* ---------- Episode browser (/episodes/) ---------- */
  function browser() {
    const root = $('[data-browser]');
    if (!root) return;
    episodes().then((all) => {
      const input = $('input', root), chips = $$('[data-show]', root), list = $('[data-list]', root), line = $('[data-line]', root);
      const p = new URLSearchParams(location.search);
      let show = p.get('show') || 'all';
      input.value = p.get('q') || '';
      const mark = (t, ws) => ws.reduce((s, w) => s.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'), esc(t));
      function render() {
        const ws = input.value.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
        const hit = all.filter((e) => (show === 'all' || e.show === show) &&
          ws.every((w) => (e.title + ' ' + e.notes + ' ' + (e.guests || []).join(' ')).toLowerCase().includes(w)));
        chips.forEach((c) => c.classList.toggle('on', c.dataset.show === show));
        line.textContent = `${hit.length} of ${all.length} episodes${show !== 'all' ? (show === 'swh' ? ' of The Stoned Witches Hour' : ' of Back on the Broomstick') : ''}${ws.length ? ' matching "' + input.value.trim() + '"' : ''}`;
        list.innerHTML = hit.slice(0, 400).map((e) => `<li class="${e.show}"><span class="d">${fmt(e.date)}</span><div>
          <a class="t" href="${epUrl(e)}">${tag(e.show)} ${e.number ? e.number + ': ' : ''}${mark(e.title, ws)}</a>
          <span class="n">${mark(e.notes.slice(0, 180).replace(/\s+\S*$/, ''), ws)}...</span></div>
          <a class="jewel" href="${epUrl(e)}?play=1" aria-label="Play ${esc(e.title)}"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg></a></li>`).join('')
          || `<li class="empty">${cauldron()}<p class="center muted">Nothing in the cauldron for that. Try other words, or <a href="${url('/ask/')}?q=${encodeURIComponent(input.value)}">ask the archive</a>.</p></li>`;
        const q = new URLSearchParams();
        if (input.value.trim()) q.set('q', input.value.trim());
        if (show !== 'all') q.set('show', show);
        history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
      }
      input.addEventListener('input', render);
      chips.forEach((c) => c.addEventListener('click', () => { show = c.dataset.show; render(); }));
      render();
    });
  }

  /* ---------- Ask the Archive ---------- */
  function ask() {
    $$('[data-ask]').forEach((root) => {
      const input = $('input', root), out = $('[data-ask-out]', root), chips = $('[data-ask-chips]', root);
      const samples = ['protection spell for my home', 'Hecate at the crossroads', 'haunted hotels', 'setting up an ancestor altar for Samhain', 'best tarot deck for beginners'];
      if (chips) chips.innerHTML = samples.map((q) => `<button type="button" class="chip">${esc(q)}</button>`).join('');
      async function run(q) {
        input.value = q;
        if (!B.api) {
          // Until the archive service is live: search titles and show notes in the browser.
          const all = await episodes();
          const ws = q.toLowerCase().match(/[a-z']{3,}/g) || [];
          const scored = all.map((e) => {
            const t = (e.title + ' ' + e.notes).toLowerCase();
            return [e, ws.reduce((n, w) => n + (e.title.toLowerCase().includes(w) ? 3 : 0) + (t.includes(w) ? 1 : 0), 0)];
          }).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
          out.innerHTML = `<p class="ask-note">Searching episode titles and show notes. Full-transcript search (every word, with a link to the exact moment) is coming soon.</p>` +
            (scored.length ? scored.map(([e]) => `<article class="hit"><div class="hit-meta">${tag(e.show)} ${esc(e.title)} <span class="muted">&middot; ${fmt(e.date)}</span></div>
              <p class="hit-text">${esc(e.notes.slice(0, 260).replace(/\s+\S*$/, ''))}...</p><a class="hit-link" href="${epUrl(e)}">Open the episode</a></article>`).join('')
              : '<p class="muted">Nothing in the titles or notes. Try other words.</p>');
          return;
        }
        out.innerHTML = '<p class="ask-note">Searching every episode...</p>';
        try {
          const r = await fetch(B.api.replace(/\/$/, '') + '/api/search?q=' + encodeURIComponent(q));
          if (r.status === 429) { out.innerHTML = '<p class="ask-note">The archive is catching its breath. Try again in a minute.</p>'; return; }
          const d = await r.json();
          out.innerHTML = (d.passages || []).map((p) => `<article class="hit"><div class="hit-meta">${tag(p.show)} ${esc(p.episode)} <span class="muted">&middot; ${fmt(p.date)}</span></div>
            <p class="hit-text">"${esc(p.text.slice(0, 420).trim())}..."</p><a class="hit-link" href="${esc(p.url)}" target="_blank" rel="noopener">&#9654; Listen from this moment</a></article>`).join('')
            || cauldron() + '<p class="muted center">Nothing in the cauldron for that. Try other words.</p>';
        } catch (e) {
          out.innerHTML = '<p class="ask-note">The archive did not answer. Try again in a moment.</p>';
        }
      }
      chips?.addEventListener('click', (e) => e.target.matches('.chip') && run(e.target.textContent));
      $('form', root).addEventListener('submit', (e) => { e.preventDefault(); input.value.trim() && run(input.value.trim()); });
      const q = new URLSearchParams(location.search).get('q');
      if (q) run(q);
    });
  }

  /* ---------- The Grimoire (/blog/): search titles + full text, category chips; state in ?q= and ?cat= ---------- */
  function blog() {
    const root = $('[data-blog-browser]');
    if (!root) return;
    fetch(url('/assets/js/posts.json')).then((r) => r.json()).then((all) => {
      const input = $('input', root), chips = $$('[data-cat]', root), grid = $('[data-posts]', root), line = $('[data-line]', root);
      const first = { grid: grid.innerHTML, line: line.textContent };
      const p = new URLSearchParams(location.search);
      let cat = p.get('cat') || '';
      input.value = p.get('q') || '';
      const mark = (t, ws) => ws.reduce((s, w) => s.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'), esc(t));
      const snippet = (text, ws) => {
        const low = text.toLowerCase(), i = ws.length ? low.indexOf(ws[0]) : -1;
        if (i < 0) return '';
        const a = Math.max(0, i - 80), s = text.slice(a, i + 140).replace(/^\S*\s/, '').replace(/\s\S*$/, '');
        return (a ? '...' : '') + s + '...';
      };
      function render() {
        const ws = input.value.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
        if (!ws.length && !cat) {
          grid.innerHTML = first.grid; line.textContent = first.line;
          chips.forEach((c) => c.classList.toggle('on', c.dataset.cat === ''));
          history.replaceState(null, '', location.pathname);
          return;
        }
        const hit = all.filter((x) => (!cat || (x.categories || []).includes(cat)) &&
          ws.every((w) => (x.title + ' ' + x.summary + ' ' + (x.tags || []).join(' ') + ' ' + x.text).toLowerCase().includes(w)));
        chips.forEach((c) => c.classList.toggle('on', c.dataset.cat === cat));
        line.textContent = `${hit.length} of ${all.length} post${all.length === 1 ? '' : 's'}${cat ? ' in ' + cat : ''}${ws.length ? ' matching "' + input.value.trim() + '"' : ''}`;
        grid.innerHTML = hit.map((x) => {
          const sn = ws.length ? snippet(x.text, ws) : '';
          return `<a class="blog-card" href="${esc(x.url)}">${x.cover ? `<img${x.fit === 'contain' ? ' class="fit-contain"' : ''} src="${esc(x.cover)}" alt="" loading="lazy" width="600" height="338">` : '<span class="blog-card-art" aria-hidden="true"><span class="sigil"></span></span>'}
            <span class="ep-date">${fmt(x.date)}${(x.categories || []).map((c) => ' &middot; ' + esc(c)).join('')}</span>
            <span class="ep-title">${mark(x.title, ws)}</span>
            <span class="ep-notes">${sn ? mark(sn, ws) : mark(x.summary, ws)}</span><span class="blog-by">By ${esc(x.author)}</span></a>`;
        }).join('') || '<p class="muted">Nothing in the Grimoire matches. Try other words, or <a href="' + url('/ask/') + '?q=' + encodeURIComponent(input.value) + '">ask the archive</a>.</p>';
        const q = new URLSearchParams();
        if (input.value.trim()) q.set('q', input.value.trim());
        if (cat) q.set('cat', cat);
        history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
      }
      input.addEventListener('input', render);
      chips.forEach((c) => c.addEventListener('click', () => { cat = c.dataset.cat; render(); }));
      if (input.value || cat) render();
    });
  }

  /* ---------- Share a post ---------- */
  function share() {
    const msg = $('[data-share-msg]');
    $$('[data-share]').forEach((b) => {
      if (!navigator.share) { b.remove(); return; }
      b.addEventListener('click', () => navigator.share({ title: b.dataset.title, url: location.href }).catch(() => {}));
    });
    $$('[data-copy-link]').forEach((b) => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.href); if (msg) msg.textContent = 'Link copied.'; }
      catch (e) { if (msg) msg.textContent = location.href; }
    }));
  }

  /* ---------- Host-edited content that expires by date ---------- */
  function expiries() {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
    $$('.announce[data-ends]').forEach((a) => { if (a.dataset.ends && a.dataset.ends < today) a.remove(); });
    $$('.event[data-date]').forEach((e) => { if (e.dataset.date < today) e.remove(); });
    $$('[data-events]').forEach((s) => { if (!$('.event', s)) s.remove(); });
  }


  /* ---------- Looks (app Settings > Look): Original, Moonlit, Stoned Witches 18+; AI-art switch ---------- */
  function looks() {
    const H = document.documentElement, btn = $('[data-look-btn]'), box = $('[data-looks]');
    if (!btn || !box) return;
    const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
    const adult = $('[data-adult-toggle]', box), ai = $('[data-aiart-toggle]', box);
    function paint() {
      const isAdult = get('botb.adult') === '1';
      adult.checked = isAdult; ai.checked = H.dataset.aiart !== 'off';
      let l = get('botb.look') || 'original'; if (l === 'swh' && !isAdult) l = 'original';
      H.dataset.look = l;
      $$('[data-look-pick]', box).forEach((r) => { r.setAttribute('aria-checked', String(r.dataset.lookPick === l)); if (r.dataset.lookPick === 'swh') r.disabled = !isAdult; });
      $('[data-swh-note]', box).textContent = isAdult ? 'Green-black, sage, smoke and leaves' : 'Tick "I am 18 or older" below to unlock';
      hero(); document.dispatchEvent(new CustomEvent('botb:look'));
    }
    btn.addEventListener('click', (e) => { e.stopPropagation(); box.hidden = !box.hidden; btn.setAttribute('aria-expanded', String(!box.hidden)); });
    document.addEventListener('click', (e) => { if (!box.hidden && !e.target.closest('[data-looks]')) { box.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) { box.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); } });
    $$('[data-look-pick]', box).forEach((r) => r.addEventListener('click', () => { put('botb.look', r.dataset.lookPick); paint(); }));
    adult.addEventListener('change', () => { put('botb.adult', adult.checked ? '1' : '0'); paint(); });
    ai.addEventListener('change', () => { put('botb.aiart', ai.checked ? 'on' : 'off'); H.dataset.aiart = ai.checked ? 'on' : 'off'; paint(); wheelRefresh(); });
    paint();
  }

  /* ---------- Today hero: pentacle (Original), tonight's real Moon (Moonlit, SWH), sabbat painting on the day ---------- */
  function hero() {
    const box = $('[data-hero]');
    if (!box) return;
    const now = new Date(), s = S.nextSabbat(now), m = S.moon(now), look = document.documentElement.dataset.look || 'original';
    const moonBig = S.moonImg(m.f, 768, B.base, true).replace('moon-img', 'art-moon');
    let html, kind;
    if (s.days === 0 && aiArt()) { kind = 'sabbat'; html = `<img src="${url('/assets/img/sabbat/' + s.n.toLowerCase() + '.webp')}" alt="${esc(s.n)}" width="1080" height="1935">`; }
    else if (look === 'original') { kind = 'pentacle'; html = aiArt()
      ? `<img class="art-pentacle" src="${url('/assets/img/brand/hero_pentacle.webp')}" alt="" width="1400" height="1400">`
      : `<img class="art-sigil" src="${url('/assets/img/brand/pentacle_glow.webp')}" alt="" width="1024" height="1024">`; }
    else if (look === 'swh') { kind = 'swh'; html = moonBig + (aiArt() ? `<img class="art-wreath" src="${url('/assets/img/brand/swh_wreath.webp')}" alt="" width="1024" height="1024">` : '') + '<span class="smoke"><i></i><i></i><i></i></span>'; }
    else { kind = 'moon'; html = moonBig; }
    if (box.dataset.hero !== kind) { box.dataset.hero = kind; box.innerHTML = html; }
    if (kind === 'sabbat') { const d = $('[data-today-date]'); if (d) d.textContent = 'Blessed ' + s.n + ' \u00b7 ' + now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); }
  }

  /* ---------- Tarot frame: drag to turn, tap to flip (app TarotCard3D) ---------- */
  function cards() {
    $$('.tcard[data-flip]').forEach((c) => {
      let x0 = null, moved = false;
      const set = (ry) => c.style.setProperty('--ry', ry + 'deg');
      c.addEventListener('pointerdown', (e) => { x0 = e.clientX; moved = false; c.setPointerCapture(e.pointerId); });
      c.addEventListener('pointermove', (e) => { if (x0 === null) return; const dx = e.clientX - x0; if (Math.abs(dx) > 4) moved = true; set(Math.max(-35, Math.min(35, dx * 0.4))); });
      const end = () => { if (x0 === null) return; x0 = null; set(0); if (!moved) c.classList.toggle('flipped'); };
      c.addEventListener('pointerup', end); c.addEventListener('pointercancel', () => { x0 = null; set(0); });
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.classList.toggle('flipped'); } });
      if (!reduced()) { let t = 0; const idle = () => { if (x0 === null && !document.hidden) { t += 0.016; c.style.setProperty('--ry', (Math.sin(t * 1.05) * 8).toFixed(2) + 'deg'); c.style.setProperty('--rx', '4deg'); } requestAnimationFrame(idle); }; requestAnimationFrame(idle); }
    });
  }

  /* ---------- One-tap play: the jewel on Today, ?play=1 on episode pages ---------- */
  function play() {
    const j = $('[data-play-latest]'), a = $('[data-latest-audio]');
    if (j && a) {
      const icon = (p) => (j.innerHTML = p ? '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>');
      j.addEventListener('click', () => (a.paused ? a.play() : a.pause()));
      a.addEventListener('play', () => { icon(true); j.classList.add('playing'); j.setAttribute('aria-label', 'Pause'); });
      a.addEventListener('pause', () => { icon(false); j.classList.remove('playing'); j.setAttribute('aria-label', 'Play the newest episode'); });
    }
    const p = $('.ep-player audio');
    if (p && new URLSearchParams(location.search).get('play') === '1') { p.preload = 'metadata'; p.play().catch(() => {}); }
  }

  let wheelRefresh = () => {};
  /* ---------- Chrome ---------- */
  function chrome() {
    $$('[data-print]').forEach((b) => b.addEventListener('click', () => window.print())); // no inline handlers
    // Episode pages: ?t=<seconds> (from the Sky page's quotes) starts the player at that moment, 5 s early for context.
    const t0 = parseInt(new URLSearchParams(location.search).get('t'), 10);
    const player = $('.ep-player audio');
    if (player && t0 > 0) {
      const at = Math.max(0, t0 - 5), m = Math.floor(t0 / 60), sec = String(t0 % 60).padStart(2, '0');
      player.preload = 'metadata';
      player.addEventListener('loadedmetadata', () => { if (player.currentTime < 1) player.currentTime = at; }, { once: true });
      player.addEventListener('play', () => { if (player.currentTime < 1) player.currentTime = at; }, { once: true });
      const note = document.createElement('p'); note.className = 'ep-at';
      note.innerHTML = `Starts at <b>${m}:${sec}</b>, the moment quoted on the Sky page. Press play.`;
      player.insertAdjacentElement('afterend', note);
    }
    $$('[data-burger]').forEach((b) => b.addEventListener('click', () => {
      const m = $(b.dataset.burger); m.classList.toggle('open'); b.setAttribute('aria-expanded', m.classList.contains('open'));
    }));
    // Grouped menu: click (or Enter/Space) toggles a group; Escape or a click elsewhere closes it. Hover opens on desktop.
    const dds = $$('.dd');
    const closeAll = (except) => dds.forEach((d) => { if (d !== except) { d.classList.remove('open'); $('.dd-btn', d).setAttribute('aria-expanded', 'false'); } });
    dds.forEach((d) => $('.dd-btn', d).addEventListener('click', (e) => {
      e.stopPropagation(); closeAll(d);
      const open = d.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(open));
    }));
    document.addEventListener('click', (e) => { if (!e.target.closest('.dd')) closeAll(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const o = $('.dd.open .dd-btn'); closeAll(); if (o) o.focus(); } });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.12 });
      $$('.reveal').forEach((el) => io.observe(el));
    } else $$('.reveal').forEach((el) => el.classList.add('in'));
  }

  document.addEventListener('DOMContentLoaded', () => { expiries(); chrome(); sky(); looks(); hero(); cards(); play(); draw(); wheel(); browser(); ask(); blog(); share(); });
})();
