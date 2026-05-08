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

// Exactly 35% of all stars will carry a transit signal
const EXOPLANET_PROBABILITY = 0.35;

// Noise-only star probability (believable signal but no planet)
const NOISE_ONLY_PROBABILITY = 0.30;

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
  return "M";
}

/**
 * Returns a random number uniformly distributed between lo and hi.
 */
function randBetween(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

/**
 * Generates a single star's physical properties (no position yet).
 * @param {number} id       Unique integer index
 * @param {string} signalType  Pre-assigned signal type for even distribution
 * @returns {StarObject}
 */
function generateStar(id, signalType) {
  const cls    = pickStellarClass();
  const def    = STELLAR_CLASSES[cls];
  const temp   = Math.round(randBetween(...def.tempRange));
  const lum    = parseFloat(randBetween(...def.luminosityRange).toFixed(4));
  // Stellar radius: L = R² · (T/T☉)⁴  →  R = √L / (T/5778)²
  const radius = parseFloat((Math.sqrt(lum) / Math.pow(temp / 5778, 2)).toFixed(3));
  // Distance 5–100 ly, biased towards closer stars
  const distance = parseFloat((5 + Math.pow(Math.random(), 0.6) * 95).toFixed(2));

  return {
    id,
    name: generateStarName(id),
    stellarClass: cls,
    temperature: temp,
    luminosity: lum,
    radius: radius,
    distance: distance,
    color: def.colorHex,
    signalType,
    investigated: false,
    exoplanetData: null,
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
 * Fisher-Yates shuffle — randomises an array in place.
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generates the full star catalog.
 *
 * Signal-type distribution strategy:
 *   - The exact number of transit/noise/flat stars is computed upfront.
 *   - Signal types are assigned to a shuffled index list so the ratio is
 *     guaranteed (no probability drift) and the assignment is random.
 *   - Positions use Poisson-disk-inspired grid jitter: the canvas is divided
 *     into a regular grid; each cell gets one star placed at a random offset
 *     within that cell. This guarantees even spatial coverage while still
 *     looking organic. Transit stars are distributed across all grid regions
 *     by placing one in each of the first N cells after another shuffle.
 *
 * @param {number} count       Number of stars (default 1000)
 * @param {number} canvasW     Canvas width  (px)
 * @param {number} canvasH     Canvas height (px)
 * @returns {StarObject[]}
 */
function generateStarCatalog(count = 1000, canvasW = 1100, canvasH = 640) {
  const margin = 24;
  const W = canvasW  - margin * 2;
  const H = canvasH  - margin * 2;

  // ── 1. Decide exact signal counts ─────────────────────────────────────────
  const nTransit = Math.round(count * EXOPLANET_PROBABILITY);   // 350
  const nNoise   = Math.round(count * NOISE_ONLY_PROBABILITY);  // 300
  const nFlat    = count - nTransit - nNoise;                   // 350

  // Build a shuffled signal-type list
  const signalPool = [
    ...Array(nTransit).fill("transit"),
    ...Array(nNoise).fill("noise"),
    ...Array(nFlat).fill("flat"),
  ];
  shuffle(signalPool);

  // ── 2. Build a jittered grid for even spatial coverage ────────────────────
  // Find grid dimensions whose cell count >= count
  const aspect  = W / H;
  const cols    = Math.ceil(Math.sqrt(count * aspect));
  const rows    = Math.ceil(count / cols);
  const cellW   = W / cols;
  const cellH   = H / rows;

  // Create one slot per cell (cols × rows ≥ count) and shuffle slot order
  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({ col: c, row: r });
    }
  }
  shuffle(slots);

  // ── 3. Assign transit stars evenly across grid regions ────────────────────
  // Re-sort the signalPool so transit stars occupy every (count/nTransit)-th slot
  // Strategy: split slots into nTransit equal regions, put one transit per region.
  const step        = Math.floor(count / nTransit);
  const orderedPool = Array(count).fill("flat");
  let   noiseLeft   = nNoise;

  // Place one transit per region
  for (let t = 0; t < nTransit; t++) {
    const regionStart = t * step;
    const regionEnd   = Math.min(regionStart + step, count) - 1;
    const pos         = regionStart + Math.floor(Math.random() * (regionEnd - regionStart + 1));
    orderedPool[pos]  = "transit";
  }

  // Fill remaining slots with noise then flat
  for (let i = 0; i < count; i++) {
    if (orderedPool[i] === "flat" && noiseLeft > 0) {
      orderedPool[i] = "noise";
      noiseLeft--;
    }
  }

  // ── 4. Build star objects ─────────────────────────────────────────────────
  const stars = [];
  for (let i = 0; i < count; i++) {
    const slot   = slots[i];
    const signal = orderedPool[i];
    const star   = generateStar(i, signal);

    // Jitter within cell (10% margin so stars don't sit exactly on grid lines)
    const jitterX = cellW  * 0.1 + Math.random() * cellW  * 0.8;
    const jitterY = cellH  * 0.1 + Math.random() * cellH  * 0.8;
    star.x = Math.round(margin + slot.col * cellW  + jitterX);
    star.y = Math.round(margin + slot.row * cellH  + jitterY);

    stars.push(star);
  }

  return stars;
}

// Export for use in other modules
if (typeof module !== "undefined") {
  module.exports = { generateStarCatalog, STELLAR_CLASSES, EXOPLANET_PROBABILITY };
}
