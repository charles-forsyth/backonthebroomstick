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
  const episodes = () => (EPS ||= fetch(url('/assets/js/episodes.json')).then((r) => r.json()));

  /* ---------- Tonight's sky (home hero, wheel page, tarot page) ---------- */
  function sky() {
    const now = new Date(), m = S.moon(now), s = S.nextSabbat(now), c = S.cardOfDay(now);
    $$('[data-moon-disc]').forEach((el) => (el.innerHTML = S.moonSVG(m.f, +el.dataset.moonDisc || 54)));
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
              <text x="${C + (R + 34) * Math.cos(a)}" y="${C + (R + 34) * Math.sin(a) + 4}" text-anchor="middle" class="lbl">${n}</text></g>`;
      });
      h += `<text x="${C}" y="${C - 4}" text-anchor="middle" class="hub">${all.length}</text><text x="${C}" y="${C + 14}" text-anchor="middle" class="hub-sub">episodes</text>`;
      svg.setAttribute('viewBox', '-30 -10 380 340');
      svg.innerHTML = h;
      function pick(n, push) {
        $$('.node', svg).forEach((g) => g.classList.toggle('on', g.dataset.n === n));
        const s = S.SABBATS.find((x) => x[0] === n);
        panel.innerHTML = `<h3>${n}</h3><p class="muted">${esc(s[3])}</p><ul class="eplist">${by[n].map((e) =>
          `<li>${tag(e.show)} <a href="${epUrl(e)}">${esc(e.title)}</a> <span class="muted">${fmt(e.date)}</span></li>`).join('')}</ul>`;
        if (push) history.replaceState(null, '', '#' + n.toLowerCase());
      }
      svg.addEventListener('click', (e) => { const g = e.target.closest('.node'); g && pick(g.dataset.n, true); });
      svg.addEventListener('keydown', (e) => { const g = e.target.closest('.node'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(g.dataset.n, true); } });
      const fromHash = order.find((n) => n.toLowerCase() === location.hash.slice(1).toLowerCase());
      pick(fromHash || S.nextSabbat(new Date()).n, false);
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
        list.innerHTML = hit.slice(0, 400).map((e) => `<li><span class="d">${fmt(e.date)}</span><div>
          <a class="t" href="${epUrl(e)}">${tag(e.show)} ${e.number ? e.number + ': ' : ''}${mark(e.title, ws)}</a>
          <span class="n">${mark(e.notes.slice(0, 180).replace(/\s+\S*$/, ''), ws)}...</span></div></li>`).join('');
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
            || '<p class="muted">Nothing found. Try other words.</p>';
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

  /* ---------- Chrome ---------- */
  function chrome() {
    $$('[data-burger]').forEach((b) => b.addEventListener('click', () => {
      const m = $(b.dataset.burger); m.classList.toggle('open'); b.setAttribute('aria-expanded', m.classList.contains('open'));
    }));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.12 });
      $$('.reveal').forEach((el) => io.observe(el));
    } else $$('.reveal').forEach((el) => el.classList.add('in'));
  }

  document.addEventListener('DOMContentLoaded', () => { chrome(); sky(); draw(); wheel(); browser(); ask(); });
})();
