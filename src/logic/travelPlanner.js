/**
 * Module 3 – Interstellar Travel Planner Logic
 *
 * Core balance mechanic:
 *   Speed is DERIVED from crew size — no separate speed input.
 *   Each ship class has a baseSpeed (minimum crew) and a minSpeed (maximum crew).
 *   The player balances crew (sustainability, risk reduction) vs. speed (travel time).
 *
 *   v = baseSpeed − (baseSpeed − minSpeed) × crewRatio
 *   crewRatio = (crew − minCrew) / (maxCrew − minCrew)
 *
 * Distance rules:
 *   ≤ 30 ly  → Scout, Cruiser, Colony all available
 *   31–65 ly → Cruiser and Colony only (Scout lacks range)
 *   > 65 ly  → Colony Ship REQUIRED (only class with multi-generation infrastructure)
 *
 * Resource model:
 *   Fuel        = shipMass × v² × 140          (kinetic energy proxy)
 *   Food        = crew × travelYears × 1.2
 *   Medical     = crew × 0.4 + travelYears × 0.6
 *   Spare Parts = shipMass × 0.06 × travelYears
 *
 * Risk model:
 *   base   = 4% per decade
 *   −0.4%  per 10 crew (crew competence)
 *   +3%    per 0.01c above 0.10c (speed stress)
 *   +15%   if colony ship required but not used (mission doomed)
 */

"use strict";

// Distance thresholds (light-years)
const SCOUT_MAX_DIST  = 30;
const COLONY_MIN_DIST = 65;

const SHIP_CLASSES = {
  scout: {
    label:       "Scout",
    emoji:       "🛸",
    minCrew:     2,
    maxCrew:     25,
    baseMass:    80,
    baseSpeed:   0.20,   // c at minimum crew
    minSpeed:    0.08,   // c at maximum crew
    maxDist:     SCOUT_MAX_DIST,
    multiGen:    false,
    description: "Schnell & leicht. Nur für Kurzdistanzen bis 30 Lj.",
  },
  cruiser: {
    label:       "Kreuzer",
    emoji:       "🚀",
    minCrew:     10,
    maxCrew:     150,
    baseMass:    400,
    baseSpeed:   0.13,
    minSpeed:    0.05,
    maxDist:     COLONY_MIN_DIST,
    multiGen:    false,
    description: "Ausgewogen. Für Entfernungen bis 65 Lj.",
  },
  colony: {
    label:       "Kolonieschiff",
    emoji:       "🌍",
    minCrew:     200,
    maxCrew:     2000,
    baseMass:    2000,
    baseSpeed:   0.07,
    minSpeed:    0.03,
    maxDist:     Infinity,
    multiGen:    true,
    description: "Massiv & nachhaltig. Pflicht ab 65 Lj.",
  },
};

/**
 * Computes effective speed from crew size.
 * Larger crew → more mass → lower speed (linear interpolation).
 * @param {object} def    Ship class definition
 * @param {number} crew
 * @returns {number}      Speed as fraction of c
 */
function crewToSpeed(def, crew) {
  const crewRatio = (crew - def.minCrew) / (def.maxCrew - def.minCrew);
  const clamped   = Math.max(0, Math.min(1, crewRatio));
  return parseFloat((def.baseSpeed - (def.baseSpeed - def.minSpeed) * clamped).toFixed(5));
}

/**
 * Returns which ship classes are available for a given distance.
 * @param {number} distance  Light-years
 * @returns {string[]}  Array of available class keys
 */
function availableClasses(distance) {
  return Object.keys(SHIP_CLASSES).filter(key => {
    const def = SHIP_CLASSES[key];
    if (distance > COLONY_MIN_DIST && key !== "colony") return false;
    if (distance > def.maxDist) return false;
    return true;
  });
}

/**
 * Returns a recommended ship class and crew for a given distance.
 * Targets a travel time of ~150–300 years as the "comfortable" range.
 * @param {number} distance
 * @returns {{ shipClass: string, crew: number, reason: string }}
 */
function getRecommendation(distance) {
  if (distance > COLONY_MIN_DIST) {
    // Colony required — recommend mid-sized crew for balanced speed
    const def  = SHIP_CLASSES.colony;
    const crew = Math.round(def.minCrew + (def.maxCrew - def.minCrew) * 0.2);
    return { shipClass: "colony", crew, reason: "Kolonieschiff Pflicht ab 65 Lj" };
  }
  if (distance > SCOUT_MAX_DIST) {
    // Cruiser zone — find crew that gives ~200-year trip
    const def      = SHIP_CLASSES.cruiser;
    const targetV  = distance / 200;
    const ratio    = Math.max(0, Math.min(1,
      (def.baseSpeed - targetV) / (def.baseSpeed - def.minSpeed)));
    const crew = Math.round(def.minCrew + ratio * (def.maxCrew - def.minCrew));
    return { shipClass: "cruiser", crew, reason: "Scout hat zu geringe Reichweite" };
  }
  // Scout zone — small crew, fast trip
  const def      = SHIP_CLASSES.scout;
  const targetV  = distance / 80;
  const ratio    = Math.max(0, Math.min(1,
    (def.baseSpeed - targetV) / (def.baseSpeed - def.minSpeed)));
  const crew = Math.round(def.minCrew + ratio * (def.maxCrew - def.minCrew));
  return { shipClass: "scout", crew, reason: "Kurzdistanz — Scout optimal" };
}

/**
 * Validates a configuration against ship class limits and distance rules.
 * @returns {string|null}  Error message, or null if valid.
 */
function validateConfig(shipClass, crew, distance = 0) {
  const def = SHIP_CLASSES[shipClass];
  if (!def) return "Unbekannte Schiffsklasse.";
  if (crew < def.minCrew) return `Mindestbesatzung für ${def.label}: ${def.minCrew}.`;
  if (crew > def.maxCrew) return `Maximalbesatzung für ${def.label}: ${def.maxCrew}.`;
  if (distance > COLONY_MIN_DIST && shipClass !== "colony")
    return `Entfernung ${distance} Lj erfordert ein Kolonieschiff (> ${COLONY_MIN_DIST} Lj).`;
  if (distance > def.maxDist)
    return `${def.label} hat eine Maximalreichweite von ${def.maxDist} Lj.`;
  return null;
}

/**
 * Calculates all mission parameters.
 * @param {{ shipClass, crew, distance }} cfg
 * @returns {TravelResult}
 */
function calculateMission(cfg) {
  const { shipClass, crew, distance } = cfg;
  const def      = SHIP_CLASSES[shipClass];
  const v_eff    = crewToSpeed(def, crew);
  const shipMass = def.baseMass + crew * 2;

  const travelYears = parseFloat((distance / v_eff).toFixed(1));

  // Resources
  const fuel       = Math.round(shipMass * Math.pow(v_eff, 2) * 140);
  const food       = Math.round(crew * travelYears * 1.2);
  const medical    = Math.round(crew * 0.4 + travelYears * 0.6);
  const spareParts = Math.round(shipMass * 0.06 * travelYears);
  const totalMass  = shipMass + fuel + food + medical + spareParts;

  // Generations
  const generations = Math.max(1, Math.ceil(travelYears / 25));

  // Risk
  const decades = travelYears / 10;
  let risk = 4 * decades;
  risk -= 0.4 * Math.floor(crew / 10);
  risk += v_eff > 0.10 ? (v_eff - 0.10) / 0.01 * 3 : 0;
  if (distance > COLONY_MIN_DIST && shipClass !== "colony") risk += 15;
  risk = Math.max(1, Math.min(95, parseFloat(risk.toFixed(1))));

  // Failure
  const missionFails = Math.random() * 100 < risk * 0.35;
  const failureCauses = [
    "Reaktorausfall nach 50% der Strecke",
    "Lebensmittelknappheit – Crew-Konflikt",
    "Strahlenexposition durch kosmische Strahlung",
    "Navigationsfehler – irreversibler Kurs",
    "Epidemie an Bord außer Kontrolle",
    "Strukturversagen des Rumpfes",
  ];
  const failureCause = failureCauses[Math.floor(Math.random() * failureCauses.length)];

  return {
    input: { shipClass, shipLabel: def.label, shipEmoji: def.emoji, crew, speedFrac: v_eff, distance_ly: distance },
    travelYears,
    generations,
    resources: { fuel, food, medical, spareParts, totalMass },
    riskPercent: risk,
    missionFails,
    failureCause: missionFails ? failureCause : null,
    arrivalYear: new Date().getFullYear() + Math.round(travelYears),
    colonyRequired: distance > COLONY_MIN_DIST,
  };
}

/**
 * Optimal example missions for three distances.
 */
function getExampleMissions(distance_ly) {
  const rec = getRecommendation(distance_ly);
  const avail = availableClasses(distance_ly);
  return avail.map(cls => {
    const def  = SHIP_CLASSES[cls];
    const crew = Math.round(def.minCrew + (def.maxCrew - def.minCrew) * 0.25);
    return calculateMission({ shipClass: cls, crew, distance: distance_ly });
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    calculateMission, getExampleMissions, getRecommendation,
    availableClasses, validateConfig, SHIP_CLASSES,
    SCOUT_MAX_DIST, COLONY_MIN_DIST,
  };
}
