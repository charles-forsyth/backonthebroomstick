// Composes a full reading for a known chart and checks it is complete (no template holes, every section has text).
global.Astronomy = require('../../assets/js/vendor/astronomy.min.js');
global.BotbAstro = require('../../assets/js/astro-engine.js');
const R = require('../../assets/js/astro-reading.js');
const I = require('../../assets/data/astro/interpretations.json');
const W = require('../../assets/data/astro/witches.json');
const r = R.make(I);
let bad = 0;
const cases = [
  { name: 'Wellsboro', date: '1980-10-31', time: '21:45', place: { name: 'Wellsboro', lat: 41.7487, lon: -77.3005, zone: 'America/New_York' } },
  { name: 'No time', date: '1995-08-15', time: null, place: { name: 'Mumbai', lat: 19.0728, lon: 72.8826, zone: 'Asia/Kolkata' } },
  { name: 'Reykjavik', date: '2001-12-21', time: '06:00', place: { name: 'Reykjavik', lat: 64.1355, lon: -21.8954, zone: 'Atlantic/Reykjavik' } },
  { name: 'Tromso', date: '1990-06-21', time: '12:00', place: { name: 'Tromso', lat: 69.6496, lon: 18.956, zone: 'Europe/Oslo' } }
];
for (const b of cases) {
  const t0 = Date.now();
  const c = BotbAstro.chart(b);
  const rd = r.compose(c, new Date('2026-11-02T15:00:00Z'));
  const words = rd.sections.reduce((n, s) => n + s.body.split(/\s+/).length, 0);
  let quotes = 0;
  for (const s of rd.sections) {
    if (!s.body || s.body.length < 40) { bad++; console.log('EMPTY', b.name, s.id); }
    if (/\{[a-z_]+\}|undefined|NaN|null/.test(s.body + s.title)) { bad++; console.log('HOLE', b.name, s.id, (s.body + s.title).match(/\{[a-z_]+\}|undefined|NaN|null/)[0]); }
    quotes += R.witchesOn(W, s.topics, s.pair).length;
  }
  console.log(`${b.name}: ${rd.sections.length} sections, ${words} words, ${quotes} quotes, ${Date.now() - t0} ms | ${rd.summary.slice(0, 90)}`);
}
const syn = r.synastry(BotbAstro.chart(cases[0]), BotbAstro.chart(cases[2]));
if (syn.sections.some((s) => /\{|undefined|NaN/.test(s.body + s.title))) { bad++; console.log('HOLE synastry'); }
console.log(`synastry: ${syn.sections.length} sections`);
const ev = BotbAstro.upcoming(new Date('2026-11-02T12:00:00Z'), 120);
console.log('events:', ev.slice(0, 8).map((e) => e.instant.toISOString().slice(0, 10) + ' ' + BotbAstro.eventTitle(e)).join(' | '));
const here = { lat: 41.7487, lon: -77.3005, zone: 'America/New_York' };
const now = new Date('2026-11-02T15:00:00Z');
console.log('hour:', JSON.stringify(BotbAstro.planetaryHour(here, now)), 'voc:', JSON.stringify(BotbAstro.voidOfCourse(now)), 'moon:', JSON.stringify(BotbAstro.moonInfo(now)));
const rs = BotbAstro.riseSet('moon', here, new Date('2026-11-02T05:00:00Z'));
console.log('moonrise', rs.rise && rs.rise.toISOString(), 'set', rs.set && rs.set.toISOString());
process.exit(bad ? 1 : 0);
