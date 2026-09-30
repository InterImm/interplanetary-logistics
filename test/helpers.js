// Shared helpers for the physics tests.

export const norm = (a) => Math.hypot(a[0], a[1], a[2]);
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// Two-body equations of motion, integrated with fixed-step RK4. This is
// deliberately independent of the Lambert solver's own formulation.
export function propagate(mu, r0, v0, tof, steps = 40000) {
    const accel = (r) => {
        const k = -mu / norm(r) ** 3;
        return [r[0] * k, r[1] * k, r[2] * k];
    };
    const h = tof / steps;
    let r = [...r0];
    let v = [...v0];
    for (let i = 0; i < steps; i++) {
        const a1 = accel(r);
        const r2 = r.map((c, j) => c + 0.5 * h * v[j]);
        const v2 = v.map((c, j) => c + 0.5 * h * a1[j]);
        const a2 = accel(r2);
        const r3 = r.map((c, j) => c + 0.5 * h * v2[j]);
        const v3 = v.map((c, j) => c + 0.5 * h * a2[j]);
        const a3 = accel(r3);
        const r4 = r.map((c, j) => c + h * v3[j]);
        const v4 = v.map((c, j) => c + h * a3[j]);
        const a4 = accel(r4);
        r = r.map((c, j) => c + (h / 6) * (v[j] + 2 * v2[j] + 2 * v3[j] + v4[j]));
        v = v.map((c, j) => c + (h / 6) * (a1[j] + 2 * a2[j] + 2 * a3[j] + a4[j]));
    }
    return { r, v };
}
