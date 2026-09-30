# Interplanetary Logistics

## Algorithms

### Cheapest delta v

For a departure window and an arrival window, choose the departure and arrival
day (both inside their windows, arrival after departure) whose transfer needs
the least total delta v.

For each candidate pair of days:

1. **Planet states.** Earth's position and velocity at departure and Mars's at
   arrival, from the JPL approximate Keplerian elements (Standish, valid
   1800-2050), in the heliocentric ecliptic J2000 frame.
2. **Transfer orbit.** Solve Lambert's problem for the prograde,
   zero-revolution heliocentric orbit that starts at Earth's position and
   reaches Mars's position after the chosen time of flight. This gives the
   spacecraft's heliocentric velocity at both ends.
3. **Excess velocity.** `v_inf` at each end is the difference between the
   spacecraft's heliocentric velocity and the planet's. Launch energy is
   `C3 = v_inf_departure^2`.
4. **Burns.** A spacecraft does not burn the heliocentric difference directly:
   it burns at periapsis of a hyperbola around the planet, which is cheaper
   because of the Oberth effect. From (or into) a circular orbit of radius `r`:

   `dv = sqrt(v_inf^2 + 2 mu / r) - sqrt(mu / r)`

   Earth departure is from a 300 km circular orbit, and Mars arrival is
   propulsive capture into a 300 km circular orbit. Total delta v is the sum of
   the two burns.

The search evaluates every whole day in both windows (coarser steps only if the
windows are so large that it would exceed two million Lambert solutions).

### Porkchop plot

The search already computes the delta v of every date pair, so the page draws
all of them: departure on the x axis, arrival on the y axis, brighter meaning
cheaper. The two lobes are the short-way and long-way transfers, pinched along
the diagonal where the transfer angle is 180 degrees. The colour scale starts at
the optimum and saturates 3 km/s above it.

### Price

`price = delta_v * euros_per_delta_v`, with `euros_per_delta_v` defaulting to
`1/50` (euros per kg per km/s). This rate is a placeholder, not derived from
launch costs; at about 5.7 km/s it gives roughly 0.11 euro per kg.

## Assumptions and limits

- Impulsive burns, a single heliocentric revolution, prograde only, no gravity
  assists, no deep-space manoeuvres.
- No aerobraking or aerocapture at Mars; that would lower the arrival burn.
- "Earth" is the Earth-Moon barycenter, and UTC is treated as TDB. Both are
  well below the ephemeris error.
- Ephemeris accuracy, measured against JPL Horizons (DE) for 2026-2034: Earth
  within 16,000 km and 2 m/s, Mars within 61,000 km (about 1 arcminute) and
  5 m/s. Re-running the whole search on JPL's positions gave the same optimum
  dates in all four launch windows and a total delta v within 1 m/s. The quoted
  accuracy of the elements is similar across 1800-2050, but only 2026-2034 has
  been compared directly. Dates outside 1800-2050 are rejected.
- The search samples whole days. Against a continuous optimisation of the dates
  this costs under 0.1 m/s.
- When Earth at departure and Mars at arrival are within a degree or so of
  exactly opposite each other, the transfer plane is poorly defined. Those pairs
  usually need an enormous plane change (median about 56 km/s in a scan of
  2026), so they are never the cheapest; exactly collinear pairs have no
  solution and are skipped.

## Validation

`npm test` checks:

- **Against NASA/JPL Horizons** (reference data in `test/fixtures/`, with its
  provenance):
  - planet positions and velocities over 2026-2034;
  - the optimum dates, delta v and C3 of four launch windows, against a full
    search run on JPL's planet positions;
  - the Lambert solver on the real flown cruise trajectories of Mars 2020
    (Perseverance) and MAVEN: the solved velocity matches the real one to
    within 9 m/s out of about 31,000 m/s, the remainder being course corrections
    and planetary gravity that a Sun-only model leaves out.
- **Lambert solver:** a textbook example, plus numerically integrating the
  returned orbit under two-body gravity and confirming it arrives at the target
  position and velocity (short way, long way, hyperbolic, near-full-period). It
  was also compared with a separately written universal-variable solver on
  1,500 real Earth-Mars pairs, with agreement below 0.0001 m/s.
- **Ephemeris:** published Earth-Mars closest-approach dates and distances
  (2003, 2018, 2020), Earth's longitude at J2000, orbit radii, periods,
  inclination, and vis-viva speeds.
- **End to end:** launch energies of the actual Mars 2020 and InSight
  trajectories, that the optimum in the 2020 window falls in the real 2020
  launch window, and that the optimiser returns the same minimum as brute force.
