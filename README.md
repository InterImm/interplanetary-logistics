# Interplanetary Logistics

A static web page that finds the cheapest Earth-to-Mars shipment window inside the
departure and arrival dates you choose, and prices it from the required delta-v.
Everything runs in the browser; there is no server.

## Run

Any static file server works (the page uses ES modules, so it needs `http://`, not `file://`):

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Test

```bash
npm test
```

No dependencies; this uses Node's built-in test runner (Node 22+).

## How it works

See [docs/index.md](docs/index.md) for the method and its assumptions.

| File | Role |
| --- | --- |
| `js/ephemeris.js` | Heliocentric position and velocity of Earth and Mars (JPL approximate elements, 1800-2050) |
| `js/lambert.js` | Lambert solver (Izzo) for the transfer orbit between two positions |
| `js/orbital_engine.js` | Delta-v of a transfer, and the search over the departure and arrival windows |
| `js/porkchop.js` | Canvas porkchop plot of delta-v over the searched dates |
| `js/pricing_engine.js` | Turns delta-v into a price |
| `js/main.js` | Page wiring |
