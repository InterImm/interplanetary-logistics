import test from 'node:test';
import assert from 'node:assert/strict';
import { planetState, dateToJulianDate, AU, MU_SUN } from '../js/ephemeris.js';
import { norm, sub } from './helpers.js';

const jd = (iso) => dateToJulianDate(new Date(iso));
const dist = (t) => norm(sub(planetState('mars', t).r, planetState('earth', t).r)) / AU;

// Day within [from, to] on which Earth-Mars distance is smallest
function closestApproach(from, to) {
    let best = { d: Infinity, jd: 0 };
    for (let t = jd(from); t <= jd(to); t += 0.05) {
        const d = dist(t);
        if (d < best.d) best = { d, jd: t };
    }
    return best;
}

// Published Earth-Mars closest approaches (NASA/JPL)
const approaches = [
    { label: '2003 (record close approach)', from: '2003-08-01', to: '2003-09-30', date: '2003-08-27', au: 0.3727 },
    { label: '2018', from: '2018-07-01', to: '2018-08-31', date: '2018-07-31', au: 0.3850 },
    { label: '2020', from: '2020-09-15', to: '2020-11-15', date: '2020-10-06', au: 0.4145 },
];

for (const a of approaches) {
    test(`Earth-Mars closest approach, ${a.label}`, () => {
        const best = closestApproach(a.from, a.to);
        assert.ok(Math.abs(best.d - a.au) < 0.002, `distance ${best.d.toFixed(4)} AU, expected ${a.au}`);
        assert.ok(Math.abs(best.jd - jd(a.date)) < 2, `${(best.jd - jd(a.date)).toFixed(2)} days off ${a.date}`);
    });
}

test('Earth is at the Sun\'s opposite longitude at J2000 (~100.4 deg)', () => {
    const { r } = planetState('earth', 2451545.0);
    const lon = (Math.atan2(r[1], r[0]) * 180) / Math.PI;
    assert.ok(Math.abs(lon - 100.4) < 0.1, `longitude ${lon}`);
    assert.ok(Math.abs(norm(r) / AU - 0.9833) < 0.0005, `radius ${norm(r) / AU} AU`);
});

test('orbit shapes: perihelion/aphelion, speed, inclination, direction', () => {
    const span = (body, days, step) => {
        const out = [];
        for (let t = jd('2025-01-01'); t < jd('2025-01-01') + days; t += step) out.push(planetState(body, t));
        return out;
    };
    const earth = span('earth', 366, 1);
    const rE = earth.map((s) => norm(s.r) / AU);
    assert.ok(Math.abs(Math.min(...rE) - 0.9833) < 0.001 && Math.abs(Math.max(...rE) - 1.0167) < 0.001);
    const vE = earth.map((s) => norm(s.v));
    assert.ok(Math.min(...vE) > 29.2 && Math.max(...vE) < 30.4, `Earth speed ${Math.min(...vE)}..${Math.max(...vE)}`);

    const mars = span('mars', 688, 1);
    const rM = mars.map((s) => norm(s.r) / AU);
    assert.ok(Math.abs(Math.min(...rM) - 1.3814) < 0.002 && Math.abs(Math.max(...rM) - 1.6660) < 0.002,
        `Mars radius ${Math.min(...rM)}..${Math.max(...rM)}`);
    const maxLat = Math.max(...mars.map((s) => Math.asin(s.r[2] / norm(s.r))));
    assert.ok(Math.abs(maxLat - (1.85 * Math.PI) / 180) < 0.002, `Mars max ecliptic latitude ${(maxLat * 180) / Math.PI} deg`);

    for (const s of [...earth, ...mars]) {
        const hz = s.r[0] * s.v[1] - s.r[1] * s.v[0];
        assert.ok(hz > 0, 'planets orbit counter-clockwise about +z');
    }
});

test('velocity is consistent with the orbit (vis-viva)', () => {
    // Independent of how the velocity is computed: a planet's speed must
    // satisfy v^2 = mu (2/r - 1/a) for its own orbit.
    const sma = { earth: 1.00000261 * AU, mars: 1.52371034 * AU };
    for (const body of ['earth', 'mars']) {
        for (const iso of ['2020-07-30', '2026-11-15', '2031-03-01', '2027-05-20']) {
            const { r, v } = planetState(body, jd(iso));
            const visViva = Math.sqrt(MU_SUN * (2 / norm(r) - 1 / sma[body]));
            assert.ok(Math.abs(norm(v) - visViva) < 2e-3, `${body} ${iso}: |v| ${norm(v)} vs ${visViva} km/s`);
        }
    }
});

test('mean orbital periods', () => {
    const period = (body) => {
        // time between successive perihelion passages via the radius minimum
        const t0 = jd('2025-01-01');
        let prev = null;
        const minima = [];
        for (let t = t0; t < t0 + 1500; t += 0.25) {
            const r = norm(planetState(body, t).r);
            const r2 = norm(planetState(body, t + 0.25).r);
            const r0 = norm(planetState(body, t - 0.25).r);
            if (r < r0 && r < r2) minima.push(t);
            prev = r;
        }
        return minima[1] - minima[0];
    };
    assert.ok(Math.abs(period('earth') - 365.26) < 0.5, `Earth ${period('earth')} d`);
    assert.ok(Math.abs(period('mars') - 686.98) < 1, `Mars ${period('mars')} d`);
});
