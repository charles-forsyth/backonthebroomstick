// Checks assets/js/astro-engine.js against the Swiss Ephemeris reference charts (same file the app's tests use).
// Run: node tools/astro/check_engine.js   Exit 1 if any value is outside tolerance.
global.Astronomy = require('../../assets/js/lib/astronomy.min.js');
const E = require('../../assets/js/astro-engine.js');
const refs = require('./reference_charts.json');
const LON_TOL = 0.05, ANGLE_TOL = 0.2, CUSP_TOL = 0.3;
const keyOf = { Sun: 'sun', Moon: 'moon', Mercury: 'mercury', Venus: 'venus', Mars: 'mars', Jupiter: 'jupiter', Saturn: 'saturn', Uranus: 'uranus', Neptune: 'neptune', Pluto: 'pluto', 'North Node': 'node' };
let bad = 0, worst = { lon: 0, ang: 0, cusp: 0 };
for (const r of refs) {
  const t = new Date(r.utc);
  const pos = E.all(t);
  for (const [name, p] of Object.entries(r.planets)) {
    const me = pos[keyOf[name]];
    const d = Math.abs(E.angDiff(me.lon, p.lon));
    worst.lon = Math.max(worst.lon, d);
    if (d > LON_TOL) { bad++; console.log(`FAIL ${r.name} ${name}: ${me.lon.toFixed(4)} vs ${p.lon} (${d.toFixed(4)})`); }
    if (name !== 'North Node' && name !== 'Sun' && name !== 'Moon' && me.retro !== p.retro) { bad++; console.log(`FAIL ${r.name} ${name} retro ${me.retro} vs ${p.retro}`); }
  }
  const a = E.angles(t, r.input.lat, r.input.lon);
  for (const [k, v] of [['asc', a.asc], ['mc', a.mc]]) {
    const d = Math.abs(E.angDiff(v, r[k].lon)); worst.ang = Math.max(worst.ang, d);
    if (d > ANGLE_TOL) { bad++; console.log(`FAIL ${r.name} ${k}: ${v.toFixed(4)} vs ${r[k].lon}`); }
  }
  if (r.cusps_placidus) {
    const c = E.placidus(t, r.input.lat, r.input.lon);
    if (!c) { bad++; console.log(`FAIL ${r.name} no Placidus`); continue; }
    c.forEach((v, i) => { const d = Math.abs(E.angDiff(v, r.cusps_placidus[i])); worst.cusp = Math.max(worst.cusp, d); if (d > CUSP_TOL) { bad++; console.log(`FAIL ${r.name} cusp ${i + 1}: ${v.toFixed(3)} vs ${r.cusps_placidus[i]}`); } });
    for (const [name, p] of Object.entries(r.planets)) {
      const h = E.houseOf(pos[keyOf[name]].lon, c);
      if (h !== p.house_placidus) { bad++; console.log(`FAIL ${r.name} ${name} house ${h} vs ${p.house_placidus}`); }
    }
  }
  // the local-time conversion: chart() from the local input must land on the same UTC
  const loc = r.input.local.slice(0, 16);
  const u = E.localToUtc(loc.slice(0, 10), loc.slice(11, 16), r.input.tz);
  if (Math.abs(u - t) > 60000) { bad++; console.log(`FAIL ${r.name} local->UTC ${u.toISOString()} vs ${r.utc}`); }
}
console.log(`${refs.length} charts; worst planet ${worst.lon.toFixed(4)} deg, angle ${worst.ang.toFixed(4)}, cusp ${worst.cusp.toFixed(4)}; ${bad} failures`);
process.exit(bad ? 1 : 0);
