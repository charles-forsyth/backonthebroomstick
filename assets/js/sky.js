/* Sky and cards: moon phase, the Wheel of the Year, Major Arcana. Pure functions, no DOM.
   Shared by the GitHub site and the Ask the Archive service so both say the same thing. */
(function (root) {
  'use strict';

  // Fixed-date sabbats (the equinoxes and solstices drift a day; these are the dates the show uses).
  const SABBATS = [
    ['Imbolc', 2, 1, 'First stirrings. Brigid, hearth fire, clearing out the old.'],
    ['Ostara', 3, 20, 'Spring equinox. Balance, seeds, eggs and new starts.'],
    ['Beltane', 5, 1, 'Fire festival. Fertility, passion, the Fae close by.'],
    ['Litha', 6, 21, 'Midsummer. The sun at full power, herbs at their strongest.'],
    ['Lughnasadh', 8, 1, 'First harvest. Bread, skill, gratitude and sacrifice.'],
    ['Mabon', 9, 22, 'Autumn equinox. Balance again, and taking stock.'],
    ['Samhain', 10, 31, "The witches' new year. The veil is thin; honor the dead."],
    ['Yule', 12, 21, 'Winter solstice. The longest night and the sun reborn.'],
  ];

  const CARDS = [
    ['fool', 'The Fool', 'Leap. New paths, trust, a little beautiful recklessness.'],
    ['magician', 'The Magician', 'You have every tool you need. Focus your will.'],
    ['priestess', 'The High Priestess', 'Listen inward. The answer is already in you.'],
    ['empress', 'The Empress', 'Abundance, creativity, tending what grows.'],
    ['emperor', 'The Emperor', 'Structure and boundaries. Build the walls that protect.'],
    ['hierophant', 'The Hierophant', 'Tradition and teachers. What did the elders know?'],
    ['lovers', 'The Lovers', 'A choice made from the heart. Alignment.'],
    ['chariot', 'The Chariot', 'Drive forward. Harness opposing forces.'],
    ['strength', 'Strength', 'Gentle courage. Soft hands tame the lion.'],
    ['hermit', 'The Hermit', 'Step back, light your lantern, walk alone a while.'],
    ['fortune', 'Wheel of Fortune', "The wheel turns. Ride it, don't fight it."],
    ['justice', 'Justice', 'Truth, balance, consequences coming due.'],
    ['hanged', 'The Hanged Man', 'Pause. Look at it upside down.'],
    ['death', 'Death', 'An ending that clears the ground. Transformation.'],
    ['temperance', 'Temperance', 'Blend, balance, patience. The slow alchemy.'],
    ['devil', 'The Devil', 'What binds you? The chains are looser than they look.'],
    ['tower', 'The Tower', 'Sudden change. What falls was never solid.'],
    ['star', 'The Star', 'Hope and healing after the storm.'],
    ['moon', 'The Moon', 'Dreams, intuition, illusion. Trust the dark path.'],
    ['sun', 'The Sun', 'Joy, clarity, warmth. Let yourself shine.'],
    ['judgement', 'Judgement', 'A calling. Rise and answer it.'],
    ['world', 'The World', 'Completion. A cycle closes, whole.'],
  ];

  // Moon: days since a known new moon (2000-01-06 18:14 UTC) modulo the synodic month. Good to a few hours.
  function moon(now) {
    const ref = Date.UTC(2000, 0, 6, 18, 14), syn = 29.530588853;
    const age = ((((now - ref) / 864e5) % syn) + syn) % syn, f = age / syn;
    const lit = (1 - Math.cos(2 * Math.PI * f)) / 2;
    const names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
    const daysToFull = ((0.5 - f + 1) % 1) * syn;
    return { age, f, lit, name: names[Math.floor((f * 8 + 0.5) % 8)], daysToFull };
  }

  // Lit part as an SVG path: right side lit while waxing (northern hemisphere).
  function moonSVG(f, size) {
    const r = size / 2, waxing = f < 0.5, k = Math.cos(2 * Math.PI * f);
    const rx = Math.abs(k) * r, outer = waxing ? 1 : 0, inner = (waxing ? k > 0 : k < 0) ? 0 : 1;
    const d = `M ${r} 0 A ${r} ${r} 0 0 ${outer} ${r} ${size} A ${rx} ${r} 0 0 ${inner} ${r} 0 Z`;
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${r}" cy="${r}" r="${r - 0.5}" class="moon-dark"/><path d="${d}" class="moon-lit"/></svg>`;
  }

  function nextSabbat(now) {
    const y = now.getFullYear(), today = new Date(y, now.getMonth(), now.getDate());
    const all = SABBATS.flatMap(([n, m, d, b]) => [y, y + 1].map((yy) => ({ n, b, dt: new Date(yy, m - 1, d) })));
    const nx = all.filter((s) => s.dt >= today).sort((a, b) => a.dt - b.dt)[0];
    return { ...nx, days: Math.round((nx.dt - today) / 864e5) };
  }

  // Same card for every reader on the same date.
  function cardOfDay(now) {
    const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5);
    return CARDS[(day * 7) % CARDS.length];
  }

  root.BotbSky = { SABBATS, CARDS, moon, moonSVG, nextSabbat, cardOfDay };
})(typeof window !== 'undefined' ? window : globalThis);
