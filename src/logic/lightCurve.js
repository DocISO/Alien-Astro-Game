/**
 * Module 1 – Light Curve Logic
 *
 * Visual design principle (game clarity over physical accuracy):
 *   Transit : deep (2–5%), periodic, unmistakeable dips — multiple visible
 *   Noise   : small correlated wiggles (~0.3% range)
 *   Flat    : essentially straight line (~0.05% range)
 *
 * Transit depth formula retained for physical correctness in Module 2,
 * but planet radius is chosen large enough (3–8 R⊕) that the dip is
 * always clearly visible at ≥ 1% flux drop.
 */

"use strict";

const SAMPLES       = 300;
const DURATION_DAYS = 30;

function gaussianNoise(mean = 0, sigma = 1) {
  const u1 = Math.random(), u2 = Math.random();
  return mean + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Flat curve — almost perfectly straight, tiny photon noise.
 */
function buildFlatCurve() {
  const time = [], flux = [];
  for (let i = 0; i < SAMPLES; i++) {
    time.push(parseFloat(((i / SAMPLES) * DURATION_DAYS).toFixed(4)));
    flux.push(parseFloat((1.0 + gaussianNoise(0, 0.0003)).toFixed(6)));
  }
  return { time, flux, type: "flat" };
}

/**
 * Noise curve — irregular stellar variability, clearly NOT periodic.
 * Range ~0.3% so it is visually distinct from transits (≥1%).
 */
function buildNoiseCurve() {
  const time = [], flux = [];
  let carry = 0;
  for (let i = 0; i < SAMPLES; i++) {
    carry = 0.88 * carry + gaussianNoise(0, 0.0004);   // max range ~0.3%
    time.push(parseFloat(((i / SAMPLES) * DURATION_DAYS).toFixed(4)));
    flux.push(parseFloat((1.0 + carry + gaussianNoise(0, 0.0001)).toFixed(6)));
  }
  return { time, flux, type: "noise" };
}

/**
 * Transit curve — clearly periodic, deep dips (2–5% flux drop).
 *
 * Planet radius is chosen in the 3–8 R⊕ range (mini-Neptunes / gas giants)
 * so the transit depth is always visually obvious regardless of star size.
 * The physics passed to Module 2 are still self-consistent.
 *
 * Period is capped at 12 days so at least 2 full transits appear in
 * the 30-day observation window.
 */
function buildTransitCurve(star) {
  const Rs = Math.max(star.radius, 0.15);

  // Set depth first (1.5–5%) so the dip is ALWAYS clearly visible,
  // then derive planet radius — keeps Module 2 physics self-consistent.
  const deltaF   = 0.015 + Math.random() * 0.035;     // 1.5 – 5.0 %
  const Rp_solar = Math.sqrt(deltaF) * Rs;
  const Rp_earth = parseFloat((Rp_solar / 0.00916).toFixed(2));

  // Period 2–12 days → at least 2 transits in 30-day window
  const period   = 2 + Math.random() * 10;
  const duration = period * 0.04;                      // transit lasts 4% of period
  const phase0   = Math.random() * period;             // random start phase

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
    f += gaussianNoise(0, 0.0003);   // photon noise much smaller than dip
    time.push(parseFloat(t.toFixed(4)));
    flux.push(parseFloat(f.toFixed(6)));
  }

  const transitParams = {
    period_days:   parseFloat(period.toFixed(3)),
    duration_days: parseFloat(duration.toFixed(4)),
    depth:         parseFloat(deltaF.toFixed(6)),
    Rp_earth:      parseFloat(Rp_earth.toFixed(2)),
    Rp_solar:      parseFloat(Rp_solar.toFixed(5)),
    Rs,
  };

  return { time, flux, type: "transit", transitParams };
}

/**
 * Public factory.
 */
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
