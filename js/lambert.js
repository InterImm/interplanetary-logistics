// Lambert's problem: find the orbit that connects two position vectors in a
// given time under the gravity of a single central body.
//
// Izzo's formulation (D. Izzo, "Revisiting Lambert's problem", Celest. Mech.
// Dyn. Astron. 121, 2015), zero-revolution case only. The time of flight is a
// monotonically decreasing function of the free variable x on (-1, inf), so a
// Halley iteration safeguarded by bisection always converges.

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.sqrt(dot(a, a));
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];

// Gauss hypergeometric function 2F1(3, 1; 5/2; x), used by Battin's series.
function hyp2f1b(x) {
    if (x >= 1) return Infinity;
    let res = 1;
    let term = 1;
    for (let i = 0; i < 200; i++) {
        term = (term * (3 + i) * (1 + i)) / (2.5 + i) * x / (i + 1);
        const next = res + term;
        if (next === res) break;
        res = next;
    }
    return res;
}

// Non-dimensional time of flight T(x) for the zero-revolution case.
function timeOfFlight(x, lam) {
    const y = Math.sqrt(1 - lam * lam * (1 - x * x));
    if (x > Math.sqrt(0.6) && x < Math.sqrt(1.4)) {
        // Battin's series: well conditioned close to the parabola (x = 1)
        const eta = y - lam * x;
        const S1 = (1 - lam - x * eta) / 2;
        const Q = (4 / 3) * hyp2f1b(S1);
        return (eta * eta * eta * Q + 4 * lam * eta) / 2;
    }
    const psi = x < 1
        ? Math.acos(x * y + lam * (1 - x * x))
        : Math.asinh((y - x * lam) * Math.sqrt(x * x - 1));
    return ((psi / Math.sqrt(Math.abs(1 - x * x)) - x + lam * y)) / (1 - x * x);
}

// First three derivatives of T(x)
function timeDerivatives(x, lam, T) {
    const l2 = lam * lam;
    const l3 = l2 * lam;
    const umx2 = 1 - x * x;
    const y = Math.sqrt(1 - l2 * umx2);
    const y2 = y * y;
    const y3 = y2 * y;
    const d1 = (3 * T * x - 2 + (2 * l3 * x) / y) / umx2;
    const d2 = (3 * T + 5 * x * d1 + (2 * (1 - l2) * l3) / y3) / umx2;
    return [d1, d2];
}

function initialGuess(T, lam) {
    const T0 = Math.acos(lam) + lam * Math.sqrt(1 - lam * lam); // T(x = 0)
    const T1 = (2 / 3) * (1 - lam ** 3); // T(x = 1)
    if (T >= T0) return Math.pow(T0 / T, 2 / 3) - 1;
    if (T < T1) return (2.5 * T1 / T) * (T1 - T) / (1 - lam ** 5) + 1;
    return Math.pow(T0 / T, Math.log2(T1 / T0)) - 1;
}

function solveX(lam, T) {
    let x = initialGuess(T, lam);
    let lo = -1;
    let hi = Infinity;

    for (let iter = 0; iter < 200; iter++) {
        const Tx = timeOfFlight(x, lam);
        const f = Tx - T;
        if (Math.abs(f) < 1e-13 * T) return x;

        // T decreases with x: too slow means the true root is at larger x.
        if (f > 0) lo = x; else hi = x;

        let xn = NaN;
        const [d1, d2] = timeDerivatives(x, lam, Tx);
        const denom = 2 * d1 * d1 - f * d2;
        if (denom !== 0) xn = x - (2 * f * d1) / denom; // Halley

        if (!Number.isFinite(xn) || xn <= lo || xn >= hi) {
            xn = Number.isFinite(hi) ? (lo + hi) / 2 : 2 * lo + 1 + Math.abs(lo);
        }
        if (Math.abs(xn - x) < 1e-14 * (1 + Math.abs(x))) return xn;
        x = xn;
    }
    return x;
}

/**
 * Solve Lambert's problem for a prograde (counter-clockwise about +z) orbit
 * of less than one revolution.
 *
 * @param {number} mu  gravitational parameter of the central body, km^3/s^2
 * @param {number[]} r1  initial position, km
 * @param {number[]} r2  final position, km
 * @param {number} tof  time of flight, s
 * @returns {{v1: number[], v2: number[]} | null} velocities at r1 and r2
 *   (km/s), or null if the geometry is degenerate (r1 and r2 collinear with
 *   the central body, where the orbital plane is undefined) or tof <= 0.
 */
export function lambert(mu, r1, r2, tof) {
    if (!(tof > 0)) return null;

    const r1n = norm(r1);
    const r2n = norm(r2);
    const c = sub(r2, r1);
    const cn = norm(c);
    const s = (r1n + r2n + cn) / 2;

    const ir1 = scale(r1, 1 / r1n);
    const ir2 = scale(r2, 1 / r2n);
    let ih = cross(ir1, ir2);
    const ihn = norm(ih);
    if (ihn < 1e-9) return null;
    ih = scale(ih, 1 / ihn);

    // lam = +sqrt(1 - c/s) for a transfer angle under pi, negative over pi.
    // The transfer is prograde if its angular momentum points along +z, so a
    // downward-pointing r1 x r2 means the prograde path is the long way round.
    let lam = Math.sqrt(1 - Math.min(1, cn / s));
    let it1, it2;
    if (ih[2] < 0) {
        lam = -lam;
        it1 = cross(ir1, ih);
        it2 = cross(ir2, ih);
    } else {
        it1 = cross(ih, ir1);
        it2 = cross(ih, ir2);
    }

    const T = Math.sqrt((2 * mu) / (s * s * s)) * tof;
    const x = solveX(lam, T);
    const y = Math.sqrt(1 - lam * lam * (1 - x * x));

    const gamma = Math.sqrt((mu * s) / 2);
    const rho = (r1n - r2n) / cn;
    const sigma = Math.sqrt(1 - rho * rho);

    const vr1 = (gamma * ((lam * y - x) - rho * (lam * y + x))) / r1n;
    const vr2 = (-gamma * ((lam * y - x) + rho * (lam * y + x))) / r2n;
    const vt1 = (gamma * sigma * (y + lam * x)) / r1n;
    const vt2 = (gamma * sigma * (y + lam * x)) / r2n;

    return {
        v1: add(scale(ir1, vr1), scale(it1, vt1)),
        v2: add(scale(ir2, vr2), scale(it2, vt2)),
    };
}
