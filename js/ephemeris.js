// Heliocentric positions and velocities of Earth and Mars.
//
// Uses the JPL "Keplerian Elements for Approximate Positions of the Major
// Planets" (E.M. Standish, Table 1, valid 1800-2050). Each element is a linear
// function of time, referred to the mean ecliptic and equinox of J2000.
//
// Quoted accuracy over 1800-2050 is a few tens of arcseconds, i.e. roughly
// 10^4 km for Mars. Over a ~250 day transfer that is a few m/s of delta-v,
// which is negligible for pricing. "Earth" is the Earth-Moon barycenter.
//
// Units: km, km/s, seconds. Time is a Julian Date (TDB is treated as UTC; the
// ~70 s difference is irrelevant at this accuracy).

export const AU = 149597870.7; // km
export const MU_SUN = 1.32712440018e11; // km^3/s^2

const J2000 = 2451545.0;
const DAYS_PER_CENTURY = 36525;
const DEG = Math.PI / 180;

// [value at J2000, rate per Julian century]
const ELEMENTS = {
    earth: {
        a: [1.00000261, 0.00000562], // AU
        e: [0.01671123, -0.00004392],
        I: [-0.00001531, -0.01294668], // deg
        L: [100.46457166, 35999.37244981], // mean longitude, deg
        peri: [102.93768193, 0.32327364], // longitude of perihelion, deg
        node: [0.0, 0.0], // longitude of ascending node, deg
    },
    mars: {
        a: [1.52371034, 0.00001847],
        e: [0.09339410, 0.00007882],
        I: [1.84969142, -0.00813131],
        L: [-4.55343205, 19140.30268499],
        peri: [-23.94362959, 0.44441088],
        node: [49.55953891, -0.29257343],
    },
};

function at(pair, T) {
    return pair[0] + pair[1] * T;
}

// Solve Kepler's equation E - e sin(E) = M for the eccentric anomaly.
function solveKepler(M, e) {
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 20; i++) {
        const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E -= dE;
        if (Math.abs(dE) < 1e-13) break;
    }
    return E;
}

// Position only, from the osculating elements at a Julian Date.
function position(el, jd) {
    const T = (jd - J2000) / DAYS_PER_CENTURY;

    const a = at(el.a, T) * AU;
    const e = at(el.e, T);
    const I = at(el.I, T) * DEG;
    const peri = at(el.peri, T);
    const node = at(el.node, T) * DEG;
    const w = peri * DEG - node; // argument of perihelion

    // Mean anomaly, wrapped to [-pi, pi]
    let M = (at(el.L, T) - peri) * DEG;
    M = Math.atan2(Math.sin(M), Math.cos(M));

    const E = solveKepler(M, e);

    // Position in the orbital plane
    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

    // Rotate into the J2000 ecliptic frame
    const cw = Math.cos(w), sw = Math.sin(w);
    const cO = Math.cos(node), sO = Math.sin(node);
    const cI = Math.cos(I), sI = Math.sin(I);

    return [
        (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
        (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
        sw * sI * xp + cw * sI * yp,
    ];
}

/**
 * State of a planet at a Julian Date.
 *
 * The velocity is the time derivative of the position model (central
 * difference), so it includes the slow precession of the orbit that a purely
 * Keplerian velocity would miss.
 *
 * @param {'earth'|'mars'} body
 * @param {number} jd
 * @returns {{r: number[], v: number[]}} heliocentric ecliptic J2000, km and km/s
 */
export function planetState(body, jd) {
    const el = ELEMENTS[body];
    const h = 0.01; // days
    const ahead = position(el, jd + h);
    const behind = position(el, jd - h);
    return {
        r: position(el, jd),
        v: ahead.map((c, i) => (c - behind[i]) / (2 * h * 86400)),
    };
}

export function dateToJulianDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
}

export function julianDateToDate(jd) {
    return new Date((jd - 2440587.5) * 86400000);
}
