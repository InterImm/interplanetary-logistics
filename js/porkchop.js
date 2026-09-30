// Porkchop plot: total delta-v for every (departure, arrival) pair searched,
// drawn on a canvas. Departure runs left to right, arrival bottom to top, and
// brighter means cheaper. The scale is anchored at the optimum and saturates
// COLOR_RANGE_KMS above it, so the shape of the launch window stays readable.

import { julianDateToDate, dateToJulianDate } from './ephemeris.js';

export const COLOR_RANGE_KMS = 3;

// Viridis, cheapest first
const STOPS = [[253, 231, 37], [94, 201, 98], [33, 145, 140], [59, 82, 139], [68, 1, 84]];
export const LEGEND_GRADIENT = `linear-gradient(90deg, ${STOPS.map((c) => `rgb(${c})`).join(', ')})`;

const LUT = Array.from({ length: 256 }, (_, n) => {
    const x = (n / 255) * (STOPS.length - 1);
    const k = Math.min(STOPS.length - 2, Math.floor(x));
    return STOPS[k].map((c, i) => Math.round(c + (STOPS[k + 1][i] - c) * (x - k)));
});

const MARGIN = { right: 14, top: 14, bottom: 48 };
const marginLeft = (width) => (width < 480 ? 76 : 88); // room for the y tick labels and title
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// First-of-month ticks, thinned so at most maxTicks fit
function monthTicks(startJD, endJD, maxTicks) {
    const start = julianDateToDate(startJD);
    const end = julianDateToDate(endJD);
    const first = start.getUTCFullYear() * 12 + start.getUTCMonth();
    const last = end.getUTCFullYear() * 12 + end.getUTCMonth();
    const every = [1, 2, 3, 6, 12, 24, 60, 120].find((s) => (last - first + 1) / s <= maxTicks) ?? 120;
    const ticks = [];
    for (let n = first; n <= last; n++) {
        if (n % every !== 0) continue;
        const date = new Date(Date.UTC(Math.floor(n / 12), n % 12, 1));
        if (date < start || date > end) continue;
        ticks.push({ jd: dateToJulianDate(date), label: `${MONTHS[n % 12]} ${Math.floor(n / 12)}` });
    }
    return ticks;
}

export function createPorkchop(canvas, tooltip) {
    const ctx = canvas.getContext('2d');
    let grid = null;
    let best = null;
    let image = null; // one pixel per grid cell
    let hover = null;

    function buildImage() {
        const { nDep, nArr, deltaV } = grid;
        const data = new ImageData(nDep, nArr);
        for (let i = 0; i < nDep; i++) {
            for (let j = 0; j < nArr; j++) {
                const v = deltaV[i * nArr + j];
                if (Number.isNaN(v)) continue;
                const level = Math.min(255, Math.max(0, Math.round(((v - best.delta_v) / COLOR_RANGE_KMS) * 255)));
                const [r, g, b] = LUT[level];
                data.data.set([r, g, b, 255], ((nArr - 1 - j) * nDep + i) * 4);
            }
        }
        image = document.createElement('canvas');
        image.width = nDep;
        image.height = nArr;
        image.getContext('2d').putImageData(data, 0, 0);
    }

    const plotRect = () => {
        const left = marginLeft(canvas.clientWidth);
        return {
            x: left,
            y: MARGIN.top,
            w: canvas.clientWidth - left - MARGIN.right,
            h: canvas.clientHeight - MARGIN.top - MARGIN.bottom,
        };
    };

    // Pixel position of the centre of a (fractional) grid cell
    const xOf = (p, i) => p.x + ((i + 0.5) / grid.nDep) * p.w;
    const yOf = (p, j) => p.y + p.h - ((j + 0.5) / grid.nArr) * p.h;

    function draw() {
        if (!grid || !canvas.clientWidth) return;
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const css = getComputedStyle(canvas);
        const theme = (name) => css.getPropertyValue(name).trim();
        const p = plotRect();

        ctx.fillStyle = theme('--plot-empty');
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, p.x, p.y, p.w, p.h);

        // Axes
        ctx.font = `12px ${css.fontFamily}`;
        ctx.fillStyle = theme('--plot-text');
        ctx.strokeStyle = theme('--plot-grid');
        ctx.lineWidth = 1;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const dptEnd = grid.dptStartJD + (grid.nDep - 1) * grid.step;
        const arrEnd = grid.arrStartJD + (grid.nArr - 1) * grid.step;
        for (const t of monthTicks(grid.dptStartJD, dptEnd, Math.max(2, Math.floor(p.w / 76)))) {
            const x = Math.round(xOf(p, (t.jd - grid.dptStartJD) / grid.step)) + 0.5;
            ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h); ctx.stroke();
            ctx.fillText(t.label, x, p.y + p.h + 8);
        }
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (const t of monthTicks(grid.arrStartJD, arrEnd, Math.max(2, Math.floor(p.h / 34)))) {
            const y = Math.round(yOf(p, (t.jd - grid.arrStartJD) / grid.step)) + 0.5;
            ctx.beginPath(); ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y); ctx.stroke();
            ctx.fillText(t.label, p.x - 8, y);
        }
        ctx.strokeStyle = theme('--plot-frame');
        ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);

        ctx.fillStyle = theme('--plot-muted');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Departure from Earth', p.x + p.w / 2, h - 4);
        ctx.save();
        ctx.translate(12, p.y + p.h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textBaseline = 'top';
        ctx.fillText('Arrival at Mars', 0, 0);
        ctx.restore();

        // Cursor cross-hair, then the optimum
        if (hover) {
            ctx.strokeStyle = theme('--plot-cursor');
            ctx.setLineDash([4, 4]);
            const hx = Math.round(xOf(p, hover.i)) + 0.5;
            const hy = Math.round(yOf(p, hover.j)) + 0.5;
            ctx.beginPath(); ctx.moveTo(hx, p.y); ctx.lineTo(hx, p.y + p.h);
            ctx.moveTo(p.x, hy); ctx.lineTo(p.x + p.w, hy); ctx.stroke();
            ctx.setLineDash([]);
        }
        const bi = Math.round((dateToJulianDate(new Date(best.launch_time)) - grid.dptStartJD) / grid.step);
        const bj = Math.round((dateToJulianDate(new Date(best.arrival_time)) - grid.arrStartJD) / grid.step);
        const bx = xOf(p, bi);
        const by = yOf(p, bj);
        ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.lineWidth = 5; ctx.strokeStyle = theme('--plot-marker-halo'); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = theme('--plot-marker'); ctx.stroke();
        ctx.fillStyle = theme('--plot-marker'); ctx.beginPath(); ctx.arc(bx, by, 1.8, 0, Math.PI * 2); ctx.fill();
    }

    function showTooltip(e) {
        const p = plotRect();
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const i = Math.floor(((x - p.x) / p.w) * grid.nDep);
        const j = grid.nArr - 1 - Math.floor(((y - p.y) / p.h) * grid.nArr);
        const v = i >= 0 && j >= 0 && i < grid.nDep && j < grid.nArr ? grid.deltaV[i * grid.nArr + j] : NaN;
        const next = Number.isNaN(v) ? null : { i, j };
        if (next?.i !== hover?.i || next?.j !== hover?.j) {
            hover = next;
            draw();
        }
        if (!hover) { tooltip.hidden = true; return; }

        const dpt = julianDateToDate(grid.dptStartJD + i * grid.step);
        const arr = julianDateToDate(grid.arrStartJD + j * grid.step);
        const days = Math.round((arr - dpt) / 86400000);
        tooltip.innerHTML = `<b>${v.toFixed(2)} km/s</b><span>${dateFmt.format(dpt)} &rarr; ${dateFmt.format(arr)} &middot; ${days} days</span>`;
        tooltip.hidden = false;
        const flip = x + 16 + tooltip.offsetWidth > canvas.clientWidth;
        tooltip.style.left = `${flip ? x - 16 - tooltip.offsetWidth : x + 16}px`;
        tooltip.style.top = `${Math.max(0, Math.min(y - 8, canvas.clientHeight - tooltip.offsetHeight))}px`;
    }

    canvas.addEventListener('pointermove', (e) => grid && showTooltip(e));
    canvas.addEventListener('pointerleave', () => {
        hover = null;
        tooltip.hidden = true;
        draw();
    });
    new ResizeObserver(draw).observe(canvas);
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', draw);

    return {
        update(newGrid, newBest) {
            grid = newGrid;
            best = newBest;
            hover = null;
            tooltip.hidden = true;
            buildImage();
            draw();
        },
    };
}
