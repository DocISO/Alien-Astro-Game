/**
 * Module 1 – Light Curve Logic
 *
 * Visual design:
 *   Transit : deep (1.5–5%), periodic dips, always clearly visible
 *   Noise   : small correlated wiggles (~0.3% range)
 *   Flat    : essentially straight line (~0.05% range)
 *
 * Habitable-zone bias (50% target):
 *   For each transit star the HZ period range is computed from its
 *   luminosity and stellar mass.  With 70% probability the planet is
 *   placed inside the HZ (period drawn from the HZ window).
 *   The observation window is extended to 60 days so that HZ planets
 *   with longer periods still show at least 1–2 clear transit events.
 */

"use strict";

const SAMPLES       = 300;
const DURATION_DAYS = 60;   // extended to capture longer-period HZ planets

function gaussianNoise(mean = 0, sigma = 1) {
  const u1 = Math.random(), u2 = Math.random();
  return mean + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts an orbital semi-major axis to a period in days.
 *   Kepler: P_years = sqrt(a³ / M_star)
 * @param {number} a_AU
 * @param {number} M_star   Solar masses
 * @returns {number} period in days
 */
function auToPeriodDays(a_AU, M_star) {
  return Math.sqrt(Math.pow(a_AU, 3) / M_star) * 365.25;
}

/**
 * Returns the habitable-zone period range [inner, outer] in days for a star.
 * Uses the same Kopparapu-simplified boundaries as planetAnalysis.js.
 * @param {number} luminosity   Solar luminosities
 * @param {number} M_star       Solar masses
 * @returns {{ inner: number, outer: number }}  days
 */
function hzPeriodRange(luminosity, M_star) {
  const inner_AU = Math.sqrt(luminosity / 1.1);
  const outer_AU = Math.sqrt(luminosity / 0.53);
  return {
    inner: auToPeriodDays(inner_AU, M_star),
    outer: auToPeriodDays(outer_AU, M_star),
  };
}

// ── Curve builders ────────────────────────────────────────────────────────────

function buildFlatCurve() {
  const time = [], flux = [];
  for (let i = 0; i < SAMPLES; i++) {
    time.push(parseFloat(((i / SAMPLES) * DURATION_DAYS).toFixed(4)));
    flux.push(parseFloat((1.0 + gaussianNoise(0, 0.0003)).toFixed(6)));
  }
  return { time, flux, type: "flat" };
}

function buildNoiseCurve() {
  const time = [], flux = [];
  let carry = 0;
  for (let i = 0; i < SAMPLES; i++) {
    carry = 0.88 * carry + gaussianNoise(0, 0.0004);
    time.push(parseFloat(((i / SAMPLES) * DURATION_DAYS).toFixed(4)));
    flux.push(parseFloat((1.0 + carry + gaussianNoise(0, 0.0001)).toFixed(6)));
  }
  return { time, flux, type: "noise" };
}

/**
 * Transit curve with habitable-zone bias.
 *
 * Period selection strategy:
 *   MAX_PERIOD = DURATION_DAYS − 5  so at least 1 transit fits in the window.
 *   With 70% probability: draw period from intersection of HZ range and
 *   [MIN_PERIOD, MAX_PERIOD].  If the HZ is entirely outside that range,
 *   fall back to a short random period.
 *   With 30% probability: short random period (2–15 days, hot inner planets).
 */
function buildTransitCurve(star) {
  const Rs    = Math.max(star.radius, 0.15);
  const M_star = Math.pow(Math.max(star.luminosity, 0.0001), 0.25);

  // ── 1. Choose orbital period ────────────────────────────────────────────────
  const MIN_PERIOD = 2;
  const MAX_PERIOD = DURATION_DAYS - 5;   // 55 days — guarantees ≥1 transit

  let period;
  const hz = hzPeriodRange(star.luminosity, M_star);

  // Clamp HZ window to detectable range
  const hzLo = Math.max(MIN_PERIOD, hz.inner);
  const hzHi = Math.min(MAX_PERIOD, hz.outer);
  const hzDetectable = hzLo < hzHi;

  if (hzDetectable && Math.random() < 0.70) {
    // Place planet inside the habitable zone
    period = hzLo + Math.random() * (hzHi - hzLo);
  } else {
    // Short-period hot planet (always visible, multiple transits)
    period = MIN_PERIOD + Math.random() * 13;
  }
  period = parseFloat(period.toFixed(3));

  // ── 2. Transit depth (always visually clear: 1.5–5%) ──────────────────────
  const deltaF   = 0.015 + Math.random() * 0.035;
  const Rp_solar = Math.sqrt(deltaF) * Rs;
  const Rp_earth = parseFloat((Rp_solar / 0.00916).toFixed(2));

  // ── 3. Build light curve ───────────────────────────────────────────────────
  const duration = period * 0.04;
  const phase0   = Math.random() * period;

  const time = [], flux = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t    = (i / SAMPLES) * DURATION_DAYS;
    const tmod = ((t - phase0) % period + period) % period;
    const ing  = duration * 0.2;
    let f = 1.0;
    if (tmod < duration) {
      if      (tmod < ing)            f = 1.0 - deltaF * (tmod / ing);
      else if (tmod > duration - ing) f = 1.0 - deltaF * ((duration - tmod) / ing);
      else                            f = 1.0 - deltaF;
    }
    f += gaussianNoise(0, 0.0003);
    time.push(parseFloat(t.toFixed(4)));
    flux.push(parseFloat(f.toFixed(6)));
  }

  const transitParams = {
    period_days:   period,
    duration_days: parseFloat(duration.toFixed(4)),
    depth:         parseFloat(deltaF.toFixed(6)),
    Rp_earth,
    Rp_solar:      parseFloat(Rp_solar.toFixed(5)),
    Rs,
  };

  return { time, flux, type: "transit", transitParams };
}

// ── Public factory ─────────────────────────────────────────────────────────────

function generateLightCurve(star) {
  switch (star.signalType) {
    case "transit": return buildTransitCurve(star);
    case "noise":   return buildNoiseCurve();
    default:        return buildFlatCurve();
  }
}

if (typeof module !== "undefined") {
  module.exports = { generateLightCurve, SAMPLES, DURATION_DAYS };
}
