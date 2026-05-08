/**
 * Module 3 – Interstellar Travel Planner Logic
 *
 * Core balance mechanic:
 *   Speed is DERIVED from crew size — no separate speed input.
 *   v = baseSpeed − (baseSpeed − minSpeed) × crewRatio
 *
 * Distance rules:
 *   ≤ 30 ly  → Scout, Cruiser, Colony all available
 *   31–65 ly → Cruiser and Colony only
 *   > 65 ly  → Colony Ship REQUIRED
 */

"use strict";

const SCOUT_MAX_DIST  = 30;
const COLONY_MIN_DIST = 65;

const SHIP_CLASSES = {
  scout: {
    label: "Scout", emoji: "🛸",
    minCrew: 2, maxCrew: 25, baseMass: 80,
    baseSpeed: 0.20, minSpeed: 0.08, maxDist: SCOUT_MAX_DIST,
    description: "Schnell & leicht. Nur für Kurzdistanzen bis 30 Lj.",
  },
  cruiser: {
    label: "Kreuzer", emoji: "🚀",
    minCrew: 10, maxCrew: 150, baseMass: 400,
    baseSpeed: 0.13, minSpeed: 0.05, maxDist: COLONY_MIN_DIST,
    description: "Ausgewogen. Für Entfernungen bis 65 Lj.",
  },
  colony: {
    label: "Kolonieschiff", emoji: "🌍",
    minCrew: 200, maxCrew: 2000, baseMass: 2000,
    baseSpeed: 0.07, minSpeed: 0.03, maxDist: Infinity,
    description: "Massiv & nachhaltig. Pflicht ab 65 Lj.",
  },
};

function crewToSpeed(def, crew) {
  const clamped = Math.max(0, Math.min(1, (crew - def.minCrew) / (def.maxCrew - def.minCrew)));
  return parseFloat((def.baseSpeed - (def.baseSpeed - def.minSpeed) * clamped).toFixed(5));
}

function availableClasses(distance) {
  return Object.keys(SHIP_CLASSES).filter(key => {
    const def = SHIP_CLASSES[key];
    if (distance > COLONY_MIN_DIST && key !== "colony") return false;
    if (distance > def.maxDist) return false;
    return true;
  });
}

function getRecommendation(distance) {
  if (distance > COLONY_MIN_DIST) {
    const def  = SHIP_CLASSES.colony;
    const crew = Math.round(def.minCrew + (def.maxCrew - def.minCrew) * 0.2);
    return { shipClass: "colony", crew, reason: "Kolonieschiff Pflicht ab 65 Lj" };
  }
  if (distance > SCOUT_MAX_DIST) {
    const def     = SHIP_CLASSES.cruiser;
    const targetV = distance / 200;
    const ratio   = Math.max(0, Math.min(1, (def.baseSpeed - targetV) / (def.baseSpeed - def.minSpeed)));
    return { shipClass: "cruiser", crew: Math.round(def.minCrew + ratio * (def.maxCrew - def.minCrew)), reason: "Scout hat zu geringe Reichweite" };
  }
  const def     = SHIP_CLASSES.scout;
  const targetV = distance / 80;
  const ratio   = Math.max(0, Math.min(1, (def.baseSpeed - targetV) / (def.baseSpeed - def.minSpeed)));
  return { shipClass: "scout", crew: Math.round(def.minCrew + ratio * (def.maxCrew - def.minCrew)), reason: "Kurzdistanz — Scout optimal" };
}

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

function calculateMission(cfg) {
  const { shipClass, crew, distance } = cfg;
  const def      = SHIP_CLASSES[shipClass];
  const v_eff    = crewToSpeed(def, crew);
  const shipMass = def.baseMass + crew * 2;
  const travelYears = parseFloat((distance / v_eff).toFixed(1));
  const generations = Math.max(1, Math.ceil(travelYears / 25));

  const fuel       = Math.round(shipMass * Math.pow(v_eff, 2) * 140);
  const food       = Math.round(crew * travelYears * 1.2);
  const medical    = Math.round(crew * 0.4 + travelYears * 0.6);
  const spareParts = Math.round(shipMass * 0.06 * travelYears);
  const totalMass  = shipMass + fuel + food + medical + spareParts;

  return {
    input: { shipClass, shipLabel: def.label, shipEmoji: def.emoji, crew, speedFrac: v_eff, distance_ly: distance },
    travelYears,
    generations,
    resources: { fuel, food, medical, spareParts, totalMass },
    arrivalYear: new Date().getFullYear() + Math.round(travelYears),
    colonyRequired: distance > COLONY_MIN_DIST,
  };
}

// ── Mission Log Generator ──────────────────────────────────────────────────────

/**
 * Generates a child-friendly mission journal.
 * Entries are spaced proportionally across the travel time.
 * Always ends with a successful arrival — no failure mechanic.
 *
 * @param {string} shipClass
 * @param {number} crew
 * @param {number} distance     Light-years
 * @param {number} travelYears
 * @param {number} generations
 * @param {string} starName
 * @returns {{ year: number, icon: string, text: string, type: string }[]}
 */
function generateMissionLog(shipClass, crew, distance, travelYears, generations, starName) {
  const entries = [];
  const Y = travelYears;

  // ── Helper ─────────────────────────────────────────────────────────────────
  function add(yearFraction, icon, text, type = "info") {
    entries.push({ year: Math.round(yearFraction * Y), icon, text, type });
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ── 1. START ───────────────────────────────────────────────────────────────
  if (shipClass === "scout") {
    add(0, "🛸", `Alle ${crew} Astronauten sind eingestiegen. Die Triebwerke zünden — es geht los!`, "milestone");
    add(0.02, "⚙️", "Alle Systeme wurden überprüft. Lebenserhaltung, Navigation und Reaktor: alles grün!", "info");
  } else if (shipClass === "cruiser") {
    add(0, "🚀", `${crew} Crew-Mitglieder winken der Erde zum Abschied. Dann zünden die Haupttriebwerke.`, "milestone");
    add(0.02, "📋", "Schichtplan für die nächsten Wochen steht. Jeder hat seine Aufgabe an Bord.", "info");
  } else {
    add(0, "🌍", `${crew} Menschen — Familien, Wissenschaftler, Ingenieure — starten ins Unbekannte.`, "milestone");
    add(0.02, "🏫", "Die Schule an Bord öffnet. Die Kinder lernen heute: Was ist ein Lichtjahr?", "info");
    add(0.03, "🌱", "Die Gewächshäuser werden angelegt. Tomaten, Salat und Kartoffeln wachsen unter LED-Licht.", "info");
  }

  // ── 2. FRÜH (was man beachten muss) ───────────────────────────────────────
  const earlyChecks = {
    scout: [
      ["💧", "Wasser wird zu 100% recycelt. Jeder Tropfen zählt im Weltall!", "info"],
      ["🌡️", "Die Temperatur im Schiff wird genau geregelt — draußen ist es fast −270 °C!", "info"],
      ["🍎", "Lebensmittelvorräte gecheckt: genug für die ganze Reise plus Reserve.", "info"],
    ],
    cruiser: [
      ["💧", "Das Wasserrecycling versorgt alle ${crew} Menschen täglich mit frischem Trinkwasser.", "info"],
      ["🔋", "Der Reaktor läuft stabil. Er wird die nächsten Jahrzehnte Energie liefern.", "info"],
      ["📡", "Erste Nachricht von der Erde! Laufzeit: schon mehrere Stunden.", "info"],
    ],
    colony: [
      ["🏥", "Das Krankenhaus an Bord ist für alle Fälle gerüstet — Geburten, Operationen, alles.", "info"],
      ["⚡", "Drei Reaktoren laufen parallel. Fällt einer aus, übernehmen die anderen.", "info"],
      ["🌊", "Das Wasserrecycling funktioniert wie ein kleiner Kreislauf — wie ein See im Schiff.", "info"],
    ],
  };
  const checks = earlyChecks[shipClass];
  checks.forEach(([icon, text, type], i) => {
    add(0.08 + i * 0.06, icon, text.replace("${crew}", crew), type);
  });

  // ── 3. PROBLEM + LÖSUNG (immer gelöst!) ───────────────────────────────────
  const problems = {
    scout: [
      { y: 0.25, prob: "⚠️", probText: "Ein Sensor meldet erhöhte Strahlung durch einen kleinen Sonnensturm.", sol: "🛡️", solText: "Die Schutzschilde werden aktiviert. Nach 3 Stunden ist alles wieder normal. Gut gebaut, dieses Schiff!" },
      { y: 0.40, prob: "🔧", probText: "Eine Pumpe im Kühlsystem gibt merkwürdige Geräusche von sich.", sol: "✅", solText: "Ingenieur Maja findet das Problem in 20 Minuten und wechselt ein Ventil aus. Problem gelöst!" },
      { y: 0.60, prob: "🍕", probText: "Der Essensvorrat für Woche 40 schmeckt komisch — die Verpackung war undicht.", sol: "😄", solText: "Kein Problem! Wir haben genug Reserve. Heute gibt es Pasta aus den Notvorräten — lecker!" },
    ],
    cruiser: [
      { y: 0.20, prob: "⚠️", probText: "Ein kleiner Asteroid kreuzt unseren Kurs. Er ist nur 10 Meter groß — aber im Weltall gefährlich!", sol: "🚀", solText: "Pilot Chen lenkt das Schiff in einem eleganten Bogen daran vorbei. Alle klatschen!" },
      { y: 0.38, prob: "🔧", probText: "Im Maschinenraum ist ein Rohr gebrochen. Wasser tropft auf die Elektronik.", sol: "🛠️", solText: "Reparaturteam dichtet das Rohr in 4 Stunden ab. Elektronik getrocknet — alles läuft weiter!" },
      { y: 0.55, prob: "😴", probText: "Einige Crew-Mitglieder fühlen sich traurig und vermissen die Erde.", sol: "🎭", solText: "Wir organisieren ein Theaterstück an Bord! Danach fühlt sich alle besser. Das Weltall verbindet." },
      { y: 0.70, prob: "💡", probText: "Das Beleuchtungssystem in Sektion C fällt aus — dort ist es plötzlich dunkel.", sol: "🔦", solText: "Elektriker Leo repariert das Kabel. Taschenlampen und gute Laune halfen beim Warten!" },
    ],
    colony: [
      { y: 0.10, prob: "⚠️", probText: "Ein Meteor prallt auf die Außenhülle! Ein lauter Knall erschreckt alle.", sol: "🛡️", solText: "Die Doppelhülle hält stand — genau dafür wurde sie gebaut. Kein Leck, nur ein kleines Grübchen." },
      { y: 0.22, prob: "🌱", probText: "Eine Pilzkrankheit bedroht die Gewächshäuser. Pflanzen welken.", sol: "🌿", solText: "Die Biologinnen isolieren die kranken Pflanzen und retten 95% der Ernte. Salat für alle!" },
      { y: 0.35, prob: "💻", probText: "Das Navigationssystem zeigt für 2 Stunden falsche Koordinaten.", sol: "📐", solText: "Backup-Navigation übernimmt sofort. Die Mathematiker berechnen den Kurs per Hand — und haben Recht!" },
      { y: 0.50, prob: "😤", probText: "Streit zwischen zwei Wohngruppen über die Nutzung des Sportbereichs.", sol: "🤝", solText: "Der Gemeinschaftsrat tagt und beschließt einen neuen Zeitplan. Alle sind zufrieden." },
      { y: 0.65, prob: "🔋", probText: "Reaktor 2 muss für Wartung abgeschaltet werden. Kurzzeitig weniger Strom.", sol: "⚡", solText: "Alle sparen vorübergehend Energie. Nach 3 Tagen läuft Reaktor 2 wieder — besser als zuvor!" },
      { y: 0.80, prob: "🌡️", probText: "Die Klimaanlage in Deck 7 fällt aus. Dort wird es warm.", sol: "❄️", solText: "Tragbare Ventilatoren verteilt, Reparatur dauert 2 Tage. Danach sind alle wieder cool — im doppelten Sinne." },
    ],
  };

  (problems[shipClass] || problems.colony).forEach(p => {
    add(p.y,        p.prob, p.probText, "problem");
    add(p.y + 0.03, p.sol,  p.solText,  "solution");
  });

  // ── 4. GENERATIONEN-MEILENSTEINE (für lange Reisen) ──────────────────────
  if (generations >= 2) {
    add(0.30, "👶", `Die ersten Kinder werden an Bord geboren. Sie kennen die Erde nur aus Büchern.`, "milestone");
  }
  if (generations >= 4) {
    add(0.50, "📖", "Die Enkel der Gründer führen jetzt das Schiff. Sie haben eine eigene Sprache entwickelt: neue Wörter für Sterne!", "milestone");
  }
  if (generations >= 8) {
    add(0.65, "🏛️", pick([
      "Das Schiff hat inzwischen seine eigene Kultur: Musik, Feste, Traditionen — entstanden in den Sternen.",
      "Zum ersten Mal wird an Bord eine Wahl abgehalten. Die Crew wählt ihren Rat demokratisch.",
    ]), "milestone");
  }
  if (generations >= 12) {
    add(0.75, "🌌", "Niemand an Bord erinnert sich mehr an die Erde — aber alle träumen vom Zielplaneten.", "milestone");
  }

  // ── 5. ANNÄHERUNG ─────────────────────────────────────────────────────────
  add(0.88, "🔭", `Das Teleskop zeigt ihn: ${starName}! Der Stern leuchtet jetzt so hell wie der Mond früher von der Erde.`, "milestone");
  add(0.94, "🐢", "Die Triebwerke werden gedrosselt. Das Schiff bremst — das dauert Monate, aber wir kommen an!", "info");

  if (distance > 50) {
    add(0.97, "📡", `Erste Signale vom Zielsystem empfangen. Der Planet ist da! Alle Generationen haben gewartet — jetzt ist es so weit.`, "info");
  } else {
    add(0.97, "📡", `Funkkontakt mit ${starName}-System hergestellt. Der Planet ist deutlich zu sehen. Noch wenige Monate!`, "info");
  }

  // ── 6. ANKUNFT (immer erfolgreich!) ───────────────────────────────────────
  const arrivalTexts = {
    scout:   `🎉 ANGEKOMMEN! Alle ${crew} Astronauten sind gesund. ${starName} strahlt durch das Fenster. Mission erfolgreich!`,
    cruiser: `🎉 ANGEKOMMEN! Die Crew jubelt. ${starName} beleuchtet das Schiff in warmem Licht. Eine neue Ära beginnt!`,
    colony:  `🎉 ANGEKOMMEN! Hunderte Menschen stehen an den Fenstern. ${starName} — das Ziel vieler Generationen. Wir haben es geschafft!`,
  };
  add(1.0, "🌟", arrivalTexts[shipClass] || arrivalTexts.colony, "arrival");

  // Sortieren und doppelte Jahre entfernen
  entries.sort((a, b) => a.year - b.year);
  return entries;
}

function getExampleMissions(distance_ly) {
  return availableClasses(distance_ly).map(cls => {
    const def  = SHIP_CLASSES[cls];
    const crew = Math.round(def.minCrew + (def.maxCrew - def.minCrew) * 0.25);
    return calculateMission({ shipClass: cls, crew, distance: distance_ly });
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    calculateMission, generateMissionLog, getExampleMissions,
    getRecommendation, availableClasses, validateConfig,
    SHIP_CLASSES, SCOUT_MAX_DIST, COLONY_MIN_DIST, crewToSpeed,
  };
}
