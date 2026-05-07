/**
 * Module 2 – Planet Analysis Logic
 *
 * Astrophysics formulas used (all simplified for gameplay):
 *
 * 1. Orbital period P  →  already measured from transit light curve (days)
 *
 * 2. Semi-major axis (Kepler's 3rd law):
 *      a³ = (G·M_star / 4π²) · P²
 *    Simplified in solar/AU units: a (AU) = (M_star · P_years²)^(1/3)
 *
 * 3. Planet radius Rp  →  from transit depth: Rp = Rs · sqrt(ΔF)
 *
 * 4. Equilibrium temperature:
 *      T_eq = T_star · sqrt(Rs / (2a)) · (1 - albedo)^(1/4)
 *    Albedo assumed 0.3 (Earth-like)
 *
 * 5. Goldilocks zone:
 *    Inner edge: d_inner = sqrt(L / 1.1)  AU
 *    Outer edge: d_outer = sqrt(L / 0.53) AU
 *    (Kopparapu et al. 2013 simplified)
 *
 * 6. Planet mass (empirical, rocky/gaseous split):
 *    Rp < 1.5 R⊕  →  M ≈ Rp^3.7   (rocky, Fortney 2007)
 *    Rp ≥ 1.5 R⊕  →  M ≈ 2.69 · Rp^0.93  (gaseous, Chen & Kipping 2017)
 */

"use strict";

const ALBEDO          = 0.3;   // assumed Bond albedo
const AU_PER_LY       = 63241; // 1 ly = 63241 AU (for reference, not used in calcs)
const T_SUN_K         = 5778;  // Sun's effective temperature in Kelvin
const SOLAR_MASS_EARTH= 333000;// Msun in Earth masses

/**
 * Estimates stellar mass from luminosity via mass-luminosity relation:
 *   L ∝ M^4  →  M = L^(1/4)   (approximate for main sequence)
 * @param {number} luminosity  Solar luminosities
 * @returns {number} Solar masses
 */
function stellarMassFromLuminosity(luminosity) {
  return parseFloat(Math.pow(luminosity, 0.25).toFixed(3));
}

/**
 * Calculates orbital semi-major axis from period using Kepler's 3rd law.
 * @param {number} period_days
 * @param {number} stellarMass   Solar masses
 * @returns {number} AU
 */
function calcSemiMajorAxis(period_days, stellarMass) {
  const P_years = period_days / 365.25;
  return parseFloat(Math.pow(stellarMass * P_years * P_years, 1 / 3).toFixed(4));
}

/**
 * Calculates equilibrium temperature of the planet.
 * @param {number} T_star  Stellar effective temperature (K)
 * @param {number} Rs      Stellar radius (solar radii)
 * @param {number} a_AU    Semi-major axis (AU);  1 AU = 215.032 R☉
 * @returns {number} Kelvin
 */
function calcEqTemperature(T_star, Rs, a_AU) {
  const a_solar = a_AU * 215.032; // convert AU → solar radii
  const T_eq = T_star * Math.sqrt(Rs / (2 * a_solar)) * Math.pow(1 - ALBEDO, 0.25);
  return Math.round(T_eq);
}

/**
 * Calculates the classical habitable (Goldilocks) zone boundaries.
 * @param {number} luminosity  Solar luminosities
 * @returns {{ inner: number, outer: number }}  AU
 */
function calcHabitableZone(luminosity) {
  return {
    inner: parseFloat(Math.sqrt(luminosity / 1.1).toFixed(3)),
    outer: parseFloat(Math.sqrt(luminosity / 0.53).toFixed(3)),
  };
}

/**
 * Estimates planet mass from radius using empirical relations.
 * @param {number} Rp_earth  Planet radius in Earth radii
 * @returns {number} Earth masses
 */
function calcPlanetMass(Rp_earth) {
  let mass;
  if (Rp_earth < 1.5) {
    mass = Math.pow(Rp_earth, 3.7);  // rocky
  } else {
    mass = 2.69 * Math.pow(Rp_earth, 0.93); // gaseous
  }
  return parseFloat(mass.toFixed(2));
}

/**
 * Classifies a planet by radius.
 * @param {number} Rp_earth
 * @returns {string}
 */
function classifyPlanet(Rp_earth) {
  if (Rp_earth < 0.5)  return "Suberde";
  if (Rp_earth < 1.25) return "Erde-ähnlich";
  if (Rp_earth < 2.0)  return "Super-Erde";
  if (Rp_earth < 4.0)  return "Mini-Neptun";
  if (Rp_earth < 10.0) return "Neptun-ähnlich";
  return "Gasriese";
}

/**
 * Determines whether the planet lies within the habitable zone.
 * @param {number} a_AU
 * @param {{ inner, outer }} hz
 * @returns {"inner" | "habitable" | "outer"}
 */
function habitableZoneStatus(a_AU, hz) {
  if (a_AU < hz.inner) return "inner";
  if (a_AU > hz.outer) return "outer";
  return "habitable";
}

/**
 * Player decision: interpret the light curve.
 * The player must choose between three interpretations.
 * Success only if they correctly identify "transit".
 *
 * @param {string} playerChoice  "flat" | "noise" | "transit"
 * @param {string} actualType
 * @returns {{ correct: boolean, penalty: number, bonus: number }}
 */
function evaluateInterpretation(playerChoice, actualType) {
  if (playerChoice === actualType) {
    const bonus = actualType === "transit" ? 300 : 100;
    return { correct: true, penalty: 0, bonus, feedback: "Korrekte Diagnose!" };
  }
  // Wrong interpretation
  const penalty = playerChoice === "transit" ? 150 : 50; // False positive more costly
  return {
    correct: false,
    penalty,
    bonus: 0,
    feedback: playerChoice === "transit"
      ? "Falsch-Positiv: Kein Transit vorhanden. Datenverlust!"
      : "Signal falsch bewertet. Analyse wiederholen.",
  };
}

/**
 * Full analysis pipeline: takes raw transitParams and star → returns complete planet record.
 * @param {object} transitParams  From lightCurve.js buildTransitCurve
 * @param {object} star           Star catalog entry
 * @returns {PlanetAnalysis}
 */
function analysePlanet(transitParams, star) {
  const stellarMass  = stellarMassFromLuminosity(star.luminosity);
  const a_AU         = calcSemiMajorAxis(transitParams.period_days, stellarMass);
  const T_eq         = calcEqTemperature(star.temperature, star.radius, a_AU);
  const hz           = calcHabitableZone(star.luminosity);
  const Rp_earth     = transitParams.Rp_earth;
  const planetMass   = calcPlanetMass(Rp_earth);
  const hzStatus     = habitableZoneStatus(a_AU, hz);
  const classification = classifyPlanet(Rp_earth);

  // Habitability score 0–100 (simplified index)
  let habitability = 0;
  if (hzStatus === "habitable") habitability += 50;
  if (T_eq >= 200 && T_eq <= 320) habitability += 20;
  if (Rp_earth >= 0.8 && Rp_earth <= 2.0) habitability += 20;
  if (star.stellarClass === "G" || star.stellarClass === "K") habitability += 10;

  return {
    starId:          star.id,
    starName:        star.name,
    period_days:     transitParams.period_days,
    semiMajorAxis_AU: a_AU,
    radius_earth:    Rp_earth,
    mass_earth:      planetMass,
    eqTemperature_K: T_eq,
    habitableZone:   hz,
    hzStatus,
    classification,
    habitabilityScore: habitability,
    // Raw transit parameters preserved for display
    transitDepth:    transitParams.depth,
    stellarMass_solar: stellarMass,
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    analysePlanet, calcHabitableZone, calcEqTemperature,
    calcSemiMajorAxis, classifyPlanet, evaluateInterpretation,
  };
}
