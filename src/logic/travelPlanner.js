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
    baseSpeed: 0.30, minSpeed: 0.18, maxDist: SCOUT_MAX_DIST,
    description: "Schnell & leicht. Nur für Kurzdistanzen bis 30 Lj.",
    buildYearsBase: 15,  buildYearsMax: 30,
    buildWorkersBase: 80_000,   buildWorkersMax: 200_000,
    buildCostBase_B: 800,       buildCostMax_B: 2_500,    // Mrd. €
  },
  cruiser: {
    label: "Kreuzer", emoji: "🚀",
    minCrew: 10, maxCrew: 150, baseMass: 400,
    baseSpeed: 0.23, minSpeed: 0.15, maxDist: COLONY_MIN_DIST,
    description: "Ausgewogen. Für Entfernungen bis 65 Lj.",
    buildYearsBase: 30,  buildYearsMax: 65,
    buildWorkersBase: 300_000,  buildWorkersMax: 900_000,
    buildCostBase_B: 5_000,     buildCostMax_B: 22_000,
  },
  colony: {
    label: "Kolonieschiff", emoji: "🌍",
    minCrew: 200, maxCrew: 2000, baseMass: 2000,
    baseSpeed: 0.17, minSpeed: 0.13, maxDist: Infinity,
    description: "Massiv & nachhaltig. Pflicht ab 65 Lj.",
    buildYearsBase: 80,  buildYearsMax: 200,
    buildWorkersBase: 1_000_000, buildWorkersMax: 10_000_000,
    buildCostBase_B: 30_000,    buildCostMax_B: 350_000,
  },
};

function calculateBuildStats(shipClass, crew) {
  const def   = SHIP_CLASSES[shipClass];
  const ratio = (crew - def.minCrew) / Math.max(1, def.maxCrew - def.minCrew);

  const years   = Math.round(def.buildYearsBase   + (def.buildYearsMax   - def.buildYearsBase)   * ratio);
  const workers = Math.round(def.buildWorkersBase  + (def.buildWorkersMax - def.buildWorkersBase)  * ratio);
  const costB   = Math.round(def.buildCostBase_B   + (def.buildCostMax_B  - def.buildCostBase_B)   * ratio);

  // Comparison note (NASA budget ≈ 25 Mrd. €/year; world GDP ≈ 100,000 Mrd. €)
  let note;
  if (costB < 5_000) {
    note = `Das entspricht etwa ${Math.round(costB / 25)}× dem NASA-Jahresbudget.`;
  } else if (costB < 50_000) {
    note = `Ein weltweites Großprojekt — größer als alles, was die Menschheit je gebaut hat.`;
  } else {
    const pct = (costB / 100_000 * 100).toFixed(0);
    note = `≈ ${pct} % des heutigen Welt-BIP — nur als gemeinsames Projekt aller Nationen über Generationen denkbar.`;
  }

  return { years, workers, costB, note };
}

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

  // ── Relativistic time dilation ─────────────────────────────────────────────
  // β = v/c,  γ = 1/√(1−β²)
  // Earth time  : t_earth = d / v  (coordinate time, what clocks on Earth show)
  // Crew time   : t_crew  = t_earth / γ = t_earth × √(1−β²)
  //               (proper time — the crew ages by this amount)
  // Faster ship → higher γ → crew experiences noticeably less time
  const beta         = v_eff;                              // v as fraction of c
  const lorentzGamma = 1 / Math.sqrt(1 - beta * beta);
  const travelYears_earth = parseFloat((distance / v_eff).toFixed(1));
  const travelYears_crew  = parseFloat((travelYears_earth / lorentzGamma).toFixed(1));
  const timeSaved_years   = parseFloat((travelYears_earth - travelYears_crew).toFixed(1));

  // Generations on board based on crew's experienced time
  const generations = Math.max(1, Math.ceil(travelYears_crew / 25));

  // Resources consumed at the crew's rate (not Earth time)
  const fuel       = Math.round(shipMass * Math.pow(v_eff, 2) * 140);
  const food       = Math.round(crew * travelYears_crew * 1.2);   // crew time!
  const medical    = Math.round(crew * 0.4 + travelYears_crew * 0.6);
  const spareParts = Math.round(shipMass * 0.06 * travelYears_crew);
  const totalMass  = shipMass + fuel + food + medical + spareParts;

  const buildStats = calculateBuildStats(shipClass, crew);

  return {
    input: { shipClass, shipLabel: def.label, shipEmoji: def.emoji, crew, speedFrac: v_eff, distance_ly: distance },
    travelYears_earth,
    travelYears_crew,
    timeSaved_years,
    lorentzGamma: parseFloat(lorentzGamma.toFixed(4)),
    generations,
    resources: { fuel, food, medical, spareParts, totalMass },
    arrivalYear: new Date().getFullYear() + Math.round(travelYears_earth),
    colonyRequired: distance > COLONY_MIN_DIST,
    buildStats,
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
function generateMissionLog(shipClass, crew, distance, travelYears_earth, travelYears_crew, generations, starName) {
  const entries = [];
  const Y       = travelYears_crew;   // logbook time = what the crew experiences
  const saved   = Math.round(travelYears_earth - travelYears_crew);

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

  // ── 1b. RELATIVISTISCHER EFFEKT ───────────────────────────────────────────
  // Nur einblenden wenn der Unterschied merklich ist (≥ 1 Jahr gespart)
  if (saved >= 1) {
    const savedText = saved === 1 ? "1 Jahr" : `${saved} Jahre`;
    add(0.05, "⏱️",
      `Einstein hatte recht! Wegen unserer Geschwindigkeit läuft die Zeit an Bord etwas langsamer ` +
      `als auf der Erde. Wir erleben diese Reise ${savedText} kürzer als die Menschen zu Hause — ` +
      `und brauchen dafür auch weniger Proviant!`,
      "milestone");
  } else {
    add(0.05, "⏱️",
      "Interessant: Bei unserer Geschwindigkeit ticken die Uhren an Bord winzig langsamer als auf " +
      "der Erde — Einstein nannte das Zeitdilatation. Der Unterschied ist noch klein, aber er ist real!",
      "info");
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

  // Colony ships: children are born within the first decade — families were aboard from day 1
  if (shipClass === "colony") {
    entries.push({
      year: 7, icon: "👶",
      text: "Das erste Kind wird an Bord geboren — 3,4 kg, gesund, laut. Das Schiff wird zur echten Heimat.",
      type: "milestone",
    });
    if (generations >= 3) {
      add(0.40, "📖", "Die Enkel der Gründer führen jetzt das Schiff. Sie haben eine eigene Sprache entwickelt: neue Wörter für Sterne!", "milestone");
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
  } else {
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
  }

  // ── 4b. AMEISEN-EREIGNIS — Story-Trigger für den Datenspeicher-Quest ─────────
  // Fires just before the data_storage quest (colony: 0.30, cruiser: 0.67)
  if (shipClass === "colony") {
    add(0.28, "🐜",
      "ALARM! Ameisen aus dem Gewächshaus haben sich ausgebreitet — sie gelten als unverzichtbar " +
      "für die Bestäubung der Pflanzen an Bord. Doch jetzt sind Tausende unkontrolliert durch das Schiff " +
      "gewandert und in die Datenspeicher-Backups eingedrungen. Mehrere Sicherungslaufwerke sind ausgefallen. " +
      "Notfallsitzung: Welches Wissen retten wir — es bleibt nicht genug Platz für alles!",
      "problem");
  } else if (shipClass === "cruiser") {
    add(0.65, "🐜",
      "ALARM! Ameisen aus dem Biologielabor sind entkommen und in die Backup-Datenspeicher eingedrungen. " +
      "Die Kapazität ist knapp — wir müssen sofort entscheiden, welches Wissen wir für die Zukunft sichern!",
      "problem");
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
    calculateMission, calculateBuildStats, generateMissionLog, getExampleMissions,
    getRecommendation, availableClasses, validateConfig,
    SHIP_CLASSES, SCOUT_MAX_DIST, COLONY_MIN_DIST, crewToSpeed,
  };
}
