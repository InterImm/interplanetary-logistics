import test from 'node:test';
import assert from 'node:assert/strict';
import { lambert } from '../js/lambert.js';
import { MU_SUN, AU } from '../js/ephemeris.js';
import { norm, sub, propagate } from './helpers.js';

const MU_EARTH = 398600; // km^3/s^2, value used by the textbook example

test('matches the textbook example (Curtis, Example 5.2)', () => {
    const r1 = [5000, 10000, 2100];
    const r2 = [-14600, 2500, 7000];
    const { v1, v2 } = lambert(MU_EARTH, r1, r2, 3600);
    const close = (a, b) => a.forEach((c, i) => assert.ok(Math.abs(c - b[i]) < 1e-3, `${a} vs ${b}`));
    close(v1, [-5.9925, 1.9254, 3.2456]);
    close(v2, [-3.3125, -4.1966, -0.38529]);
});

// The real test of a Lambert solver: fly the orbit it returns and check that
// we actually arrive at r2 after tof, with the velocity it claims.
const cases = [
    { name: 'Earth-Mars-like, short way', mu: MU_SUN, r1: [1.0 * AU, 0, 0], r2: [0.3 * AU, 1.45 * AU, 0.02 * AU], tofDays: 230 },
    { name: 'Earth-Mars-like, long way (>180 deg)', mu: MU_SUN, r1: [1.0 * AU, 0, 0], r2: [0.3 * AU, -1.45 * AU, 0.02 * AU], tofDays: 300 },
    { name: 'fast hyperbolic transfer', mu: MU_SUN, r1: [1.0 * AU, 0, 0], r2: [0.0, 1.5 * AU, 0.03 * AU], tofDays: 90 },
    { name: 'slow, near full period', mu: MU_SUN, r1: [1.0 * AU, 0, 0], r2: [1.2 * AU, -0.4 * AU, 0.05 * AU], tofDays: 500 },
    { name: 'inclined Earth orbit', mu: MU_EARTH, r1: [7000, 0, 0], r2: [0, 9000, 4000], tofDays: 0.04 },
];

for (const c of cases) {
    test(`reaches the target: ${c.name}`, () => {
        const tof = c.tofDays * 86400;
        const sol = lambert(c.mu, c.r1, c.r2, tof);
        assert.ok(sol, 'solver returned no solution');
        const end = propagate(c.mu, c.r1, sol.v1, tof);
        const posErr = norm(sub(end.r, c.r2)) / norm(c.r2);
        const velErr = norm(sub(end.v, sol.v2)) / norm(sol.v2);
        assert.ok(posErr < 1e-7, `position error ${posErr}`);
        assert.ok(velErr < 1e-7, `velocity error ${velErr}`);
    });
}

test('transfer is prograde about +z', () => {
    for (const r2 of [[0.3 * AU, 1.45 * AU, 0], [0.3 * AU, -1.45 * AU, 0]]) {
        const { v1 } = lambert(MU_SUN, [AU, 0, 0], r2, 250 * 86400);
        const hz = AU * v1[1]; // (r1 x v1)_z with r1 along +x
        assert.ok(hz > 0, `angular momentum z = ${hz}`);
    }
});

test('coplanar circular Hohmann transfer recovers the textbook velocities', () => {
    const r1 = AU;
    const r2 = 1.523679 * AU;
    const a = (r1 + r2) / 2;
    const tof = Math.PI * Math.sqrt(a ** 3 / MU_SUN); // half an orbit
    const theta = Math.PI - 1e-4; // exactly pi makes the plane undefined
    const sol = lambert(MU_SUN, [r1, 0, 0], [r2 * Math.cos(theta), r2 * Math.sin(theta), 0], tof);
    const vPerihelion = Math.sqrt(MU_SUN * (2 / r1 - 1 / a));
    const vAphelion = Math.sqrt(MU_SUN * (2 / r2 - 1 / a));
    assert.ok(Math.abs(norm(sol.v1) - vPerihelion) < 5e-3, `${norm(sol.v1)} vs ${vPerihelion}`);
    assert.ok(Math.abs(norm(sol.v2) - vAphelion) < 5e-3, `${norm(sol.v2)} vs ${vAphelion}`);
    assert.ok(Math.abs(vPerihelion - 32.73) < 0.01, 'sanity: Hohmann departure speed is ~32.7 km/s');
});

test('rejects degenerate input', () => {
    assert.equal(lambert(MU_SUN, [AU, 0, 0], [2 * AU, 0, 0], 100 * 86400), null, 'collinear');
    assert.equal(lambert(MU_SUN, [AU, 0, 0], [0, AU, 0], 0), null, 'zero time');
    assert.equal(lambert(MU_SUN, [AU, 0, 0], [0, AU, 0], -5), null, 'negative time');
});
