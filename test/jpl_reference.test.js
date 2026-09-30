// Checks against NASA/JPL Horizons reference data (see test/fixtures/jpl_horizons.json
// for provenance). These are the authoritative cross-checks: unlike the other tests,
// nothing here depends on the model agreeing with itself.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planetState, MU_SUN } from '../js/ephemeris.js';
import { lambert } from '../js/lambert.js';
import { findOptimalTransfer, evaluateTransfer } from '../js/orbital_engine.js';
import { norm, sub } from './helpers.js';

const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/jpl_horizons.json', import.meta.url)));

test('planet states agree with JPL (DE) over 2026-2034', () => {
    // Quoted accuracy of the approximate elements is tens of arcseconds. Measured on
    // the full daily series: Earth <= 16,000 km / 2.2 m/s, Mars <= 61,000 km / 5.3 m/s.
    const limits = { earth: { km: 25000, ms: 4 }, mars: { km: 80000, ms: 8 } };
    for (const body of ['earth', 'mars']) {
        assert.ok(fx[body].length > 40);
        for (const ref of fx[body]) {
            const s = planetState(body, ref.jd);
            const dp = norm(sub(s.r, ref.r));
            const dv = norm(sub(s.v, ref.v)) * 1000;
            assert.ok(dp < limits[body].km, `${body} JD ${ref.jd}: position off by ${dp.toFixed(0)} km`);
            assert.ok(dv < limits[body].ms, `${body} JD ${ref.jd}: velocity off by ${dv.toFixed(2)} m/s`);
        }
    }
});

for (const w of fx.windows) {
    test(`${w.label} window: same optimum and cost as a search run on JPL's planet positions`, () => {
        const ours = findOptimalTransfer(...w.departure_window, ...w.arrival_window);
        assert.equal(ours.launch_time, w.jpl_optimum.launch);
        assert.equal(ours.arrival_time, w.jpl_optimum.arrival);
        assert.ok(Math.abs(ours.delta_v - w.jpl_optimum.delta_v) < 0.005,
            `${ours.delta_v} vs JPL ${w.jpl_optimum.delta_v} km/s`);
        assert.ok(Math.abs(ours.c3 - w.jpl_optimum.c3) < 0.05, `C3 ${ours.c3} vs JPL ${w.jpl_optimum.c3}`);

        // Same pair of days, evaluated directly from JPL's states
        const { earth_at_launch: e, mars_at_arrival: m } = w.jpl_states;
        const direct = evaluateTransfer(e, m, (m.jd - e.jd) * 86400);
        assert.ok(Math.abs(direct.delta_v - w.jpl_optimum.delta_v) < 1e-3);
    });
}

// Real flown trajectories. Pick two points in a spacecraft's heliocentric cruise,
// solve Lambert's problem between them and compare with the velocity it really had.
// Residuals come from course corrections and planetary gravity, which a Sun-only
// two-body model ignores; measured <= 9 m/s out of ~31,000 m/s.
const flights = [
    ['Mars 2020 (Perseverance), 2020-09-01 to 2021-01-20', fx.spacecraft.perseverance[0], fx.spacecraft.perseverance[1]],
    ['Mars 2020 (Perseverance), 2020-10-01 to 2020-12-15', fx.spacecraft.perseverance[2], fx.spacecraft.perseverance[3]],
    ['MAVEN, 2014-01-01 to 2014-08-15', fx.spacecraft.maven[0], fx.spacecraft.maven[1]],
];
for (const [name, a, b] of flights) {
    test(`Lambert reproduces the real cruise velocity: ${name}`, () => {
        const sol = lambert(MU_SUN, a.r, b.r, (b.jd - a.jd) * 86400);
        const d1 = norm(sub(sol.v1, a.v)) * 1000;
        const d2 = norm(sub(sol.v2, b.v)) * 1000;
        assert.ok(d1 < 15, `start velocity off by ${d1.toFixed(1)} m/s`);
        assert.ok(d2 < 15, `end velocity off by ${d2.toFixed(1)} m/s`);
    });
}
