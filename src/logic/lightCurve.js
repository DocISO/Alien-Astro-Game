/**
 * Module 1 – Light Curve Logic
 * Generates realistic photometric time-series for three signal types.
 *
 * Transit model: box-shaped dip (simplified trapezoidal transit)
 *   ΔF/F = (Rp/Rs)²   — flux drop proportional to planet/star area ratio
 *
 * Units:
 *   time  → days (0 to 30 days window, 300 samples → one per 2.4 hours)
 *   flux  → normalised relative flux (1.0 = baseline)
 */

"use strict";

const SAMPLES       = 300;   // data points per light curve
const DURATION_DAYS = 30;    // observation window in days

/**
 * Gaussian noise helper.
 * Box-Muller transform → standard-normal sample.
 */
function gaussianNoise(mean = 0, sigma = 1) {
  const u1 = Math.random(), u2 = Math.random();
  return mean + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Builds a flat (no signal) light curve with tiny photon noise.
 * @returns {{ time: number[], flux: number[] }}
 */
function buildFlatCurve() {
  const time = [], flux = [];
  for (let i = 0; i < SAMPLES; i++) {
    time.push(parseFloat(((i / SAMPLES) * DURATION_DAYS).toFixed(4)));
    flux.push(parseFloat((1.0 + gaussianNoise(0, 0.0005)).toFixed(6)));
  }
  return { time, flux, type: "flat" };
}

/**
 * Builds a noise-only curve (stellar variability / instrumental artefacts).
 * Uses correlated noise to mimic real systematics — not purely white.
 */
function buildNoiseCurve() {
  const time = [], flux = [];
  let carry = 0; // correlated component
  for (let i = 0; i < SAMPLES; i++) {
    carry = 0.85 * carry + gaussianNoise(0, 0.0015); // AR(1) process
    const point = 1.0 + carry + gaussianNoise(0, 0.0005);
    time.push(parseFloat(((i / SAMPLES) * DURATION_DAYS).toFixed(4)));
    flux.push(parseFloat(point.toFixed(6)));
  }
  return { time, flux, type: "noise" };
}

/**
 * Builds a transit light curve using a simplified trapezoid model.
 *
 * @param {object} star  Star object from catalog (needs .radius, .luminosity)
 * @returns {{ time, flux, type, transitParams }}
 *   transitParams contains the derived planet properties used by Module 2.
 */
function buildTransitCurve(star) {
  // --- Planet parameters ---
  // Planet radius: 0.5–2.5 Earth radii expressed in Solar radii
  const Rp_earth = 0.5 + Math.random() * 2.0;           // Earth radii
  const Rp_solar = Rp_earth * 0.00916;                   // 1 R⊕ = 0.00916 R☉
  const Rs       = star.radius;                           // Solar radii

  // Flux drop: ΔF = (Rp/Rs)²
  const deltaF = Math.pow(Rp_solar / Rs, 2);

  // Orbital period: 2–30 days (short enough to see 1–3 transits in 30-day window)
  const period = 2 + Math.random() * 28;                 // days

  // Transit duration: ~hours, simplified as 3% of period
  const duration = period * 0.03;                        // days

  // Random phase offset for first transit
  const phase0 = Math.random() * period;

  // --- Build the time series ---
  const time = [], flux = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t    = (i / SAMPLES) * DURATION_DAYS;
    // Time relative to nearest transit centre
    const tmod = ((t - phase0) % period + period) % period;
    // Trapezoidal ingress/egress: 20% of duration each
    const ingress = duration * 0.2;
    let f = 1.0;
    if (tmod < duration) {
      if (tmod < ingress) {
        f = 1.0 - deltaF * (tmod / ingress);           // ingress ramp
      } else if (tmod > duration - ingress) {
        f = 1.0 - deltaF * ((duration - tmod) / ingress); // egress ramp
      } else {
        f = 1.0 - deltaF;                              // flat bottom
      }
    }
    // Add realistic photon noise
    f += gaussianNoise(0, 0.0004);
    time.push(parseFloat(t.toFixed(4)));
    flux.push(parseFloat(f.toFixed(6)));
  }

  // Parameters passed to Module 2 analysis
  const transitParams = {
    period_days:  parseFloat(period.toFixed(3)),
    duration_days: parseFloat(duration.toFixed(4)),
    depth:         parseFloat(deltaF.toFixed(6)),   // fractional flux drop
    Rp_earth:      parseFloat(Rp_earth.toFixed(2)),
    Rp_solar:      parseFloat(Rp_solar.toFixed(5)),
    Rs:            Rs,
  };

  return { time, flux, type: "transit", transitParams };
}

/**
 * Public factory: generates a light curve appropriate for the star's signalType.
 * @param {object} star
 * @returns {LightCurve}
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
