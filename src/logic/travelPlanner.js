/**
 * Module 3 – Interstellar Travel Planner Logic
 *
 * Physics basis:
 *   - No relativistic time dilation shown (gameplay simplification)
 *   - Travel time: t = d / v  (light-years / fraction-of-c) = years
 *   - Crew life support: grows linearly with crew × years
 *   - Fuel mass fraction: Tsiolkovsky-inspired exponential (simplified)
 *
 * Ship classes affect max speed (larger = slower, more drag):
 *   Scout   (≤50 crew)  : v_max = 0.15c
 *   Cruiser (≤200 crew) : v_max = 0.10c
 *   Colony  (≤1000 crew): v_max = 0.05c
 *
 * Resource model (all in abstract "units"):
 *   Fuel            = shipMass × v_fraction² × 120        (kinetic energy proxy)
 *   Food            = crew × travelYears × 1.2
 *   Medical         = crew × 0.3 + travelYears × 0.5
 *   Spare Parts     = shipMass × 0.05 × travelYears
 *
 * Risk calculation:
 *   Base risk  = 5% per decade of travel
 *   Crew bonus = -0.5% per 10 crew members (up to -10%)
 *   Speed risk = +2% per 0.01c above 0.08c
 */

"use strict";

const C = 1; // speed of light = 1 (distances in ly, time in years, speed as fraction)

const SHIP_CLASSES = {
  scout: {
    label:      "Scout",
    maxCrew:    50,
    baseMass:   100,   // arbitrary mass units
    maxSpeed:   0.15,  // fraction of c
    description: "Schnelles Aufklärungsschiff, geringes Gewicht",
  },
  cruiser: {
    label:      "Kreuzer",
    maxCrew:    200,
    baseMass:   500,
    maxSpeed:   0.10,
    description: "Ausgewogene Expedition, mittlere Reichweite",
  },
  colony: {
    label:      "Kolonieschiff",
    maxCrew:    1000,
    baseMass:   2000,
    maxSpeed:   0.05,
    description: "Massives Schiff für Kolonisationsmissionen",
  },
};

/**
 * Validates crew size against ship class.
 * @returns {string|null}  Error message or null if valid.
 */
function validateConfig(shipClass, crew) {
  const def = SHIP_CLASSES[shipClass];
  if (!def) return "Unbekannte Schiffsklasse.";
  if (crew < 1)          return "Mindestbesatzung: 1 Person.";
  if (crew > def.maxCrew) return `Maximale Besatzung für ${def.label}: ${def.maxCrew}.`;
  return null;
}

/**
 * Effective speed: base speed reduced by crew overhead.
 * Larger crew → higher mass → lower speed (linear penalty).
 * @param {string} shipClass
 * @param {number} crew
 * @param {number} speedFraction  Player-chosen speed (0.01–maxSpeed)
 * @returns {number} Effective speed as fraction of c
 */
function effectiveSpeed(shipClass, crew, speedFraction) {
  const def = SHIP_CLASSES[shipClass];
  const crewRatio     = crew / def.maxCrew;        // 0–1
  const massPenalty   = 0.15 * crewRatio;          // up to 15% speed reduction
  const effective     = speedFraction * (1 - massPenalty);
  return parseFloat(Math.min(effective, def.maxSpeed).toFixed(5));
}

/**
 * Calculates all mission parameters for a given configuration.
 *
 * @param {object} cfg
 *   @param {string} cfg.shipClass  "scout" | "cruiser" | "colony"
 *   @param {number} cfg.crew       Number of crew
 *   @param {number} cfg.speedFrac  Desired speed (fraction of c, e.g. 0.12)
 *   @param {number} cfg.distance   Distance to target in light-years
 * @returns {TravelResult}
 */
function calculateMission(cfg) {
  const { shipClass, crew, speedFrac, distance } = cfg;
  const def = SHIP_CLASSES[shipClass];

  const v_eff       = effectiveSpeed(shipClass, crew, speedFrac);
  const travelYears = parseFloat((distance / v_eff).toFixed(1));  // years
  const shipMass    = def.baseMass + crew * 2;                    // mass units

  // Resources
  const fuel        = Math.round(shipMass * Math.pow(v_eff, 2) * 120);
  const food        = Math.round(crew * travelYears * 1.2);
  const medical     = Math.round(crew * 0.3 + travelYears * 0.5);
  const spareParts  = Math.round(shipMass * 0.05 * travelYears);
  const totalMass   = shipMass + fuel + food + medical + spareParts;

  // Mission risk (percentage, 0–100)
  const decades     = travelYears / 10;
  let   risk        = 5 * decades;
  risk             -= 0.5 * Math.floor(crew / 10);   // crew competence bonus
  risk             += v_eff > 0.08 ? (v_eff - 0.08) / 0.01 * 2 : 0;
  risk              = Math.max(1, Math.min(95, parseFloat(risk.toFixed(1))));

  // Crew generations needed (assume 25-year generation)
  const generations = travelYears > 25
    ? Math.ceil(travelYears / 25)
    : 1;

  // Mission failure roll (used at launch for dramatic reveal)
  const failureRoll = Math.random();
  const missionFails = failureRoll * 100 < risk * 0.4; // ~40% of risk chance is lethal

  // Potential failure causes (for storytelling)
  const failureCauses = [
    "Reaktorausfall nach 50% der Strecke",
    "Lebensmittelknappheit – Crew-Konflikt",
    "Strahlenexposition durch Sonnensturm",
    "Navigationsfehler – falsche Route",
    "Medizinischer Notfall außer Kontrolle",
  ];
  const failureCause = failureCauses[Math.floor(Math.random() * failureCauses.length)];

  return {
    input: {
      shipClass,
      shipLabel:   def.label,
      crew,
      speedFrac:   v_eff,
      distance_ly: distance,
    },
    travelYears,
    generations,
    resources: { fuel, food, medical, spareParts, totalMass },
    riskPercent: risk,
    missionFails,
    failureCause: missionFails ? failureCause : null,
    arrivalYear: new Date().getFullYear() + Math.round(travelYears),
  };
}

/**
 * Returns example simulations for 3 pre-set scenarios.
 * Used for tutorial / balancing display.
 */
function getExampleMissions(distance_ly) {
  return [
    calculateMission({ shipClass: "scout",   crew: 12,  speedFrac: 0.14, distance: distance_ly }),
    calculateMission({ shipClass: "cruiser", crew: 80,  speedFrac: 0.09, distance: distance_ly }),
    calculateMission({ shipClass: "colony",  crew: 500, speedFrac: 0.05, distance: distance_ly }),
  ];
}

if (typeof module !== "undefined") {
  module.exports = { calculateMission, getExampleMissions, SHIP_CLASSES, validateConfig };
}
