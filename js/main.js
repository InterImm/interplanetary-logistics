import { findOptimalTransfer } from './orbital_engine.js';
import { PricingEngine } from './pricing_engine.js';
import { createPorkchop, COLOR_RANGE_KMS, LEGEND_GRADIENT } from './porkchop.js';

// Upcoming Earth-Mars launch windows: departure and arrival search ranges
// centred on each window's cheapest transfer.
const PRESETS = [
    { label: '2026', dpt: ['2026-08-01', '2027-01-31'], arr: ['2027-04-01', '2028-02-01'] },
    { label: '2028–29', dpt: ['2028-09-01', '2029-03-01'], arr: ['2029-04-15', '2030-02-15'] },
    { label: '2031', dpt: ['2030-09-25', '2031-03-25'], arr: ['2031-05-01', '2032-03-01'] },
    { label: '2033', dpt: ['2033-01-15', '2033-07-15'], arr: ['2033-07-01', '2034-04-01'] },
];

const $ = (id) => document.getElementById(id);
const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtDate = (iso) => dateFmt.format(new Date(iso));

document.addEventListener('DOMContentLoaded', () => {
    const form = $('transfer-form');
    const inputs = ['dpt-start', 'dpt-end', 'arr-start', 'arr-end'].map($);
    const submit = $('submit');
    const errorBox = $('form-error');
    const status = $('status');
    const results = $('results');
    const porkchop = createPorkchop($('porkchop'), $('plot-tip'));

    $('legend-bar').style.background = LEGEND_GRADIENT;

    // --- Presets -----------------------------------------------------------
    const chips = PRESETS.map((preset) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = preset.label;
        chip.setAttribute('aria-pressed', 'false');
        chip.addEventListener('click', () => {
            [inputs[0].value, inputs[1].value] = preset.dpt;
            [inputs[2].value, inputs[3].value] = preset.arr;
            markPreset(chip);
            run();
        });
        $('presets').append(chip);
        return chip;
    });

    function markPreset(active) {
        chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip === active)));
    }

    inputs.forEach((input) => input.addEventListener('input', () => markPreset(null)));

    // --- State helpers -----------------------------------------------------
    function setBusy(busy) {
        submit.setAttribute('aria-busy', String(busy));
        submit.disabled = busy;
        $('submit-label').textContent = busy ? 'Solving orbits…' : 'Find cheapest transfer';
        status.textContent = busy ? 'Solving transfer orbits…' : '';
    }

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
        results.hidden = true;
    }

    // --- Rendering ---------------------------------------------------------
    function render(optimal) {
        const pricing = new PricingEngine({ delta_v: optimal.delta_v });

        $('out-price').textContent = pricing.price().toFixed(2);
        $('out-rate').textContent = pricing.euros_per_delta_v;

        $('out-dpt').textContent = fmtDate(optimal.launch_time);
        $('out-arr').textContent = fmtDate(optimal.arrival_time);
        $('out-tof').textContent = `${Math.round(optimal.tof_days)} days`;
        $('out-dv').textContent = `${optimal.delta_v.toFixed(2)} km/s`;
        $('out-c3').textContent = `${optimal.c3.toFixed(1)} km²/s²`;
        $('out-vinf').textContent = `${optimal.v_inf_arrival.toFixed(2)} km/s`;

        $('out-dv-dep').textContent = `${optimal.dv_departure.toFixed(2)} km/s`;
        $('out-dv-arr').textContent = `${optimal.dv_arrival.toFixed(2)} km/s`;
        $('seg-dep').style.width = `${(optimal.dv_departure / optimal.delta_v) * 100}%`;
        $('seg-arr').style.width = `calc(${(optimal.dv_arrival / optimal.delta_v) * 100}% - 2px)`;
        $('split').setAttribute(
            'aria-label',
            `Earth departure burn ${optimal.dv_departure.toFixed(2)} km/s, Mars capture burn ${optimal.dv_arrival.toFixed(2)} km/s`
        );

        $('legend-min').textContent = `${optimal.delta_v.toFixed(2)} km/s`;
        $('legend-max').textContent = `≥ ${(optimal.delta_v + COLOR_RANGE_KMS).toFixed(2)} km/s`;

        const note = $('plot-note');
        note.hidden = optimal.search_step_days === 1;
        note.textContent = `Large window: sampled every ${optimal.search_step_days} days, so the optimum may be a few days off.`;

        $('porkchop').setAttribute(
            'aria-label',
            `Porkchop plot of total delta-v by departure date and arrival date. Cheapest: depart ${fmtDate(optimal.launch_time)}, arrive ${fmtDate(optimal.arrival_time)}, ${optimal.delta_v.toFixed(2)} kilometres per second.`
        );

        results.hidden = false; // the canvas needs a size before it can draw
        porkchop.update(optimal.grid, optimal);
    }

    // --- Run ---------------------------------------------------------------
    function run() {
        errorBox.hidden = true;
        setBusy(true);

        // Let the browser paint the busy state before the search blocks the thread
        setTimeout(() => {
            try {
                const [dptStart, dptEnd, arrStart, arrEnd] = inputs.map((input) => input.value);
                const optimal = findOptimalTransfer(dptStart, dptEnd, arrStart, arrEnd);
                if (optimal === null) {
                    showError('No transfer is possible: every arrival date is before every departure date.');
                } else {
                    render(optimal);
                }
            } catch (err) {
                if (err instanceof RangeError) {
                    showError(err.message);
                } else {
                    console.error(err);
                    showError('Something went wrong during the calculation.');
                }
            } finally {
                setBusy(false);
            }
        }, 30);
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        run();
    });

    chips[0].click();
});
