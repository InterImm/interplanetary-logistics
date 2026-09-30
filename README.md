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
| `css/site.css`, `js/site.js` | Header, footer, colours and buttons shared with interimm.org |
| `assets/ico/` | Logo and favicons, copied from interimm.org |

## Matching interimm.org

The header, footer, colour tokens and menu script are copied from the landing
site ([InterImm/interimm.github.io](https://github.com/InterImm/interimm.github.io),
branch `hugo`: `assets/css/main.css`, `assets/js/main.js`, `hugo.yaml` for the menu and
`data/footer.yml` for the footer). The copy in `css/site.css` and `js/site.js` is
verbatim, so when the landing site changes its look, re-copy those sections and update
the header and footer markup in `index.html` to match. Anything specific to this
tool goes in `css/style.css`, which only uses the shared tokens.
