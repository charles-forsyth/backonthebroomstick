/* Back on the Broomstick: the Sky page. Wires the engine, readings and 3D drawings to sky.html.
   Birth details live only in this page (and localStorage if the visitor ticks "Remember me"). */
(function () {
  'use strict';
  // 3D silver sign glyphs rendered in Blender for the app (assets/img/astro3d); the font glyph is the fallback.
  const i3d = (s) => `<img class="i3d" src="${(window.BOTB || { base: '' }).base}/assets/img/astro3d/sign_${s.key}.webp" alt="" width="256" height="256" loading="lazy">`;
  const E = window.BotbAstro, R = window.BotbReading, V = window.BotbSky3D, B0 = window.BOTB || { base: '' };
  const root = document.querySelector('[data-astro]');
  if (!root || !E || !R || !V) return;
  const $ = (s, r = root) => r.querySelector(s), $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const url = (p) => B0.base + p;
  const vs = (g) => `<span class="ag">${g}\uFE0E</span>`;
  const DATA = url('/assets/data/astro/');
  const STORE = 'botb.sky.v1';
  const DEFAULT_HERE = { name: 'Wellsboro', region: 'Pennsylvania', country: 'United States', lat: 41.7487, lon: -77.3005, zone: 'America/New_York' };
  const state = { here: DEFAULT_HERE, me: null, chart: null, partner: null, system: 'placidus', I: null, W: null, eps: null, places: null, reader: null };
  const load = (n) => fetch(DATA + n).then((r) => r.json());
  const once = {};
  const get = (n) => (once[n] ||= load(n));
  const episodes = () => (state.eps ||= fetch(url('/assets/js/episodes.json')).then((r) => r.json()).then((a) => Object.fromEntries(a.map((e) => [e.slug, e]))));
  const tz = () => state.here.zone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fmtTime = (d, zone = tz()) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone });
  const fmtDay = (d, zone = tz()) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: zone });
  const countdown = (now, t) => {
    const d = (t - now) / 864e5;
    if (d < 0) return 'now';
    if (d < 1) { const h = Math.round(d * 24); return h <= 1 ? 'within the hour' : `in ${h} hours`; }
    const n = Math.round(d); return n === 1 ? 'tomorrow' : `in ${n} days`;
  };
  const placeLabel = (p) => [p.name, p.region, p.country].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(', ');
  try { const saved = JSON.parse(localStorage.getItem(STORE) || 'null'); if (saved) { state.me = saved.me || null; state.partner = saved.partner || null; state.here = saved.here || DEFAULT_HERE; state.system = saved.system || 'placidus'; } } catch (e) { /* private mode */ }
  const persist = () => { try { if ($('[name=remember]').checked) localStorage.setItem(STORE, JSON.stringify({ me: state.me, partner: state.partner, here: state.here, system: state.system })); } catch (e) { /* */ } };

  /* ---------- tabs ---------- */
  function show(tab, push) {
    $$('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $$('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== tab));
    if (push) history.replaceState(null, '', '#' + tab);
    if (tab === 'signs' && !$('[data-sign-page]').innerHTML) renderSign(state.chart ? state.chart.pos.sun.sign : E.position('sun', new Date()).sign);
    if (tab === 'finder') startFinder();
    if (tab === 'chart' && state.chart && wheel) wheel.highlight(null);
  }
  $('.astro-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab, true); });
  $('.astro-tabs').addEventListener('keydown', (e) => {
    const tabs = $$('[data-tab]'), i = tabs.indexOf(document.activeElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); show(n.dataset.tab, true);
  });

  /* ---------- the witches on this ---------- */
  async function witchesHtml(topics, pair, limit = 3) {
    const [W, eps] = await Promise.all([get('witches.json'), episodes()]);
    const qs = R.witchesOn(W, topics, pair, limit).filter((q) => eps[q.s]);
    if (!qs.length) return '';
    return `<div class="witches"><p class="kicker">The witches on this</p>${qs.map((q) => {
      const e = eps[q.s], m = Math.floor(q.t / 60), s = String(q.t % 60).padStart(2, '0');
      return `<figure class="wq"><blockquote>\u201C${esc(q.q)}\u201D</blockquote><figcaption><a href="${url('/episodes/' + e.slug + '/')}?t=${q.t}">&#9654; ${esc(e.title)}</a> <span class="muted">&middot; ${m}:${s}</span></figcaption></figure>`;
    }).join('')}</div>`;
  }

  /* ---------- THE SKY NOW ---------- */
  let orrery = null, dayOffset = 0, playing = false, picked = null;
  function skyAt() { return new Date(Date.now() + dayOffset * 864e5); }
  function drawSky() {
    const t = skyAt();
    orrery.set(V.skyBodies(t));
    $('[data-when]').textContent = dayOffset === 0 ? 'Right now' : t.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: tz() });
    if (picked) pick(picked);
  }
  function pick(key) {
    picked = key; orrery.select(key);
    const box = $('[data-orrery-pick]');
    if (!key) { box.hidden = true; return; }
    const p = E.position(key, skyAt());
    box.hidden = false;
    box.innerHTML = `<b>${vs(E.B[key].glyph)} ${E.B[key].label} in ${p.sign.label}</b><span class="${p.retro ? 'ember' : 'muted'}">${E.fmtDeg(p.degInSign)} ${p.sign.label}${p.retro ? ' &middot; retrograde' : ''}</span><button type="button" class="linkish" data-open-sign="${p.sign.key}">About ${p.sign.label} &rsaquo;</button>`;
  }
  root.addEventListener('click', (e) => { const s = e.target.closest('[data-open-sign]'); if (s) { renderSign(E.SIGNS.find((x) => x.key === s.dataset.openSign)); show('signs', true); window.scrollTo({ top: root.offsetTop - 70, behavior: 'smooth' }); } });

  function tonight() {
    const now = new Date(), pos = E.all(now), here = state.here;
    const big = ['sun', 'moon'].map((k) => `<div class="b3"><span class="b3-g">${vs(E.B[k].glyph)}</span><small>${k === 'sun' ? 'Sun' : 'Moon'}</small><b>${pos[k].sign.label}</b><span class="muted">${E.fmtDeg(pos[k].degInSign)}</span></div>`);
    const a = E.angles(now, here.lat, here.lon), rs = E.signOf(a.asc);
    big.push(`<div class="b3"><span class="b3-g">${vs(rs.glyph)}</span><small>Rising here</small><b>${rs.label}</b><span class="muted">${E.fmtDeg(E.norm(a.asc) % 30)}</span></div>`);
    $('[data-big3]').innerHTML = big.join('');
    const mi = E.moonInfo(now), facts = [];
    facts.push(`<li><b>${mi.name}</b>, ${Math.round(mi.lit * 100)}% lit, in ${pos.moon.sign.label}</li>`);
    const sun = E.riseSet('sun', here, new Date(now.getTime() - 6 * 3600e3)), moon = E.riseSet('moon', here, new Date(now.getTime() - 6 * 3600e3));
    if (sun.rise && sun.set) facts.push(`<li>Sunrise ${fmtTime(sun.rise)}, sunset ${fmtTime(sun.set)}</li>`);
    if (moon.rise || moon.set) facts.push(`<li>${moon.rise ? 'Moonrise ' + fmtTime(moon.rise) : ''}${moon.rise && moon.set ? ', ' : ''}${moon.set ? 'moonset ' + fmtTime(moon.set) : ''}</li>`);
    const ph = E.planetaryHour(here, now);
    if (ph) facts.push(`<li>Hour of ${E.B[ph.ruler].label} ${vs(E.B[ph.ruler].glyph)} until ${fmtTime(ph.ends)}</li>`);
    const v = E.voidOfCourse(now);
    facts.push(v.isVoid ? `<li class="ember">Moon void of course until ${fmtDay(v.until)} ${fmtTime(v.until)}, then ${v.nextSign.label}</li>` : `<li>Moon enters ${v.nextSign.label} ${fmtDay(v.until)} ${fmtTime(v.until)}</li>`);
    const retro = E.PLANETS.filter((k) => pos[k].retro).map((k) => E.B[k].label);
    facts.push(retro.length ? `<li class="ember">Retrograde now: ${retro.join(', ')}</li>` : '<li>No planets retrograde right now</li>');
    $('[data-facts]').innerHTML = facts.join('');
    $$('[data-here-name]').forEach((el) => (el.textContent = placeLabel(here)));
  }

  async function events() {
    const now = new Date(), ev = E.upcoming(now, 120).filter((e) => e.type !== 'ingress' || ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].includes(e.body)).slice(0, 14);
    const I = await get('interpretations.json');
    const r = state.reader || (state.reader = R.make(I));
    const items = await Promise.all(ev.map(async (e, i) => {
      const lun = ['new_moon', 'full_moon', 'lunar_eclipse', 'solar_eclipse'].includes(e.type) ? r.lunation(e.type, e.sign) : e.type.startsWith('station') ? (I.retrograde[e.body] || '') : '';
      const glyph = e.type === 'new_moon' ? '\u25CF' : e.type === 'full_moon' ? '\u25CB' : e.type.includes('eclipse') ? '\u25D0' : E.B[e.body].glyph;
      return `<li class="ev"><details${i === 0 ? ' open' : ''}><summary><span class="ev-g">${vs(glyph)}</span><span class="ev-t"><b>${esc(E.eventTitle(e))}</b><small>${fmtDay(e.instant)} &middot; ${countdown(now, e.instant)}</small></span></summary>
        ${lun ? `<p>${esc(lun)}</p>` : ''}<div data-ev-w="${i}"></div></details></li>`;
    }));
    const box = $('[data-sky-events]'); box.innerHTML = items.join('');
    // quotes load as each item opens (and for the first one now)
    const fill = async (i) => { const slot = box.querySelector(`[data-ev-w="${i}"]`); if (slot && !slot.dataset.done) { slot.dataset.done = 1; slot.innerHTML = await witchesHtml(E.eventTopics(ev[i]), ev[i].type.includes('moon') ? ev[i].type.replace('_', ' ') : null, 2); } };
    fill(0);
    box.addEventListener('toggle', (e) => { const d = e.target; if (d.open) fill(+d.querySelector('[data-ev-w]').dataset.evW); }, true);
  }

  function initSky() {
    orrery = V.Orrery($('[data-orrery]'), { onTap: (k) => pick(k === picked ? null : k) });
    drawSky(); tonight(); events();
    const range = $('[data-day]');
    range.addEventListener('input', () => { dayOffset = +range.value; drawSky(); });
    $('[data-now]').addEventListener('click', () => { dayOffset = 0; range.value = 0; playing = false; $('[data-play]').setAttribute('aria-pressed', 'false'); $('[data-play]').innerHTML = '&#9654; Play'; drawSky(); });
    $('[data-play]').addEventListener('click', (e) => {
      playing = !playing; e.currentTarget.setAttribute('aria-pressed', String(playing)); e.currentTarget.innerHTML = playing ? '&#10074;&#10074; Pause' : '&#9654; Play';
      let last = 0;
      const step = (t) => { if (!playing) return; if (t - last > 60) { last = t; dayOffset = dayOffset >= 365 ? -365 : dayOffset + 1; range.value = dayOffset; drawSky(); } requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    setInterval(() => { if (dayOffset === 0 && !document.hidden) { drawSky(); tonight(); } }, 60000);
  }

  /* ---------- location ---------- */
  async function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (p) => {
      const lat = p.coords.latitude, lon = p.coords.longitude;
      const places = await placesDb();
      let best = null, bd = 1e9;
      for (const r of places.p) { const d = (r[3] - lat) ** 2 + ((r[4] - lon) * Math.cos((lat * Math.PI) / 180)) ** 2; if (d < bd) { bd = d; best = r; } }
      state.here = { name: best ? best[0] : 'Here', region: best ? best[1] : '', country: best ? best[2] : '', lat, lon, zone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      persist(); tonight(); events(); if (finder) finder.place = state.here;
    }, () => { $$('[data-locate]').forEach((b) => (b.textContent = 'Location not allowed')); }, { maximumAge: 600000, timeout: 15000 });
  }
  $$('[data-locate]').forEach((b) => b.addEventListener('click', locate));

  /* ---------- places ---------- */
  const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[øœ]/g, 'o').replace(/æ/g, 'ae').replace(/ß/g, 'ss').replace(/ł/g, 'l').replace(/đ/g, 'd').replace(/ı/g, 'i');
  function placesDb() {
    return (state.places ||= get('places.json').then((d) => { d.f = d.p.map((r) => fold(r[0])); return d; }));
  }
  function wirePlaces(form) {
    const input = form.querySelector('[name=place]'), list = form.querySelector('[data-places]');
    let items = [], active = -1;
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
    const choose = (i) => {
      const r = items[i]; if (!r) return;
      form._place = { name: r[0], region: r[1], country: r[2], lat: r[3], lon: r[4], zone: r.tz };
      input.value = placeLabel(form._place); close(); form.dispatchEvent(new Event('placechange'));
    };
    input.addEventListener('input', async () => {
      form._place = null; form.dispatchEvent(new Event('placechange'));
      const q = fold(input.value.trim()); if (q.length < 2) { close(); return; }
      const d = await placesDb(), words = q.split(/[\s,]+/).filter(Boolean), first = words[0], rest = words.slice(1);
      items = [];
      for (let i = 0; i < d.p.length && items.length < 8; i++) {
        if (!d.f[i].startsWith(first)) continue;
        const r = d.p[i], extra = fold(r[1] + ' ' + r[2]);
        if (rest.every((w) => d.f[i].includes(w) || extra.includes(w))) items.push(Object.assign(r.slice(), { tz: d.tz[r[5]] }));
      }
      list.innerHTML = items.length ? items.map((r, i) => `<li role="option" id="${list.id}-${i}" data-i="${i}">${esc(r[0])}<small>${esc([r[1], r[2]].filter(Boolean).join(', '))}</small></li>`).join('') : '<li class="muted">No town by that name. Try a nearby bigger town.</li>';
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
    });
    input.addEventListener('keydown', (e) => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); active = (active + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % Math.max(1, items.length); $$('li', list).forEach((li, i) => li.classList.toggle('on', i === active)); input.setAttribute('aria-activedescendant', `${list.id}-${active}`); }
      if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
      if (e.key === 'Escape') close();
    });
    list.addEventListener('mousedown', (e) => { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); choose(+li.dataset.i); } });
    input.addEventListener('blur', () => setTimeout(close, 150));
    const nt = form.querySelector('[name=notime]'), tm = form.querySelector('[name=time]');
    nt.addEventListener('change', () => { tm.disabled = nt.checked; const n = form.querySelector('[data-notime-note]'); if (n) n.hidden = !nt.checked; });
  }
  function readForm(form) {
    const f = new FormData(form), p = form._place;
    if (!p) { form.querySelector('[name=place]').focus(); form.querySelector('[name=place]').setCustomValidity('Pick a town from the list'); form.querySelector('[name=place]').reportValidity(); return null; }
    form.querySelector('[name=place]').setCustomValidity('');
    const notime = f.get('notime') === 'on', time = notime ? null : f.get('time') || null;
    if (!notime && !time) { form.querySelector('[name=time]').setCustomValidity('Enter a time, or tick "don\'t know"'); form.querySelector('[name=time]').reportValidity(); return null; }
    form.querySelector('[name=time]').setCustomValidity('');
    return { name: String(f.get('name') || '').trim(), date: f.get('date'), time, place: p };
  }
  function fillForm(form, b) {
    if (!b) return;
    form.querySelector('[name=name]').value = b.name || ''; form.querySelector('[name=date]').value = b.date;
    form.querySelector('[name=time]').value = b.time || ''; form.querySelector('[name=notime]').checked = !b.time; form.querySelector('[name=time]').disabled = !b.time;
    form.querySelector('[name=place]').value = placeLabel(b.place); form._place = b.place;
  }

  /* ---------- YOUR CHART ---------- */
  let wheel = null;
  const birthForm = $('[data-birth]');
  wirePlaces(birthForm);
  const tzNote = () => {
    const f = new FormData(birthForm), p = birthForm._place, box = $('[data-tz]');
    if (!p || !f.get('date')) { box.hidden = true; return; }
    const t = E.localToUtc(f.get('date'), f.get('time') || '12:00', p.zone), off = -new Date(t).getTimezoneOffset() * 0 + E.zoneOffsetMin(p.zone, t);
    const sign = off >= 0 ? '+' : '-', a = Math.abs(off);
    box.hidden = false;
    box.innerHTML = `<b>Check the time zone.</b> On that date ${esc(p.name)} was on ${esc(E.zoneLabel(p.zone, t))} (UTC${sign}${Math.floor(a / 60)}${a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''}), from the official time zone database. Daylight saving is handled for you.`;
  };
  birthForm.addEventListener('placechange', tzNote);
  birthForm.addEventListener('input', (e) => { if (e.target.name === 'date' || e.target.name === 'time') tzNote(); });
  birthForm.addEventListener('submit', (e) => { e.preventDefault(); const b = readForm(birthForm); if (!b) return; state.me = b; persist(); castChart(); });
  $('[data-forget]').addEventListener('click', () => { try { localStorage.removeItem(STORE); } catch (x) { /* */ } state.me = null; state.partner = null; birthForm.reset(); birthForm._place = null; $('[data-chart-out]').hidden = true; birthForm.hidden = false; $('[data-tz]').hidden = true; });
  $('[data-edit]').addEventListener('click', () => { birthForm.hidden = false; birthForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('[data-houses]').addEventListener('click', () => { state.system = state.system === 'placidus' ? 'whole' : 'placidus'; persist(); castChart(); });
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => {
    const three = b.dataset.view === '3d';
    $$('[data-view]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    if (wheel) wheel.setThreeD(three);
    $('[data-hit]').hidden = true;
  }));

  async function castChart() {
    const b = state.me; if (!b) return;
    const I = await get('interpretations.json'); state.reader ||= R.make(I);
    const c = (state.chart = E.chart(b, state.system));
    birthForm.hidden = true; $('[data-chart-out]').hidden = false;
    $('[data-chart-kicker]').textContent = b.name ? `${b.name}'s chart` : 'Your chart';
    $('[data-chart-title]').innerHTML = `${c.pos.sun.sign.label} Sun &middot; ${c.pos.moon.sign.label} Moon${c.ascSign ? ' &middot; ' + c.ascSign.label + ' rising' : ''}`;
    const d = new Date(b.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const tm = b.time ? new Date('2000-01-01T' + b.time + ':00Z').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) : 'time unknown';
    $('[data-chart-sub]').textContent = `${d} \u00B7 ${tm} \u00B7 ${placeLabel(b.place)}`;
    $('[data-houses]').textContent = c.houseSystem === 'whole' ? 'Whole Sign houses' : 'Placidus houses';
    $('[data-houses]').hidden = !c.cusps;
    if (wheel) wheel.stop();
    const cv = $('[data-natal]'), fresh = cv.cloneNode(false); cv.replaceWith(fresh);
    wheel = V.ChartWheel(fresh, c, { onHit: explain });
    $$('[data-view]').forEach((x) => { x.classList.toggle('on', x.dataset.view === '2d'); x.setAttribute('aria-pressed', String(x.dataset.view === '2d')); });
    table(c); reading(c);
    $('[data-chart-out]').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function table(c) {
    const rows = E.BODIES.map((b) => { const p = c.pos[b.key], h = c.house(b.key); return `<tr${p.retro ? ' class="ember"' : ''}><td>${vs(b.glyph)}</td><td>${b.label}</td><td>${vs(p.sign.glyph)} ${E.fmtDeg(p.degInSign)} ${p.sign.label}${p.retro ? ' \u211E' : ''}</td><td>${h ? E.ordinal(h) : ''}</td></tr>`; }).join('');
    const ang = c.cusps ? `<tr><td class="gold">AC</td><td>Ascendant</td><td>${E.fmtDeg(E.norm(c.asc) % 30)} ${c.ascSign.label}</td><td></td></tr><tr><td class="gold">MC</td><td>Midheaven</td><td>${E.fmtDeg(E.norm(c.mc) % 30)} ${c.mcSign.label}</td><td></td></tr>` : '';
    const el = c.balance((x) => x.element), tot = Object.values(el).reduce((a, b) => a + b, 0) || 1;
    const bars = ['Fire', 'Earth', 'Air', 'Water'].map((e) => `<div class="bar"><span>${e}</span><i style="--w:${Math.round(((el[e] || 0) * 100) / tot)}%" class="el-${e.toLowerCase()}"></i><b>${el[e] || 0}</b></div>`).join('');
    $('[data-table]').innerHTML = `<table class="ptable"><thead><tr><th></th><th>Point</th><th>Position</th><th>House</th></tr></thead><tbody>${rows}${ang}</tbody></table>
      ${c.placidusFallback ? '<p class="fine">Born above the polar circle, where Placidus houses break down, so Whole Sign houses are used.</p>' : ''}
      <p class="kicker" style="margin-top:1.2em">Elements</p><div class="bars">${bars}</div>`;
  }

  async function reading(c) {
    const rd = state.reader.compose(c, new Date()), box = $('[data-reading]');
    box.innerHTML = `<div class="reading-head panel"><p class="kicker">Your reading</p><p class="reading-sum">${esc(rd.summary)}</p><p class="fine">${rd.sections.length} sections, each followed by what Laylla and Chelle have said on the show. Tap a quote to hear it from that moment.</p>
      <nav class="toc">${rd.sections.map((s) => `<a href="#rd-${s.id}">${vs(s.glyph)} ${esc(s.title)}</a>`).join('')}</nav></div>` +
      rd.sections.map((s) => `<section class="rd" id="rd-${s.id}"><p class="kicker">${esc(s.kicker)}</p><h3><span class="rd-g">${vs(s.glyph)}</span>${esc(s.title)}</h3>${s.body.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}<div data-w="${s.id}"></div></section>`).join('');
    box._rd = rd;
    // load each section's quotes when it scrolls near (keeps the page fast)
    const io = new IntersectionObserver((es) => es.forEach(async (en) => {
      if (!en.isIntersecting) return; io.unobserve(en.target);
      const s = rd.sections.find((x) => x.id === en.target.dataset.w); en.target.innerHTML = await witchesHtml(s.topics, s.pair);
    }), { rootMargin: '400px' });
    $$('[data-w]', box).forEach((el) => io.observe(el));
  }

  async function explain(hit) {
    const I = await get('interpretations.json'), c = state.chart, box = $('[data-hit]');
    let h = '';
    if (hit.type === 'planet') {
      const p = c.pos[hit.key], hs = c.house(hit.key);
      h = `<p class="kicker">${vs(E.B[hit.key].glyph)} ${E.B[hit.key].label}</p><h3>${E.B[hit.key].label} in ${p.sign.label}${hs ? ', ' + E.ordinal(hs) + ' house' : ''}</h3><p>${esc(state.reader.planetInSign(hit.key, p.sign))}</p><a href="#rd-${hit.key === 'sun' || hit.key === 'moon' ? hit.key : hit.key === 'node' ? 'node' : hit.key}">Read more in your reading &rsaquo;</a>`;
      wheel.highlight(hit.key);
    } else if (hit.type === 'house') {
      const hj = I.houses[String(hit.n)];
      h = `<p class="kicker">The ${E.ordinal(hit.n)} house</p><h3>${esc(hj.title)}</h3><p>${esc(hj.text)}</p>`;
    } else if (hit.type === 'aspect') {
      const a = hit.aspect;
      h = `<p class="kicker">${vs(E.B[a.a].glyph)} ${vs(a.type.glyph)} ${vs(E.B[a.b].glyph)} orb ${E.fmtDeg(a.orb)}</p><h3>${E.B[a.a].label} ${a.type.label.toLowerCase()} ${E.B[a.b].label}</h3><p>${esc(state.reader.aspectText(a.a, a.b, a.type))}</p>`;
    } else if (hit.type === 'sign') {
      const s = hit.sign, sj = I.signs[s.key];
      h = `<p class="kicker">${vs(s.glyph)} ${s.dates}</p><h3>${s.label}</h3><p>\u201C${esc(sj.motto)}\u201D ${esc(sj.keywords.join(', '))}.</p><button type="button" class="linkish" data-open-sign="${s.key}">Open the ${s.label} page &rsaquo;</button>`;
    }
    box.innerHTML = `<button type="button" class="hit-x" aria-label="Close">&times;</button>${h}`; box.hidden = false;
    box.querySelector('.hit-x').addEventListener('click', () => { box.hidden = true; wheel.highlight(null); });
  }

  $('[data-sky-print]').addEventListener('click', () => window.print());
  $('[data-sky-copy]').addEventListener('click', async (e) => {
    const rd = $('[data-reading]')._rd; if (!rd) return;
    const txt = `${rd.name || 'My'} birth chart reading\n\n${rd.summary}\n\n` + rd.sections.map((s) => `${s.title}\n\n${s.body}`).join('\n\n') + '\n\nFrom the Back on the Broomstick Sky page. Astrology is a mirror, not a sentence.';
    try { await navigator.clipboard.writeText(txt); e.target.textContent = 'Copied'; setTimeout(() => (e.target.textContent = 'Copy my reading'), 2000); } catch (x) { e.target.textContent = 'Copy failed'; }
  });

  /* ---------- SIGNS ---------- */
  const TAROT = { aries: ['emperor', 'The Emperor'], taurus: ['hierophant', 'The Hierophant'], gemini: ['lovers', 'The Lovers'], cancer: ['chariot', 'The Chariot'], leo: ['strength', 'Strength'], virgo: ['hermit', 'The Hermit'], libra: ['justice', 'Justice'], scorpio: ['death', 'Death'], sagittarius: ['temperance', 'Temperance'], capricorn: ['devil', 'The Devil'], aquarius: ['star', 'The Star'], pisces: ['moon', 'The Moon'] };
  $('[data-sign-strip]').innerHTML = E.SIGNS.map((s) => `<button type="button" role="listitem" class="sign-chip el-${s.element.toLowerCase()}" data-sign="${s.key}" aria-label="${s.label}">${i3d(s)}<small>${s.label}</small></button>`).join('');
  $('[data-sign-strip]').addEventListener('click', (e) => { const b = e.target.closest('[data-sign]'); if (b) renderSign(E.SIGNS.find((s) => s.key === b.dataset.sign)); });
  async function renderSign(s) {
    const I = await get('interpretations.json'), sj = I.signs[s.key], t = TAROT[s.key];
    $$('[data-sign]').forEach((b) => b.classList.toggle('on', b.dataset.sign === s.key));
    const rulers = s.key === 'scorpio' ? 'Mars and Pluto' : s.key === 'aquarius' ? 'Saturn and Uranus' : s.key === 'pisces' ? 'Jupiter and Neptune' : E.B[s.ruler].label;
    const prev = E.SIGNS[(s.i + 11) % 12], next = E.SIGNS[(s.i + 1) % 12];
    const list = (k, title) => sj[k] ? `<div><p class="kicker">${title}</p><p>${esc(Array.isArray(sj[k]) ? sj[k].join(', ') : sj[k])}</p></div>` : '';
    $('[data-sign-page]').innerHTML = `<div class="sign-top"><span class="sign-big el-${s.element.toLowerCase()}">${i3d(s)}</span><div><p class="kicker">${s.dates}</p><h2 class="astro-h">${s.label}</h2>
      <p class="muted">${s.element} &middot; ${s.modality} &middot; ruled by ${rulers}</p><p class="sign-motto">\u201C${esc(sj.motto)}\u201D</p></div></div>
      <div class="sign-body"><div>${sj.profile.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}${sj.body ? `<p>${esc(sj.body)}</p>` : ''}
      ${sj.shadow ? `<p class="kicker ember-k">When it's out of balance</p><p>${esc(sj.shadow)}</p>` : ''}</div>
      <aside class="sign-side"><figure class="sign-tarot"><img src="${url('/assets/img/tarot/' + t[0] + '.webp')}" alt="${esc(t[1])}" loading="lazy" width="150" height="260"><figcaption><small>Tarot</small>${esc(t[1])}${typeof sj.tarot === 'string' && sj.tarot.toLowerCase() !== String(t[1]).toLowerCase() && sj.tarot.toLowerCase() !== t[0] ? `<span>${esc(sj.tarot)}</span>` : ''}</figcaption></figure>
      ${list('keywords', 'Keywords')}${list('crystals', 'Crystals')}${list('herbs', 'Herbs')}${list('colours', 'Colours')}</aside></div>
      <div data-sign-w></div>
      <p class="sign-nav"><button type="button" class="linkish" data-sign-go="${prev.key}">&lsaquo; ${prev.label}</button><button type="button" class="linkish" data-sign-go="${next.key}">${next.label} &rsaquo;</button></p>`;
    $('[data-sign-w]').innerHTML = await witchesHtml([s.key, 'astrology'], 'sun', 3);
  }
  root.addEventListener('click', (e) => { const g = e.target.closest('[data-sign-go]'); if (g) renderSign(E.SIGNS.find((s) => s.key === g.dataset.signGo)); });

  /* ---------- COMPATIBILITY ---------- */
  const partnerForm = $('[data-partner]');
  wirePlaces(partnerForm);
  partnerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.me) { show('chart', true); birthForm.querySelector('[name=date]').focus(); return; }
    const b = readForm(partnerForm); if (!b) return;
    state.partner = b; persist();
    const I = await get('interpretations.json'); state.reader ||= R.make(I);
    const rd = state.reader.synastry(E.chart(state.me), E.chart(b)), box = $('[data-match-out]');
    box.innerHTML = `<div class="reading-head panel"><p class="kicker">Together</p><h2 class="astro-h">${esc(rd.name)}</h2><p class="reading-sum">${esc(rd.summary)}</p></div>` +
      rd.sections.map((s, i) => `<section class="rd"><p class="kicker">${esc(s.kicker)}</p><h3><span class="rd-g">${vs(s.glyph)}</span>${esc(s.title)}</h3><p>${esc(s.body)}</p>${i === 0 ? '<div data-mw></div>' : ''}</section>`).join('');
    $('[data-mw]').innerHTML = await witchesHtml(['astrology', 'natal_chart'], null, 3);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- SKY FINDER ---------- */
  let finder = null;
  function startFinder() {
    if (finder) return;
    const cv = $('[data-finder]'), hud = $('[data-finder-hud]');
    finder = { place: state.here, az: 180, alt: 14, fov: 90, sensor: false };
    // open facing the brightest thing above the horizon (Moon if up, else the Sun's side), horizon in the lower third
    { const now0 = new Date(); const up = ['moon', 'sun', 'venus', 'jupiter', 'mars', 'saturn'].map((k) => [k, E.horizon(k, state.here, now0)]).find(([, hz]) => hz && hz.alt > 5);
      const ref = up ? up[1] : E.horizon('sun', state.here, now0); finder.az = ref.az; finder.alt = 14; }
    const fstars = []; { let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); for (let i = 0; i < 420; i++) fstars.push([rnd() * 360, Math.asin(rnd() * 2 - 1) * 57.3, 0.2 + rnd() * 0.8]); }
    const toScreen = (az, alt, w, h) => {
      // simple gnomonic-ish view: horizontal offset by azimuth difference, vertical by altitude difference
      let daz = ((az - finder.az + 540) % 360) - 180;
      const k = w / finder.fov; return [w / 2 + daz * k, h / 2 - (alt - finder.alt) * k, Math.abs(daz) < finder.fov];
    };
    function draw() {
      const dpr = Math.min(2, devicePixelRatio || 1), rect = cv.getBoundingClientRect(), w = rect.width, h = rect.height;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      const hy = toScreen(finder.az, 0, w, h)[1];
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, V.colors.bg); sky.addColorStop(1, V.colors.plate0 || '#0B0F18'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      for (const st of fstars) { const p = toScreen(st[0], st[1], w, h); if (p[2] && p[1] < hy) { g.fillStyle = `rgba(255,255,255,${0.15 + 0.55 * st[2]})`; g.beginPath(); g.arc(p[0], p[1], 0.5 + st[2], 0, Math.PI * 2); g.fill(); } }
      // altitude rings every 30 degrees, faint
      g.setLineDash([2, 6]); g.strokeStyle = 'rgba(156,196,255,0.22)'; g.lineWidth = 1;
      for (const a of [30, 60]) { const y = toScreen(finder.az, a, w, h)[1]; if (y > 0 && y < h) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.font = "10px Inter, sans-serif"; g.fillStyle = V.colors.muted; g.textAlign = 'left'; g.fillText(a + '\u00B0', 6, y - 4); } }
      g.setLineDash([]);
      const ground = g.createLinearGradient(0, hy, 0, h); ground.addColorStop(0, 'rgba(26,18,10,0.92)'); ground.addColorStop(1, 'rgba(8,6,4,0.97)');
      g.fillStyle = ground; g.fillRect(0, hy, w, h - hy);
      g.font = "10px Inter, sans-serif"; g.fillStyle = V.colors.muted; g.textAlign = 'left'; if (hy < h - 30) g.fillText('BELOW THE HORIZON', 8, h - 10);
      g.strokeStyle = V.colors.gold; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, hy); g.lineTo(w, hy); g.stroke();
      for (let a = 0; a < 360; a += 15) { const p = toScreen(a, 0, w, h); if (!p[2]) continue; g.strokeStyle = V.colors.gold; g.beginPath(); g.moveTo(p[0], hy); g.lineTo(p[0], hy + (a % 45 ? 5 : 10)); g.stroke(); }
      [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]].forEach(([t, a]) => { const p = toScreen(a, 0, w, h); if (p[2]) { g.font = "600 13px Inter, sans-serif"; g.fillStyle = V.colors.gold; g.textAlign = 'center'; g.fillText(t, p[0], hy + 24); } });
      const now = new Date(); let best = null, bd = 1e9;
      for (const b of E.BODIES) {
        if (b.key === 'node') continue;
        const hz = E.horizon(b.key, finder.place, now); if (!hz) continue;
        const p = toScreen(hz.az, hz.alt, w, h); if (!p[2]) continue;
        const below = hz.alt < 0, r = b.key === 'sun' ? 13 : b.key === 'moon' ? 11 : 7;
        g.globalAlpha = below ? 0.45 : 1;
        const grd = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 2.4); grd.addColorStop(0, V.colors.body[b.key]); grd.addColorStop(0.4, V.colors.body[b.key]); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(p[0], p[1], r * 2.4, 0, Math.PI * 2); g.fill();
        g.font = "15px 'Astro Glyphs', serif"; g.fillStyle = V.colors.text; g.textAlign = 'center'; g.fillText(b.glyph + '\uFE0E', p[0], p[1] - r - 8);
        g.font = "11px Inter, sans-serif"; g.fillStyle = V.colors.muted; g.fillText(b.label + (below ? ' (below)' : ''), p[0], p[1] + r + 16);
        g.globalAlpha = 1;
        const d = (p[0] - w / 2) ** 2 + (p[1] - h / 2) ** 2; if (d < bd) { bd = d; best = { b, hz }; }
      }
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(w / 2, h / 2, 16, 0, Math.PI * 2); g.stroke();
      if (best && bd < 120 * 120) {
        const pos = E.position(best.b.key, now), dir = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(best.hz.az / 45) % 8];
        hud.innerHTML = `<b>${vs(best.b.glyph)} ${best.b.label} in ${pos.sign.label}</b> ${E.fmtDeg(pos.degInSign)}${pos.retro ? ' &middot; retrograde' : ''} &middot; ${Math.abs(Math.round(best.hz.alt))}&deg; ${best.hz.alt >= 0 ? 'above' : 'below'} the horizon, toward the ${dir}`;
      } else hud.textContent = `Looking ${Math.round(finder.az)}\u00B0, ${Math.round(finder.alt)}\u00B0 up. ${finder.sensor ? '' : 'Drag to look around.'}`;
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (!drag || finder.sensor) return; const k = finder.fov / cv.clientWidth; finder.az = (finder.az - (e.clientX - drag[0]) * k + 360) % 360; finder.alt = Math.max(-80, Math.min(85, finder.alt + (e.clientY - drag[1]) * k)); drag = [e.clientX, e.clientY]; });
    cv.addEventListener('pointerup', () => (drag = null));
    cv.addEventListener('keydown', (e) => { const d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key]; if (d) { e.preventDefault(); finder.az = (finder.az + d[0] + 360) % 360; finder.alt = Math.max(-80, Math.min(85, finder.alt + d[1])); } });
    $('[data-sensors]').addEventListener('click', async (e) => {
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') throw new Error('denied'); }
        const on = (ev) => {
          const heading = ev.webkitCompassHeading != null ? ev.webkitCompassHeading : ev.absolute && ev.alpha != null ? (360 - ev.alpha) % 360 : null;
          if (heading == null || ev.beta == null) return;
          finder.sensor = true; finder.az = heading; finder.alt = Math.max(-80, Math.min(85, ev.beta - 90));
        };
        window.addEventListener('deviceorientationabsolute', on); window.addEventListener('deviceorientation', on);
        e.target.textContent = 'Compass on: hold your phone up';
        setTimeout(() => { if (!finder.sensor) e.target.textContent = 'No compass on this device: drag instead'; }, 2500);
      } catch (x) { e.target.textContent = 'Compass not allowed: drag instead'; }
    });
  }

  /* ---------- start ---------- */
  initSky();
  if (state.me) { fillForm(birthForm, state.me); $('[name=remember]').checked = true; castChart().then(() => { if (location.hash !== '#chart') $('[data-chart-out]').scrollIntoView = () => {}; }); }
  if (state.partner) fillForm(partnerForm, state.partner);
  const h = location.hash.slice(1);
  if (['sky', 'chart', 'signs', 'match', 'finder'].includes(h)) show(h, false);
  const sg = E.SIGNS.find((s) => s.key === h);
  if (sg) { show('signs', false); renderSign(sg); }
})();
