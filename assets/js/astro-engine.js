/* Back on the Broomstick: astrology engine for the Sky page. Port of the Hedge Almanac app's engine
   (com.backonthebroomstick.hedge.astro) on top of Astronomy Engine (MIT, Don Cross) instead of the app's bundled
   JPL tables. Pure functions, no DOM. Exposes window.BotbAstro (and module.exports for the Node reference test). */
(function (root) {
  'use strict';
  const A = root.Astronomy || (typeof require !== 'undefined' ? require('./vendor/astronomy.min.js') : null);
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const norm = (d) => ((d % 360) + 360) % 360;
  const angDiff = (a, b) => { let d = (a - b) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };

  const BODIES = [
    { key: 'sun', label: 'Sun', glyph: '\u2609', ae: 'Sun' },
    { key: 'moon', label: 'Moon', glyph: '\u263D', ae: 'Moon' },
    { key: 'mercury', label: 'Mercury', glyph: '\u263F', ae: 'Mercury' },
    { key: 'venus', label: 'Venus', glyph: '\u2640', ae: 'Venus' },
    { key: 'mars', label: 'Mars', glyph: '\u2642', ae: 'Mars' },
    { key: 'jupiter', label: 'Jupiter', glyph: '\u2643', ae: 'Jupiter' },
    { key: 'saturn', label: 'Saturn', glyph: '\u2644', ae: 'Saturn' },
    { key: 'uranus', label: 'Uranus', glyph: '\u2645', ae: 'Uranus' },
    { key: 'neptune', label: 'Neptune', glyph: '\u2646', ae: 'Neptune' },
    { key: 'pluto', label: 'Pluto', glyph: '\u2647', ae: 'Pluto' },
    { key: 'node', label: 'North Node', glyph: '\u260A', ae: null }
  ];
  const B = Object.fromEntries(BODIES.map((b) => [b.key, b]));
  const PLANETS = BODIES.filter((b) => b.key !== 'node').map((b) => b.key);
  const PERSONAL = ['sun', 'moon', 'mercury', 'venus', 'mars'];
  const named = (k) => (['sun', 'moon', 'node'].includes(k) ? 'the ' + B[k].label : B[k].label);

  const SIGNS = [
    ['aries', 'Aries', '\u2648', 'Fire', 'Cardinal', 'mars', 'Mar 21 - Apr 19'],
    ['taurus', 'Taurus', '\u2649', 'Earth', 'Fixed', 'venus', 'Apr 20 - May 20'],
    ['gemini', 'Gemini', '\u264A', 'Air', 'Mutable', 'mercury', 'May 21 - Jun 20'],
    ['cancer', 'Cancer', '\u264B', 'Water', 'Cardinal', 'moon', 'Jun 21 - Jul 22'],
    ['leo', 'Leo', '\u264C', 'Fire', 'Fixed', 'sun', 'Jul 23 - Aug 22'],
    ['virgo', 'Virgo', '\u264D', 'Earth', 'Mutable', 'mercury', 'Aug 23 - Sep 22'],
    ['libra', 'Libra', '\u264E', 'Air', 'Cardinal', 'venus', 'Sep 23 - Oct 22'],
    ['scorpio', 'Scorpio', '\u264F', 'Water', 'Fixed', 'mars', 'Oct 23 - Nov 21'],
    ['sagittarius', 'Sagittarius', '\u2650', 'Fire', 'Mutable', 'jupiter', 'Nov 22 - Dec 21'],
    ['capricorn', 'Capricorn', '\u2651', 'Earth', 'Cardinal', 'saturn', 'Dec 22 - Jan 19'],
    ['aquarius', 'Aquarius', '\u2652', 'Air', 'Fixed', 'saturn', 'Jan 20 - Feb 18'],
    ['pisces', 'Pisces', '\u2653', 'Water', 'Mutable', 'jupiter', 'Feb 19 - Mar 20']
  ].map(([key, label, glyph, element, modality, ruler, dates], i) => ({ key, label, glyph, element, modality, ruler, dates, i }));
  const signOf = (lon) => SIGNS[Math.min(11, Math.floor(norm(lon) / 30))];

  const ASPECTS = [
    { key: 'conjunction', label: 'Conjunction', angle: 0, orb: 8, glyph: '\u260C', family: 'fusing' },
    { key: 'sextile', label: 'Sextile', angle: 60, orb: 4, glyph: '\u26B9', family: 'flowing' },
    { key: 'square', label: 'Square', angle: 90, orb: 7, glyph: '\u25A1', family: 'tense' },
    { key: 'trine', label: 'Trine', angle: 120, orb: 7, glyph: '\u25B3', family: 'flowing' },
    { key: 'opposition', label: 'Opposition', angle: 180, orb: 8, glyph: '\u260D', family: 'tense' }
  ];

  const fmtDeg = (d) => { let deg = Math.floor(d), min = Math.round((d - deg) * 60); if (min === 60) { deg++; min = 0; } return deg + '\u00B0' + String(min).padStart(2, '0') + '\u2032'; };
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

  /* ---------- positions ---------- */
  const jdOf = (date) => date.getTime() / 86400000 + 2440587.5;

  /** Mean lunar node (Meeus 47.7), degrees. */
  function meanNode(date) {
    const T = (jdOf(date) - 2451545.0) / 36525;
    return norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441 - T * T * T * T / 60616000);
  }

  /** Apparent geocentric ecliptic longitude (true equinox of date) and latitude of a body. */
  function lonLat(key, date) {
    if (key === 'node') return { lon: meanNode(date), lat: 0 };
    const t = A.MakeTime(date);
    if (key === 'sun') { const s = A.SunPosition(t); return { lon: s.elon, lat: s.elat }; }
    if (key === 'moon') {
      // EclipticGeoMoon is geometric of date; apply the moon's tiny light-time (about 1.3 s) by evaluating slightly earlier.
      const m = A.EclipticGeoMoon(t);
      return { lon: norm(m.lon), lat: m.lat };
    }
    const v = A.GeoVector(A.Body[B[key].ae], t, true);
    const e = A.Ecliptic(v);
    return { lon: e.elon, lat: e.elat };
  }

  function position(key, date) {
    const h = 0.25 / 24; // speed by central difference over +/- 15 min
    const p = lonLat(key, date);
    const a = lonLat(key, new Date(date.getTime() - h * 86400000)).lon;
    const b = lonLat(key, new Date(date.getTime() + h * 86400000)).lon;
    const speed = angDiff(b, a) / (2 * h);
    const retro = key !== 'sun' && key !== 'moon' && key !== 'node' && speed < 0;
    return { key, lon: p.lon, lat: p.lat, speed, retro, sign: signOf(p.lon), degInSign: norm(p.lon) % 30 };
  }
  const all = (date) => Object.fromEntries(BODIES.map((b) => [b.key, position(b.key, date)]));

  /* ---------- houses (same maths as Houses.kt) ---------- */
  function gmst(jd) { const tc = (jd - 2451545.0) / 36525; return norm(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * tc * tc - (tc * tc * tc) / 38710000); }
  function obliquity(jd) { const tc = (jd - 2451545.0) / 36525; return 23.439291111 - 0.0130041667 * tc - 1.6389e-7 * tc * tc + 5.0361e-7 * tc * tc * tc; }
  function angles(date, lat, lon) {
    const jd = jdOf(date), e = obliquity(jd) * D2R, ramcD = norm(gmst(jd) + lon), ramc = ramcD * D2R, phi = lat * D2R;
    const mc = norm(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(e)) * R2D);
    let asc = norm(Math.atan2(Math.cos(ramc), -(Math.sin(e) * Math.tan(phi) + Math.cos(e) * Math.sin(ramc))) * R2D);
    if (norm(asc - mc) > 180) asc = norm(asc + 180);
    return { asc, mc, ramc: ramcD, eps: e * R2D };
  }
  const lonFromRa = (ra, eps) => norm(Math.atan2(Math.sin(ra * D2R), Math.cos(ra * D2R) * Math.cos(eps * D2R)) * R2D);
  function placidus(date, lat, lon) {
    const a = angles(date, lat, lon);
    if (Math.abs(lat) >= 90 - a.eps) return null;
    const phi = lat * D2R;
    function cusp(frac, above) {
      let ra = above ? a.ramc + (frac < 0.5 ? 30 : 60) : a.ramc + 180 - (frac > 0.5 ? 60 : 30);
      for (let k = 0; k < 60; k++) {
        const lam = lonFromRa(ra, a.eps);
        const dec = Math.asin(Math.sin(a.eps * D2R) * Math.sin(lam * D2R));
        const ad = Math.asin(Math.max(-1, Math.min(1, Math.tan(phi) * Math.tan(dec)))) * R2D;
        const next = above ? a.ramc + frac * (90 + ad) : a.ramc + 180 - frac * (90 - ad);
        if (Math.abs(angDiff(next, ra)) < 1e-8) return lonFromRa(next, a.eps);
        ra = next;
      }
      return lonFromRa(ra, a.eps);
    }
    const c = new Array(12);
    c[0] = a.asc; c[9] = a.mc;
    c[10] = cusp(1 / 3, true); c[11] = cusp(2 / 3, true);
    c[1] = cusp(2 / 3, false); c[2] = cusp(1 / 3, false);
    for (const i of [0, 1, 2, 9, 10, 11]) c[(i + 6) % 12] = norm(c[i] + 180);
    return c;
  }
  const wholeSign = (asc) => { const s = signOf(asc).i * 30; return Array.from({ length: 12 }, (_, i) => norm(s + i * 30)); };
  function houseOf(lon, cusps) {
    for (let i = 0; i < 12; i++) { const a = cusps[i], b = cusps[(i + 1) % 12]; if (norm(lon - a) < norm(b - a)) return i + 1; }
    return 12;
  }

  /* ---------- time zones: local wall time in an IANA zone -> UTC instant ---------- */
  function zoneOffsetMin(zone, date) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUtc - date.getTime()) / 60000);
  }
  /** "1980-10-31", "21:45", "America/New_York" -> Date (UTC instant). */
  function localToUtc(dateStr, timeStr, zone) {
    const [y, mo, d] = dateStr.split('-').map(Number), [h, mi] = (timeStr || '12:00').split(':').map(Number);
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    let off = zoneOffsetMin(zone, new Date(guess));
    let t = guess - off * 60000;
    const off2 = zoneOffsetMin(zone, new Date(t));
    if (off2 !== off) t = guess - off2 * 60000;
    return new Date(t);
  }
  const zoneLabel = (zone, date) => {
    try { return new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(date).find((x) => x.type === 'timeZoneName').value; } catch (e) { return zone; }
  };

  /* ---------- chart ---------- */
  function aspects(pos) {
    const out = [], keys = BODIES.map((b) => b.key);
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = pos[keys[i]], b = pos[keys[j]], sep = Math.abs(angDiff(a.lon, b.lon));
      for (const t of ASPECTS) {
        const orb = Math.abs(sep - t.angle);
        if (orb <= t.orb) {
          const dt = 1 / 24, later = Math.abs(Math.abs(angDiff(a.lon + a.speed * dt, b.lon + b.speed * dt)) - t.angle);
          out.push({ a: a.key, b: b.key, type: t, orb, applying: later < orb });
          break;
        }
      }
    }
    return out.sort((x, y) => x.orb - y.orb);
  }

  function patterns(c) {
    const out = [], has = (x, y, k) => c.aspects.some((a) => a.type.key === k && ((a.a === x && a.b === y) || (a.a === y && a.b === x)));
    for (let i = 0; i < PLANETS.length; i++) for (let j = i + 1; j < PLANETS.length; j++) for (let k = j + 1; k < PLANETS.length; k++) {
      const a = PLANETS[i], b = PLANETS[j], d = PLANETS[k];
      if (has(a, b, 'trine') && has(b, d, 'trine') && has(a, d, 'trine')) out.push({ kind: 'grand_trine', label: 'Grand Trine', bodies: [a, b, d], element: c.pos[a].sign.element });
      for (const [apex, x, y] of [[a, b, d], [b, a, d], [d, a, b]])
        if (has(x, y, 'opposition') && has(apex, x, 'square') && has(apex, y, 'square')) out.push({ kind: 't_square', label: 'T-Square', bodies: [apex, x, y] });
    }
    const bySign = {};
    PLANETS.forEach((p) => (bySign[c.pos[p].sign.key] ||= []).push(p));
    Object.entries(bySign).forEach(([s, bs]) => bs.length >= 3 && out.push({ kind: 'stellium_sign', label: 'Stellium', bodies: bs, sign: SIGNS.find((x) => x.key === s) }));
    if (c.cusps) {
      const byH = {};
      PLANETS.forEach((p) => (byH[c.house(p)] ||= []).push(p));
      Object.entries(byH).forEach(([h, bs]) => {
        if (bs.length >= 3 && !out.some((o) => o.kind === 'stellium_sign' && o.bodies.length === bs.length && o.bodies.every((x) => bs.includes(x))))
          out.push({ kind: 'stellium_house', label: 'House stellium', bodies: bs, house: +h });
      });
    }
    return out;
  }

  /**
   * birth = { name, date: 'YYYY-MM-DD', time: 'HH:MM' | null, place: { name, region, country, lat, lon, zone } }
   * system = 'placidus' | 'whole'
   */
  function chart(birth, system = 'placidus') {
    const timeKnown = !!birth.time;
    const instant = localToUtc(birth.date, timeKnown ? birth.time : '12:00', birth.place.zone);
    const pos = all(instant);
    let asc = null, mc = null, cusps = null, used = null, fallback = false;
    if (timeKnown) {
      const a = angles(instant, birth.place.lat, birth.place.lon);
      asc = a.asc; mc = a.mc;
      if (system === 'placidus') {
        cusps = placidus(instant, birth.place.lat, birth.place.lon);
        if (!cusps) { fallback = true; cusps = wholeSign(a.asc); used = 'whole'; } else used = 'placidus';
      } else { cusps = wholeSign(a.asc); used = 'whole'; }
    }
    const c = {
      birth, instant, timeKnown, pos, asc, mc, cusps, houseSystem: used, placidusFallback: fallback,
      house: (k) => (cusps ? houseOf(pos[k].lon, cusps) : null),
      ascSign: asc == null ? null : signOf(asc),
      mcSign: mc == null ? null : signOf(mc)
    };
    c.chartRuler = c.ascSign ? c.ascSign.ruler : null;
    c.aspects = aspects(pos);
    c.patterns = patterns(c);
    c.balance = (f) => {
      const m = {};
      PLANETS.forEach((p) => { const w = p === 'sun' || p === 'moon' ? 2 : 1, k = f(pos[p].sign); m[k] = (m[k] || 0) + w; });
      if (c.ascSign) { const k = f(c.ascSign); m[k] = (m[k] || 0) + 2; }
      return m;
    };
    return c;
  }

  /* ---------- transits and returns ---------- */
  function signedOff(m, t, natalLon, a) {
    const d = angDiff(lonLat(m, t).lon, natalLon);
    let best = 999;
    for (const tg of a.angle === 0 || a.angle === 180 ? [a.angle] : [a.angle, -a.angle]) { const o = angDiff(d, tg); if (Math.abs(o) < Math.abs(best)) best = o; }
    return Math.abs(best) < 10 ? best : null;
  }
  function transits(natal, from, days = 30) {
    const movers = PLANETS.filter((p) => p !== 'moon'), step = 12 * 3600000, out = [];
    const cache = {}; // lon per mover per step
    for (const m of movers) {
      const series = [];
      for (let t = from.getTime(); t <= from.getTime() + days * 86400000; t += step) series.push([t, lonLat(m, new Date(t)).lon]);
      cache[m] = series;
    }
    for (const m of movers) for (const nb of BODIES.map((b) => b.key)) for (const a of ASPECTS) {
      const nlon = natal.pos[nb].lon, s = cache[m];
      const off = (lon) => { const d = angDiff(lon, nlon); let best = 999; for (const tg of a.angle === 0 || a.angle === 180 ? [a.angle] : [a.angle, -a.angle]) { const o = angDiff(d, tg); if (Math.abs(o) < Math.abs(best)) best = o; } return Math.abs(best) < 10 ? best : null; };
      for (let i = 1; i < s.length; i++) {
        const p = off(s[i - 1][1]), d = off(s[i][1]);
        if (p != null && d != null && p * d <= 0 && Math.abs(p - d) < 20) {
          let lo = s[i - 1][0], hi = s[i][0], flo = p;
          for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2, fm = signedOff(m, new Date(mid), nlon, a); if (fm == null) break; if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; } }
          out.push({ transiting: m, type: a, natal: nb, exact: new Date(lo) });
        }
      }
    }
    const seen = new Set();
    return out.filter((x) => { const k = x.transiting + x.type.key + x.natal + Math.floor(x.exact / 864e5); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.exact - b.exact);
  }

  function returns(natal, maxAge = 100) {
    const out = [], born = natal.instant.getTime();
    function scan(key, label, stepDays, minYears) {
      const target = natal.pos[key].lon;
      let prev = born + 365.25 * minYears * 864e5, prevD = angDiff(lonLat(key, new Date(prev)).lon, target), last = null;
      for (let t = prev + stepDays * 864e5; t < born + 365 * maxAge * 864e5 && t < Date.UTC(2200, 0, 1); t += stepDays * 864e5) {
        const d = angDiff(lonLat(key, new Date(t)).lon, target);
        if (prevD < 0 && d >= 0 && Math.abs(d - prevD) < 30) {
          let a = prev, b = t;
          for (let k = 0; k < 24; k++) { const mid = (a + b) / 2; if (angDiff(lonLat(key, new Date(mid)).lon, target) < 0) a = mid; else b = mid; }
          if (last == null || b - last > 400 * 864e5) { out.push({ body: key, label, instant: new Date(b), age: Math.floor((b - born) / (365.25 * 864e5)) }); last = b; }
        }
        prev = t; prevD = d;
      }
    }
    scan('saturn', 'Saturn return', 5, 20);
    scan('jupiter', 'Jupiter return', 3, 8);
    {
      const target = natal.pos.node.lon;
      let prev = born + 365 * 15 * 864e5, prevD = angDiff(target, meanNode(new Date(prev)));
      for (let t = prev + 5 * 864e5; t < born + 365 * maxAge * 864e5; t += 5 * 864e5) {
        const d = angDiff(target, meanNode(new Date(t)));
        if (prevD < 0 && d >= 0 && Math.abs(d - prevD) < 30) out.push({ body: 'node', label: 'Nodal return', instant: new Date(t), age: Math.floor((t - born) / (365.25 * 864e5)) });
        prev = t; prevD = d;
      }
    }
    return out.sort((a, b) => a.instant - b.instant);
  }

  /* ---------- sky events (lunations, eclipses, ingresses, stations) ---------- */
  function upcoming(from, days = 120) {
    const t0 = A.MakeTime(from), out = [];
    let q = A.SearchMoonQuarter(t0);
    while (q.time.date - from < days * 864e5) {
      if (q.quarter === 0 || q.quarter === 2) {
        const lon = q.quarter === 0 ? A.SunPosition(q.time).elon : norm(A.SunPosition(q.time).elon + 180);
        out.push({ type: q.quarter === 0 ? 'new_moon' : 'full_moon', instant: q.time.date, sign: signOf(lon) });
      }
      q = A.NextMoonQuarter(q);
    }
    let le = A.SearchLunarEclipse(t0);
    while (le.peak.date - from < days * 864e5) { out.push({ type: 'lunar_eclipse', kind: le.kind, instant: le.peak.date, sign: signOf(norm(A.SunPosition(le.peak).elon + 180)) }); le = A.NextLunarEclipse(le.peak); }
    let se = A.SearchGlobalSolarEclipse(t0);
    while (se.peak.date - from < days * 864e5) { out.push({ type: 'solar_eclipse', kind: se.kind, instant: se.peak.date, sign: signOf(A.SunPosition(se.peak).elon) }); se = A.NextGlobalSolarEclipse(se.peak); }
    // ingresses and stations by daily scan (sun..pluto, not the moon)
    for (const k of PLANETS.filter((p) => p !== 'moon')) {
      let prev = position(k, from);
      for (let d = 1; d <= days; d++) {
        const t = new Date(from.getTime() + d * 864e5), cur = position(k, t);
        if (cur.sign.key !== prev.sign.key && Math.abs(angDiff(cur.lon, prev.lon)) < 20) out.push({ type: 'ingress', body: k, instant: t, sign: cur.sign });
        if (k !== 'sun' && prev.speed > 0 !== cur.speed > 0) out.push({ type: cur.speed < 0 ? 'station_retrograde' : 'station_direct', body: k, instant: t, sign: cur.sign });
        prev = cur;
      }
    }
    return out.sort((a, b) => a.instant - b.instant);
  }
  function eventTitle(e) {
    const kind = e.kind ? e.kind[0].toUpperCase() + e.kind.slice(1) : '';
    return ({
      new_moon: `New Moon in ${e.sign.label}`, full_moon: `Full Moon in ${e.sign.label}`,
      lunar_eclipse: `${kind} lunar eclipse in ${e.sign.label}`, solar_eclipse: `${kind} solar eclipse in ${e.sign.label}`,
      ingress: `${e.body && B[e.body].label} enters ${e.sign.label}`,
      station_retrograde: `${e.body && B[e.body].label} turns retrograde in ${e.sign.label}`,
      station_direct: `${e.body && B[e.body].label} turns direct in ${e.sign.label}`
    })[e.type];
  }
  function eventTopics(e) {
    return ({
      new_moon: ['new_moon', e.sign.key], full_moon: ['full_moon', e.sign.key],
      lunar_eclipse: ['eclipse', e.sign.key], solar_eclipse: ['eclipse', e.sign.key],
      station_retrograde: [e.body === 'mercury' ? 'mercury_retrograde' : 'retrograde', e.body],
      station_direct: [e.body === 'mercury' ? 'mercury_retrograde' : 'retrograde', e.body],
      ingress: [e.body, e.sign.key]
    })[e.type] || [];
  }

  /* ---------- tonight: rise/set, moon, planetary hour, void of course ---------- */
  function riseSet(key, place, date) {
    const obs = new A.Observer(place.lat, place.lon, 0), t = A.MakeTime(date);
    const body = A.Body[B[key].ae];
    const r = A.SearchRiseSet(body, obs, +1, t, 1.5), s = A.SearchRiseSet(body, obs, -1, t, 1.5);
    return { rise: r && r.date, set: s && s.date };
  }
  function moonInfo(date) {
    const ph = A.MoonPhase(date), ill = A.Illumination(A.Body.Moon, date);
    const names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
    const name = names[Math.round(ph / 45) % 8];
    return { phase: ph, lit: ill.phase_fraction, name, waxing: ph < 180 };
  }
  const CHALDEAN = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];
  const DAY_RULER = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];
  function planetaryHour(place, date) {
    const day0 = new Date(date.getTime() - 36 * 3600000);
    const obs = new A.Observer(place.lat, place.lon, 0);
    // find the sunrise at or before now, and the next sunset / sunrise
    let rise = A.SearchRiseSet(A.Body.Sun, obs, +1, A.MakeTime(day0), 2);
    let next = rise && A.SearchRiseSet(A.Body.Sun, obs, +1, rise.AddDays(0.01), 2);
    while (next && next.date <= date) { rise = next; next = A.SearchRiseSet(A.Body.Sun, obs, +1, rise.AddDays(0.01), 2); }
    if (!rise || !next) return null;
    const set = A.SearchRiseSet(A.Body.Sun, obs, -1, rise, 1);
    const isDay = date < set.date;
    const start = isDay ? rise.date : set.date, end = isDay ? set.date : next.date;
    const len = (end - start) / 12, idx = Math.floor((date - start) / len);
    const weekday = new Date(rise.date.getTime() + zoneOffsetMin(place.zone, rise.date) * 60000).getUTCDay();
    const first = CHALDEAN.indexOf(DAY_RULER[weekday]);
    const ruler = CHALDEAN[(first + idx + (isDay ? 0 : 12)) % 7];
    return { ruler, ends: new Date(start.getTime() + (idx + 1) * len), isDay };
  }
  /** Void-of-course Moon: from the Moon's last major aspect to a planet before it leaves its sign, until it does. */
  function voidOfCourse(date) {
    const m0 = position('moon', date), endSign = (m0.sign.i + 1) * 30;
    // ingress time
    let lo = date.getTime(), hi = lo + 3 * 864e5;
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; const l = norm(lonLat('moon', new Date(mid)).lon - m0.sign.i * 30); if (l < 30 && l >= 0) lo = mid; else hi = mid; }
    const ingress = new Date(hi);
    // last aspect between now-ish and ingress: scan hourly
    let lastAsp = null;
    for (let t = date.getTime() - 2.5 * 864e5; t < ingress.getTime(); t += 3600000) {
      const ml = lonLat('moon', new Date(t)).lon;
      if (signOf(ml).i !== m0.sign.i) continue;
      for (const p of ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) {
        const pl = lonLat(p, new Date(t)).lon, sep = Math.abs(angDiff(ml, pl));
        for (const a of ASPECTS) if (Math.abs(sep - a.angle) < 0.3) lastAsp = new Date(t);
      }
    }
    const isVoid = lastAsp != null && lastAsp <= date;
    return { isVoid, since: lastAsp, until: ingress, nextSign: SIGNS[(m0.sign.i + 1) % 12] };
  }

  /** Where each body is in the local sky (altitude/azimuth) for the sky finder. */
  function horizon(key, place, date) {
    const obs = new A.Observer(place.lat, place.lon, 0), t = A.MakeTime(date);
    if (key === 'node') return null;
    const eq = A.Equator(A.Body[B[key].ae], t, obs, true, true);
    const h = A.Horizon(t, obs, eq.ra, eq.dec, 'normal');
    return { alt: h.altitude, az: h.azimuth };
  }

  const api = {
    BODIES, B, PLANETS, PERSONAL, SIGNS, ASPECTS, named, signOf, norm, angDiff, fmtDeg, ordinal,
    position, all, lonLat, angles, placidus, wholeSign, houseOf, localToUtc, zoneOffsetMin, zoneLabel,
    chart, transits, returns, upcoming, eventTitle, eventTopics, riseSet, moonInfo, planetaryHour, voidOfCourse, horizon, meanNode
  };
  root.BotbAstro = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
