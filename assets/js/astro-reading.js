/* Back on the Broomstick: reading composer for the Sky page. Same text and section order as the Hedge Almanac app
   (ReadingComposer in Reading.kt), using the shared interpretations.json. Pure functions over BotbAstro charts. */
(function (root) {
  'use strict';
  const E = root.BotbAstro || (typeof require !== 'undefined' ? require('./astro-engine.js') : null);
  const { B, PLANETS, PERSONAL, SIGNS, ASPECTS, named, fmtDeg, ordinal, norm, angDiff } = E;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function make(I) {
    const sign = (s) => I.signs[s.key];
    const planetInSign = (b, s) => {
      if (I.planet_sign[b]) return I.planet_sign[b][s.key];
      return I.outer_generation[b].replaceAll('{sign}', s.label).replaceAll('{kw}', sign(s).keywords.slice(0, 3).join(', '));
    };
    const planetInHouse = (b, h, first) => {
      const lead = I.planet_in_house_lead[b], hj = I.houses[String(h)];
      return first ? `${lead} ${hj.phrase}. ${hj.text}` : `${lead} ${hj.phrase}, joining the other planets you have there.`;
    };
    const order = E.BODIES.map((x) => x.key);
    const pairKey = (a, b) => (order.indexOf(a) <= order.indexOf(b) ? `${a}_${b}` : `${b}_${a}`);
    const aspectText = (a, b, t) => {
      const bes = I.aspect_bespoke[`${pairKey(a, b)}:${t.family}`];
      if (bes) return bes;
      const pa = I.planets[a], pb = I.planets[b];
      return I.aspect_template[t.family].replaceAll('{a_noun}', pa.noun).replaceAll('{b_noun}', pb.noun)
        .replaceAll('{a_short_cap}', cap(pa.short)).replaceAll('{b_short}', pb.short);
    };
    const list = (keys) => { const n = keys.map((k) => B[k].label); return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0]; };
    const pattern = (p) => {
      const t = I.patterns;
      if (p.kind === 'grand_trine') return t.grand_trine.replaceAll('{element}', p.element.toLowerCase()).replaceAll('{bodies}', list(p.bodies));
      if (p.kind === 't_square') return t.t_square.replaceAll('{apex}', B[p.bodies[0]].label).replaceAll('{a}', B[p.bodies[1]].label).replaceAll('{b}', B[p.bodies[2]].label);
      if (p.kind === 'stellium_sign') return t.stellium_sign.replaceAll('{sign}', p.sign.label).replaceAll('{bodies}', list(p.bodies));
      return t.stellium_house.replaceAll('{house}', ordinal(p.house)).replaceAll('{bodies}', list(p.bodies)).replaceAll('{house_desc}', I.houses[String(p.house)].phrase);
    };
    const transitText = (t) => `${I.transit[t.type.key].replaceAll('{t}', B[t.transiting].label).replaceAll('{n}', B[t.natal].label)}: ${I.transit_planet[t.transiting] || ''}, touching ${I.planets[t.natal].short}.`;
    const lunation = (type, s) => I.lunation[type === 'new_moon' ? 'new_moon' : type === 'full_moon' ? 'full_moon' : 'eclipse'].replaceAll('{sign}', s.label).replaceAll('{kw}', sign(s).keywords.slice(0, 3).join(', '));
    const importance = (t) => {
      const slow = ['pluto', 'neptune', 'uranus', 'saturn', 'jupiter', 'mars', 'venus', 'sun', 'mercury'].indexOf(t.transiting);
      return slow + (PERSONAL.includes(t.natal) ? 0 : 5) + (['conjunction', 'opposition', 'square'].includes(t.type.key) ? 0 : 3);
    };
    const fmtMonth = (d, zone) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: zone });
    const fmtDay = (d, zone) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: zone });

    /** Sections: { id, kicker, title, glyph, body (paragraphs joined by \n\n), topics, pair } */
    function compose(c, now = new Date()) {
      const s = [], sun = c.pos.sun, moon = c.pos.moon, zone = c.birth.place.zone;
      const hs = (b) => { const h = c.house(b); return h ? ` in your ${ordinal(h)} house` : ''; };
      const seen = new Set();
      const ih = (b) => { const h = c.house(b); if (!h) return null; const first = !seen.has(h); seen.add(h); return planetInHouse(b, h, first); };
      const join = (...parts) => parts.filter(Boolean).join('\n\n');

      s.push({ id: 'sun', kicker: 'The Big Three', title: `Sun in ${sun.sign.label}${hs('sun')}`, glyph: B.sun.glyph, body: join(planetInSign('sun', sun.sign), ih('sun')), topics: [sun.sign.key, 'sun_sign'], pair: 'sun' });
      s.push({ id: 'moon', kicker: 'The Big Three', title: `Moon in ${moon.sign.label}${hs('moon')}`, glyph: B.moon.glyph, body: join(planetInSign('moon', moon.sign), ih('moon')), topics: ['moon_sign', moon.sign.key], pair: 'moon' });
      if (c.cusps) {
        const asc = c.ascSign;
        s.push({ id: 'rising', kicker: 'The Big Three', title: `${asc.label} rising`, glyph: asc.glyph, body: join(I.rising[asc.key], `Your Ascendant sits at ${fmtDeg(norm(c.asc) % 30)} ${asc.label}.`), topics: ['rising_sign', asc.key], pair: 'rising' });
      } else {
        s.push({ id: 'rising', kicker: 'The Big Three', title: 'Rising sign unknown', glyph: '\u2726', body: 'Without a birth time there is no way to know your rising sign or houses honestly: the Ascendant moves through all twelve signs in a day. Everything else here is still yours. If you ever find your time (a birth certificate, a baby book, a relative\'s memory), add it and the chart will fill in.', topics: ['rising_sign'] });
      }
      if (c.chartRuler) {
        const r = c.chartRuler, rp = c.pos[r];
        s.push({ id: 'ruler', kicker: 'Your chart ruler', title: `${cap(named(r))}, ruler of your chart`, glyph: B[r].glyph,
          body: `${c.ascSign.label} rising makes ${named(r)} the ruler of your whole chart, a kind of guide for your life's journey. Your ${B[r].label} is in ${rp.sign.label}${hs(r)}, so ${I.planets[r].rules} are coloured by ${rp.sign.label}'s way: ${sign(rp.sign).style}.`,
          topics: [r, rp.sign.key] });
      }
      for (const b of ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) {
        const p = c.pos[b];
        const parts = [I.planets[b].meaning, planetInSign(b, p.sign), ih(b)];
        if (p.retro) parts.push(`${B[b].label} was retrograde when you were born, which turns its energy inward: you process ${I.planets[b].noun} privately and on your own timetable, and often come back to things others have long left behind.`);
        s.push({ id: b, kicker: 'The planets', title: `${B[b].label} in ${p.sign.label}${hs(b)}${p.retro ? ' (retrograde)' : ''}`, glyph: B[b].glyph, body: join(...parts),
          topics: [b, p.sign.key].concat(p.retro ? [b === 'mercury' ? 'mercury_retrograde' : 'retrograde'] : []), pair: B[b].label.toLowerCase() });
      }
      const el = c.balance((x) => x.element), mo = c.balance((x) => x.modality);
      const total = Math.max(1, Object.values(el).reduce((a, b) => a + b, 0));
      const top = Object.entries(el).sort((a, b) => b[1] - a[1])[0][0];
      const weak = ['Fire', 'Earth', 'Air', 'Water'].filter((e) => ((el[e] || 0) * 100) / total < 12);
      const topMod = Object.entries(mo).sort((a, b) => b[1] - a[1])[0][0];
      s.push({ id: 'balance', kicker: 'Your elements', title: `Mostly ${top.toLowerCase()}, ${topMod.toLowerCase()}`, glyph: '\u25B3',
        body: [I.element[top.toLowerCase()].strong].concat(weak.map((w) => I.element[w.toLowerCase()].weak)).concat(I.modality[topMod.toLowerCase()]).join(' '), topics: ['astrology'], balance: { el, mo } });
      const asp = c.aspects.filter((a) => (a.a !== 'node' && a.b !== 'node') || a.type.key === 'conjunction').slice(0, 8);
      if (asp.length) {
        s.push({ id: 'aspects', kicker: 'Conversations between planets', title: 'Your closest aspects', glyph: '\u260C',
          body: 'Aspects are the angles between planets: the conversations going on inside you. These are your tightest, the loudest voices.\n\n' +
            asp.map((a) => `${B[a.a].glyph} ${a.type.glyph} ${B[a.b].glyph}  ${B[a.a].label} ${a.type.label.toLowerCase()} ${B[a.b].label} (orb ${fmtDeg(a.orb)}${a.applying ? ', applying' : ''}). ${aspectText(a.a, a.b, a.type)}`).join('\n\n'),
          topics: ['astrology'].concat(asp.slice(0, 2).map((a) => a.a)) });
      }
      if (c.patterns.length) s.push({ id: 'patterns', kicker: 'Shapes in your sky', title: c.patterns.map((p) => p.label).join(', '), glyph: '\u2726', body: c.patterns.map(pattern).join('\n\n'), topics: c.patterns.filter((p) => p.sign).map((p) => p.sign.key).concat('astrology') });
      const node = c.pos.node;
      s.push({ id: 'node', kicker: 'Your soul path', title: `North Node in ${node.sign.label}${hs('node')}`, glyph: B.node.glyph, body: join(I.planets.node.meaning, planetInSign('node', node.sign), ih('node')), topics: [node.sign.key, 'astrology'] });

      const tr = E.transits(c, now, 30).filter((t) => t.natal !== 'node' || t.type.key === 'conjunction').sort((a, b) => importance(a) - importance(b)).slice(0, 6).sort((a, b) => a.exact - b.exact);
      if (tr.length) s.push({ id: 'transits', kicker: 'Right now', title: 'This month for you', glyph: '\u263D',
        body: 'The sky keeps moving after you are born. When a planet today touches a planet in your chart, that part of your life gets stirred. Your main transits over the next thirty days:\n\n' + tr.map((t) => `${fmtDay(t.exact, zone)} \u00B7 ${transitText(t)}`).join('\n\n'),
        topics: [...new Set(tr.map((t) => t.transiting))].slice(0, 2), transits: tr });

      const ret = E.returns(c);
      if (ret.length) {
        const up = {}; ret.filter((r) => r.instant > now).forEach((r) => (up[r.body] ||= r));
        const past = ret.filter((r) => r.instant <= now && r.body === 'saturn');
        const lines = past.map((r) => `Your Saturn return came in ${fmtMonth(r.instant, zone)}, at ${r.age}.`);
        if (up.saturn) lines.push(`Next Saturn return: ${fmtMonth(up.saturn.instant, zone)}, at ${up.saturn.age}. ${I.returns.saturn}`);
        else if (past.length) lines.push(I.returns.saturn);
        if (up.jupiter) lines.push(`Next Jupiter return: ${fmtMonth(up.jupiter.instant, zone)}, at ${up.jupiter.age}. ${I.returns.jupiter}`);
        if (up.node) lines.push(`Next nodal return: ${fmtMonth(up.node.instant, zone)}, at ${up.node.age}. ${I.returns.node}`);
        s.push({ id: 'returns', kicker: 'Turning points', title: 'Your returns', glyph: B.saturn.glyph, body: lines.join('\n\n'), topics: ['saturn_return', 'saturn'] });
      }
      let summary = `${sun.sign.label} Sun, ${moon.sign.label} Moon${c.ascSign ? `, ${c.ascSign.label} rising` : ''}. At heart: \u201C${sign(sun.sign).motto}\u201D In feeling: \u201C${sign(moon.sign).motto}\u201D`;
      if (c.ascSign) summary += ` To the world: \u201C${sign(c.ascSign).motto}\u201D`;
      if (c.placidusFallback) summary += ' (Born too far north for Placidus houses, so Whole Sign houses are used.)';
      return { name: c.birth.name || '', summary, sections: s };
    }

    function synastry(a, b) {
      const pairs = [];
      for (const x of PLANETS) for (const y of PLANETS) {
        const sep = Math.abs(angDiff(a.pos[x].lon, b.pos[y].lon));
        for (const t of ASPECTS) { const orb = Math.abs(sep - t.angle); if (orb <= t.orb * 0.75) { pairs.push({ a: x, b: y, type: t, orb }); break; } }
      }
      const key = pairs.filter((p) => PERSONAL.includes(p.a) || PERSONAL.includes(p.b)).sort((p, q) => (p.orb + (PERSONAL.includes(p.a) && PERSONAL.includes(p.b) ? 0 : 3)) - (q.orb + (PERSONAL.includes(q.a) && PERSONAL.includes(q.b) ? 0 : 3))).slice(0, 10);
      const an = a.birth.name || 'You', bn = b.birth.name || 'Them';
      const flowing = key.filter((k) => k.type.family === 'flowing').length, tense = key.filter((k) => k.type.family === 'tense').length;
      const ea = a.pos.sun.sign.element, eb = b.pos.sun.sign.element, set = [ea, eb].sort().join();
      const elementLine = ea === eb ? `Both Suns are ${ea.toLowerCase()}, so you understand each other's basic temperament without translation.`
        : set === 'Air,Fire' || set === 'Earth,Water' ? `Your Suns are in compatible elements (${ea.toLowerCase()} and ${eb.toLowerCase()}): you feed each other naturally.`
        : `Your Suns are in contrasting elements (${ea.toLowerCase()} and ${eb.toLowerCase()}): you see the world differently, which can be a gift if you stay curious about each other.`;
      const sections = [{ id: 'overview', kicker: 'Together', title: `${an} and ${bn}`, glyph: '\u2640',
        body: `${elementLine} Between your charts there are ${flowing} easy and ${tense} challenging links among the planets that matter most day to day. ` + (flowing >= tense ? 'The easy links outnumber the hard ones, so being together tends to feel natural.' : 'The challenging links are many, which brings chemistry and growth, and asks for patience and honest talk.'),
        topics: ['astrology'] }];
      key.forEach((x) => sections.push({ id: `syn_${x.a}_${x.b}`, kicker: 'Between you', title: `${an}'s ${B[x.a].label} ${x.type.label.toLowerCase()} ${bn}'s ${B[x.b].label}`, glyph: B[x.a].glyph + x.type.glyph + B[x.b].glyph,
        body: `${I.aspects[x.type.key]} Here it links ${an}'s ${I.planets[x.a].short} with ${bn}'s ${I.planets[x.b].short}.`, topics: [x.a, x.b] }));
      return { name: `${an} & ${bn}`, summary: `${a.pos.sun.sign.label} and ${b.pos.sun.sign.label}: ${key.length} key links between your charts.`, sections };
    }

    return { compose, synastry, lunation, transitText, planetInSign, aspectText, sign, I };
  }

  /** Up to [limit] moments for a section from witches.json: the sign+word pair first, then the topics. */
  function witchesOn(W, topics, pair, limit = 3) {
    const out = [], seen = new Set();
    const add = (q) => { if (out.length < limit && !seen.has(q.s)) { seen.add(q.s); out.push(q); } };
    const signTopic = topics.find((t) => SIGNS.some((s) => s.key === t));
    if (pair && signTopic) (W[`p:${signTopic}|${pair}`] || []).forEach(add);
    for (const t of topics) (W['t:' + t] || []).forEach(add);
    return out;
  }

  const api = { make, witchesOn };
  root.BotbReading = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
