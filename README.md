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
| `css/style.css` | Styles specific to this tool |
| `assets/ico/` | Logo and favicons, copied from interimm.org |

## Matching interimm.org

The header, footer, fonts, colour tokens and menu script come from the shared InterImm kit, which
interimm.org serves at `https://interimm.org/kit/interimm.css` and `https://interimm.org/kit/interimm.js`
(source and notes: [InterImm/interimm.github.io `kit/`](https://github.com/InterImm/interimm.github.io/blob/hugo/kit/README.md)).
Nothing is copied, so this page follows the main site's look automatically. The script also fills in the
header and footer from interimm.org's current menu; the markup in `index.html` is only the fallback.
Anything specific to this tool goes in `css/style.css`, which only uses the kit's tokens.

Running locally still loads the kit from interimm.org, so it needs an internet connection to look right.
