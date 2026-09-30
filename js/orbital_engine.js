// Earth-to-Mars transfer optimisation.
//
// For every (departure, arrival) pair in the requested windows we
//   1. look up the heliocentric state of Earth at departure and Mars at arrival,
//   2. solve Lambert's problem for the heliocentric transfer orbit,
//   3. convert the hyperbolic excess velocities at each end into rocket burns
//      to and from a circular parking orbit around the planet,
// and keep the pair with the smallest total delta-v.
//
// Model assumptions:
//   - Impulsive burns, single heliocentric revolution, prograde, no flybys.
//   - Departure from, and propulsive capture into, a circular 300 km orbit.
//     (No aerobraking: that would make the arrival burn cheaper.)
//   - Planet states from the Standish approximate ephemeris (see ephemeris.js).

import { planetState, dateToJulianDate, julianDateToDate, MU_SUN } from './ephemeris.js';
import { lambert } from './lambert.js';

export const MU_EARTH = 398600.4418; // km^3/s^2
export const MU_MARS = 42828.375; // km^3/s^2
export const PARKING_ORBIT_RADIUS = {
    earth: 6378.137 + 300, // km
    mars: 3396.19 + 300, // km
};

// The Standish elements are only quoted for 1800-2050.
const MIN_YEAR = 1800;
const MAX_YEAR = 2050;

// Upper bound on Lambert solves per search. Larger windows are sampled more
// coarsely (whole-day steps) to keep the page responsive.
const MAX_PAIRS = 2_000_000;

const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/**
 * Burn needed to move between a circular orbit of the given radius and a
 * hyperbolic trajectory with excess speed vInf. Departure and capture are the
 * same burn run in opposite directions, applied at periapsis.
 */
export function parkingOrbitBurn(mu, radius, vInf) {
    const vCircular = Math.sqrt(mu / radius);
    const vPeriapsis = Math.sqrt(vInf * vInf + (2 * mu) / radius);
    return vPeriapsis - vCircular;
}

/**
 * Cost of one transfer, given the planet states at departure and arrival.
 * @returns {object|null} null when no transfer exists (non-positive time of
 *   flight, or degenerate geometry)
 */
export function evaluateTransfer(earth, mars, tofSeconds) {
    const sol = lambert(MU_SUN, earth.r, mars.r, tofSeconds);
    if (!sol) return null;

    const vInfDeparture = norm(sub(sol.v1, earth.v));
    const vInfArrival = norm(sub(sol.v2, mars.v));
    const dvDeparture = parkingOrbitBurn(MU_EARTH, PARKING_ORBIT_RADIUS.earth, vInfDeparture);
    const dvArrival = parkingOrbitBurn(MU_MARS, PARKING_ORBIT_RADIUS.mars, vInfArrival);

    return {
        delta_v: dvDeparture + dvArrival,
        dv_departure: dvDeparture,
        dv_arrival: dvArrival,
        v_inf_departure: vInfDeparture,
        v_inf_arrival: vInfArrival,
        c3: vInfDeparture * vInfDeparture, // km^2/s^2
    };
}

/** Cost of departing Earth at departureJD and arriving at Mars at arrivalJD. */
export function transferBetween(departureJD, arrivalJD) {
    const tof = (arrivalJD - departureJD) * 86400;
    const cost = evaluateTransfer(planetState('earth', departureJD), planetState('mars', arrivalJD), tof);
    return cost && { ...cost, tof_days: arrivalJD - departureJD };
}

function parseDay(str, label) {
    const date = new Date(str);
    if (Number.isNaN(date.getTime())) throw new RangeError(`${label} is not a valid date`);
    const year = date.getUTCFullYear();
    if (year < MIN_YEAR || year > MAX_YEAR) {
        throw new RangeError(`${label} must be between ${MIN_YEAR} and ${MAX_YEAR} (range of the ephemeris)`);
    }
    return dateToJulianDate(date);
}

function dayGrid(startJD, endJD, step) {
    const points = [];
    for (let jd = startJD; jd <= endJD; jd += step) {
        points.push({ jd, state: null });
    }
    return points;
}

/**
 * Find the cheapest transfer with departure inside the departure window and
 * arrival inside the arrival window (all dates inclusive, ISO yyyy-mm-dd, UTC).
 *
 * @returns {object|null} the optimum, or null if the windows admit no transfer
 *   (e.g. every arrival is before every departure). Alongside the optimum it
 *   returns `grid`, the delta-v of every sampled pair, for porkchop plots:
 *   grid.deltaV[i * grid.nArr + j] is the cost of departing on
 *   grid.dptStartJD + i * grid.step and arriving on grid.arrStartJD + j * grid.step
 *   (NaN where no transfer exists).
 */
export function findOptimalTransfer(launchStartStr, launchEndStr, arrivalStartStr, arrivalEndStr) {
    const dptStart = parseDay(launchStartStr, 'Departure start');
    const dptEnd = parseDay(launchEndStr, 'Departure end');
    const arrStart = parseDay(arrivalStartStr, 'Arrival start');
    const arrEnd = parseDay(arrivalEndStr, 'Arrival end');
    if (dptEnd < dptStart) throw new RangeError('Departure window ends before it starts');
    if (arrEnd < arrStart) throw new RangeError('Arrival window ends before it starts');

    const pairs = (dptEnd - dptStart + 1) * (arrEnd - arrStart + 1);
    const step = Math.max(1, Math.ceil(Math.sqrt(pairs / MAX_PAIRS)));

    // Earth depends only on the departure day and Mars only on the arrival
    // day, so compute each state once rather than once per pair.
    const departures = dayGrid(dptStart, dptEnd, step);
    const arrivals = dayGrid(arrStart, arrEnd, step);
    for (const d of departures) d.state = planetState('earth', d.jd);
    for (const a of arrivals) a.state = planetState('mars', a.jd);

    const deltaV = new Float32Array(departures.length * arrivals.length).fill(NaN);
    let best = null;
    departures.forEach((d, i) => {
        arrivals.forEach((a, j) => {
            const tof = (a.jd - d.jd) * 86400;
            if (tof <= 0) return;
            const cost = evaluateTransfer(d.state, a.state, tof);
            if (!cost) return;
            deltaV[i * arrivals.length + j] = cost.delta_v;
            if (best === null || cost.delta_v < best.delta_v) {
                best = { ...cost, dpt: d.jd, arr: a.jd };
            }
        });
    });
    if (best === null) return null;

    const { dpt, arr, ...result } = best;
    return {
        launch_time: julianDateToDate(dpt).toISOString().split('T')[0],
        arrival_time: julianDateToDate(arr).toISOString().split('T')[0],
        tof_days: arr - dpt,
        ...result,
        search_step_days: step,
        grid: {
            dptStartJD: dptStart,
            arrStartJD: arrStart,
            step,
            nDep: departures.length,
            nArr: arrivals.length,
            deltaV,
        },
    };
}
