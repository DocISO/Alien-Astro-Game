/**
 * Star Catalog Data Layer
 * Generates and stores the star catalog used across all game modules.
 * Scientific basis: stellar classification (O B A F G K M), luminosity, temperature.
 */

"use strict";

// Stellar class definitions with realistic physical parameters
const STELLAR_CLASSES = {
  O: { tempRange: [30000, 50000], luminosityRange: [30000, 1000000], colorHex: "#9bb0ff", weight: 0.003 },
  B: { tempRange: [10000, 30000], luminosityRange: [25,    30000],   colorHex: "#aabfff", weight: 0.013 },
  A: { tempRange: [7500,  10000], luminosityRange: [5,     25],      colorHex: "#cad7ff", weight: 0.006 },
  F: { tempRange: [6000,  7500],  luminosityRange: [1.5,   5],       colorHex: "#f8f7ff", weight: 0.030 },
  G: { tempRange: [5200,  6000],  luminosityRange: [0.6,   1.5],     colorHex: "#fff4ea", weight: 0.076 },
  K: { tempRange: [3700,  5200],  luminosityRange: [0.08,  0.6],     colorHex: "#ffd2a1", weight: 0.121 },
  M: { tempRange: [2400,  3700],  luminosityRange: [0.0001,0.08],    colorHex: "#ffcc6f", weight: 0.745 },
};

// Probability that a star hosts a detectable exoplanet transit
const EXOPLANET_PROBABILITY = 0.25;

// Noise-only star probability (believable signal but no planet)
const NOISE_ONLY_PROBABILITY = 0.35;

/**
 * Picks a stellar class using weighted random selection.
 * @returns {string} Class letter e.g. "G"
 */
function pickStellarClass() {
  const rand = Math.random();
  let cumulative = 0;
  for (const [cls, data] of Object.entries(STELLAR_CLASSES)) {
    cumulative += data.weight;
    if (rand <= cumulative) return cls;
  }
  return "M"; // fallback
}

/**
 * Returns a random number uniformly distributed between lo and hi.
 */
function randBetween(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

/**
 * Generates a single star object with all physical properties.
 * @param {number} id  Unique integer index
 * @returns {StarObject}
 */
function generateStar(id) {
  const cls    = pickStellarClass();
  const def    = STELLAR_CLASSES[cls];
  const temp   = Math.round(randBetween(...def.tempRange));
  const lum    = parseFloat(randBetween(...def.luminosityRange).toFixed(4));
  // Stellar radius in solar radii: L = R^2 * (T/T_sun)^4  → R = sqrt(L) / (T/5778)^2
  const radius = parseFloat((Math.sqrt(lum) / Math.pow(temp / 5778, 2)).toFixed(3));
  // Distance 5–100 ly, biased towards closer stars
  const distance = parseFloat((5 + Math.pow(Math.random(), 0.6) * 95).toFixed(2));

  // Determine what signal this star will produce when investigated
  const roll = Math.random();
  let signalType;
  if (roll < EXOPLANET_PROBABILITY)                            signalType = "transit";
  else if (roll < EXOPLANET_PROBABILITY + NOISE_ONLY_PROBABILITY) signalType = "noise";
  else                                                          signalType = "flat";

  return {
    id,
    name: generateStarName(id),
    stellarClass: cls,
    temperature: temp,       // Kelvin
    luminosity: lum,         // Solar luminosities
    radius: radius,          // Solar radii
    distance: distance,      // Light-years
    color: def.colorHex,
    signalType,              // "flat" | "noise" | "transit"
    investigated: false,
    exoplanetData: null,     // Populated after investigation if transit
    // Screen coordinates set by UI layer
    x: 0,
    y: 0,
    brightness: Math.min(1.0, lum > 1 ? 0.4 + 0.6 * Math.log10(lum + 1) / 3 : 0.2 + lum * 0.5),
  };
}

/**
 * Deterministic name generator for stars.
 * Produces names like "KIC-00042" or "HD-01337".
 */
function generateStarName(id) {
  const prefixes = ["KIC", "HD", "TYC", "HIP", "GJ", "TOI", "WASP", "K2"];
  const prefix   = prefixes[id % prefixes.length];
  const number   = String(id).padStart(5, "0");
  return `${prefix}-${number}`;
}

/**
 * Generates the full star catalog of `count` stars with randomised screen positions.
 * @param {number} count       Number of stars (default 1000)
 * @param {number} canvasW     Canvas width  (px)
 * @param {number} canvasH     Canvas height (px)
 * @returns {StarObject[]}
 */
function generateStarCatalog(count = 1000, canvasW = 1400, canvasH = 900) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    const star = generateStar(i);
    // Leave a small margin so stars are not clipped
    star.x = Math.round(20 + Math.random() * (canvasW  - 40));
    star.y = Math.round(20 + Math.random() * (canvasH  - 40));
    stars.push(star);
  }
  return stars;
}

// Export for use in other modules
if (typeof module !== "undefined") {
  module.exports = { generateStarCatalog, STELLAR_CLASSES, EXOPLANET_PROBABILITY };
}
