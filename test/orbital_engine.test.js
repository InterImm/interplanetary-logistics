import test from 'node:test';
import assert from 'node:assert/strict';
import {
    findOptimalTransfer, transferBetween, parkingOrbitBurn,
    MU_EARTH, MU_MARS, PARKING_ORBIT_RADIUS,
} from '../js/orbital_engine.js';
import { dateToJulianDate } from '../js/ephemeris.js';
import { PricingEngine } from '../js/pricing_engine.js';

const jd = (iso) => dateToJulianDate(new Date(iso));

test('parking-orbit burn: escape from 300 km LEO costs ~3.2 km/s', () => {
    const escape = parkingOrbitBurn(MU_EARTH, PARKING_ORBIT_RADIUS.earth, 0);
    assert.ok(Math.abs(escape - 3.2) < 0.05, `${escape} km/s`);
});

test('parking-orbit burn: grows with excess speed, Oberth effect beats the naive sum', () => {
    const r = PARKING_ORBIT_RADIUS.earth;
    const b3 = parkingOrbitBurn(MU_EARTH, r, 3);
    const b4 = parkingOrbitBurn(MU_EARTH, r, 4);
    assert.ok(b4 > b3);
    // Burning deep in the gravity well is cheaper than escaping and then adding v_inf
    assert.ok(b3 < parkingOrbitBurn(MU_EARTH, r, 0) + 3);
    // Mars capture from a 3 km/s arrival into low orbit is ~2 km/s
    const capture = parkingOrbitBurn(MU_MARS, PARKING_ORBIT_RADIUS.mars, 3);
    assert.ok(capture > 1.8 && capture < 2.6, `${capture} km/s`);
});

// Launch energies of flown missions, at their real launch and arrival dates.
// (Published C3 values: Mars 2020 ~14, InSight ~8.)
test('reproduces the launch energy of Mars 2020 (Perseverance)', () => {
    const t = transferBetween(jd('2020-07-30'), jd('2021-02-18'));
    assert.ok(Math.abs(t.c3 - 14.4) < 1, `C3 ${t.c3}`);
    assert.ok(Math.abs(t.tof_days - 203) < 1);
});

test('reproduces the launch energy of InSight', () => {
    const t = transferBetween(jd('2018-05-05'), jd('2018-11-26'));
    assert.ok(Math.abs(t.c3 - 8.2) < 0.7, `C3 ${t.c3}`);
});

test('optimum in the 2020 window falls inside the real 2020 launch window', () => {
    const best = findOptimalTransfer('2020-06-01', '2020-10-01', '2021-01-01', '2021-12-31');
    assert.ok(best.launch_time >= '2020-07-17' && best.launch_time <= '2020-08-15', best.launch_time);
    assert.ok(best.arrival_time >= '2021-02-01' && best.arrival_time <= '2021-03-05', best.arrival_time);
});

test('the search returns the true minimum (brute force over a separate code path)', () => {
    const best = findOptimalTransfer('2026-09-01', '2026-12-31', '2027-06-01', '2027-12-31');
    let min = Infinity;
    for (let d = jd('2026-09-01'); d <= jd('2026-12-31'); d += 1) {
        for (let a = jd('2027-06-01'); a <= jd('2027-12-31'); a += 1) {
            const t = transferBetween(d, a);
            if (t && t.delta_v < min) min = t.delta_v;
        }
    }
    assert.ok(Math.abs(best.delta_v - min) < 1e-9, `${best.delta_v} vs brute force ${min}`);
});

test('result is self-consistent', () => {
    const best = findOptimalTransfer('2026-01-01', '2026-12-31', '2026-06-01', '2028-12-31');
    assert.ok(Math.abs(best.delta_v - (best.dv_departure + best.dv_arrival)) < 1e-12);
    assert.ok(Math.abs(best.c3 - best.v_inf_departure ** 2) < 1e-12);
    assert.ok(Math.abs(best.tof_days - (jd(best.arrival_time) - jd(best.launch_time))) < 1e-9);
    assert.ok(best.launch_time >= '2026-01-01' && best.launch_time <= '2026-12-31');
    assert.ok(best.arrival_time >= '2026-06-01' && best.arrival_time <= '2028-12-31');
    // Re-evaluating the reported dates independently gives the reported cost
    const again = transferBetween(jd(best.launch_time), jd(best.arrival_time));
    assert.ok(Math.abs(again.delta_v - best.delta_v) < 1e-9);
    // Sensible Earth-Mars numbers: ~5-7 km/s from LEO to low Mars orbit, flight of 6-12 months
    assert.ok(best.delta_v > 5 && best.delta_v < 7, `${best.delta_v} km/s`);
    assert.ok(best.tof_days > 180 && best.tof_days < 365, `${best.tof_days} d`);
});

test('the returned grid is consistent with the optimum', () => {
    const best = findOptimalTransfer('2026-09-01', '2027-01-31', '2027-04-01', '2028-01-31');
    const { grid } = best;
    assert.equal(grid.deltaV.length, grid.nDep * grid.nArr);
    let min = Infinity, at = -1;
    grid.deltaV.forEach((v, k) => { if (v < min) { min = v; at = k; } });
    assert.ok(Math.abs(min - best.delta_v) < 1e-5, `${min} vs ${best.delta_v}`);
    const i = Math.floor(at / grid.nArr), j = at % grid.nArr;
    assert.equal(grid.dptStartJD + i * grid.step, jd(best.launch_time));
    assert.equal(grid.arrStartJD + j * grid.step, jd(best.arrival_time));
});

test('grid marks pairs with arrival at or before departure as infeasible', () => {
    const { grid } = findOptimalTransfer('2026-01-01', '2026-12-31', '2026-06-01', '2028-12-31');
    let checked = 0;
    for (let i = 0; i < grid.nDep; i += 7) {
        for (let j = 0; j < grid.nArr; j += 7) {
            const tof = grid.arrStartJD + j * grid.step - (grid.dptStartJD + i * grid.step);
            const v = grid.deltaV[i * grid.nArr + j];
            if (tof <= 0) { assert.ok(Number.isNaN(v)); checked++; } else assert.ok(v > 0);
        }
    }
    assert.ok(checked > 0);
});

test('large windows are sampled coarsely but stay near the optimum', () => {
    const fine = findOptimalTransfer('2026-01-01', '2026-12-31', '2026-06-01', '2028-12-31');
    const coarse = findOptimalTransfer('2026-01-01', '2036-12-31', '2026-06-01', '2038-12-31');
    assert.equal(fine.search_step_days, 1);
    assert.ok(coarse.search_step_days > 1);
    assert.ok(Math.abs(coarse.delta_v - fine.delta_v) < 0.15, `${coarse.delta_v} vs ${fine.delta_v}`);
});

test('no feasible transfer returns null', () => {
    assert.equal(findOptimalTransfer('2026-06-01', '2026-06-30', '2026-01-01', '2026-02-01'), null);
});

test('rejects bad input', () => {
    assert.throws(() => findOptimalTransfer('nope', '2026-12-31', '2026-06-01', '2027-01-01'), RangeError);
    assert.throws(() => findOptimalTransfer('2026-12-31', '2026-01-01', '2026-06-01', '2027-01-01'), /ends before/);
    assert.throws(() => findOptimalTransfer('2026-01-01', '2026-12-31', '2026-06-01', '2027-01-01x'), RangeError);
    assert.throws(() => findOptimalTransfer('2026-01-01', '2026-12-31', '2026-06-01', '2100-01-01'), /1800 and 2050/);
});

test('pricing engine', () => {
    assert.equal(new PricingEngine({ delta_v: 5 }).price(), 5 / 50);
    assert.equal(new PricingEngine({ delta_v: 5, euros_per_delta_v: 2 }).price(), 10);
    assert.throws(() => new PricingEngine({ delta_v: 5 }).price('nonsense'), /No method defined/);
});
