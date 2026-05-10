"use strict";

/**
 * Quest system for Module 3 – Interstellar Travel Planner
 * Quests are inserted into the mission logbook at fixed fractions
 * of the journey. Wrong answers cost resources; right answers give bonus points.
 * The mission never fails — consequences vary the outcome.
 */

// ── Which quests fire on which ship, and when ─────────────────────────────────

const QUEST_SCHEDULE = {
  // Scout: 3 quests, well spread — dosimeter early, reactor mid, swingby at arrival
  scout: [
    { fraction: 0.18, id: "dosimeter" },
    { fraction: 0.52, id: "reactor" },
    { fraction: 0.86, id: "swingby" },
  ],
  // Cruiser: 5 quests, no two of the same kind adjacent
  cruiser: [
    { fraction: 0.11, id: "dosimeter" },
    { fraction: 0.28, id: "pulsar" },
    { fraction: 0.48, id: "reactor" },
    { fraction: 0.67, id: "data_storage" },
    { fraction: 0.87, id: "swingby" },
  ],
  // Colony: 7 quests — dosimeter repeats (periodic radiation checks on long missions)
  colony: [
    { fraction: 0.07, id: "dosimeter" },
    { fraction: 0.18, id: "government" },
    { fraction: 0.30, id: "data_storage" },
    { fraction: 0.43, id: "pulsar" },
    { fraction: 0.56, id: "reactor" },
    { fraction: 0.70, id: "dosimeter" },
    { fraction: 0.88, id: "swingby" },
  ],
};

// ── Quest definitions ─────────────────────────────────────────────────────────

const QUEST_DEFS = {
  dosimeter: {
    type: "mcq",
    title: "⚠️ Strahlungsalarm!",
    story: "Das Dosimeter schlägt Alarm — galaktische Strahlung durchdringt die Hülle. Du bist der einzige Offizier auf der Brücke. Handle sofort!",
    question: "Welches Material muss jetzt in die Schutzschicht der Hülle gepumpt werden?",
    options: [
      { label: "🔩 Blei",      value: "lead" },
      { label: "💧 Wasser",    value: "water" },
      { label: "🪨 Aluminium", value: "aluminium" },
    ],
    correct: "water",
    explanations: {
      water:     "✅ Richtig! Wasser enthält viele Wasserstoffatome. Diese winzigen Atome können geladene Teilchen und Neutronen viel besser abbremsen als schwere Metalle — ein physikalischer Trick, den auch die ISS nutzt!",
      lead:      "❌ Blei schirmt Röntgenstrahlen gut ab, aber gegen galaktische Strahlung mit Neutronen versagt es. Die kleinen Wasserstoffatome im Wasser sind hier entscheidend — Masse allein reicht nicht.",
      aluminium: "❌ Aluminium ist leicht und strukturell gut, aber kein effektiver Strahlungsschutz gegen kosmische Strahlung. Wasser mit seinen vielen Wasserstoffatomen wäre viel besser gewesen.",
    },
    penalty: { food: 0.06 },
  },

  pulsar: {
    type: "pulsar",
    title: "🌟 Pulsar-Navigation",
    story: "Die Navigationssoftware meldet einen Fehler. Wir müssen manuell nachkalibrieren. Zwei Sternenkarten liegen vor dir — eine von heute, eine von vor 10 Jahren. Die meisten Sterne haben sich leicht bewegt. Pulsare nicht: sie drehen sich so gleichmäßig, dass man sie als Navigationsbaken nutzen kann.",
    task: "Finde und klicke auf die Sterne, die sich NICHT bewegt haben.",
    nStars: 50,
    nPulsars: 3,
    penalty: { fuel: 0.04 },
  },

  reactor: {
    type: "reactor",
    title: "🔬 Fusionsreaktor kritisch!",
    story: "Der Bordcomputer meldet Instabilität im Reaktorkern. Du musst Temperatur, Magnetfeld und Brennstoffzufuhr in Balance bringen — zu viel von einem Parameter zerstört die Fusion.",
    penalty: { fuel: 0.08 },
  },

  swingby: {
    type: "swingby",
    title: "🌀 Swing-by Manöver",
    story: "Wir nähern uns dem Zielsystem. Ein direkter Bremsmanöver würde enorme Treibstoffreserven kosten. Stattdessen können wir die Schwerkraft des Zielsternes nutzen — ein sogenannter Swing-by. Aber der Einflugswinkel muss stimmen: zu nah bedeutet Absturz, zu weit bedeutet kein Bremseffekt.",
    penalty: { fuel: 0.12 },
  },

  data_storage: {
    type: "data_storage",
    title: "💾 Wissen für die Zukunft",
    story: "Der Datenspeicher hat genau 100 Einheiten Kapazität. Ihr müsst jetzt entscheiden, welches Wissen ihr für die kommenden Generationen sichert. Was ihr weglasst, wird auf der Reise vergessen.",
    categories: [
      { id: "health", label: "💊 Medizin",         min: 20, warn: "Ohne Medizinwissen wird die Crew krank und es gibt keine Heilung." },
      { id: "food",   label: "🌱 Landwirtschaft",  min: 20, warn: "Ohne Agrarwissen droht Hunger — die Ernte fällt aus." },
      { id: "art",    label: "🎨 Kunst & Kultur",  min: 12, warn: "Ohne Kultur verliert die Crew den Lebenswillen und es droht Meuterei." },
      { id: "tech",   label: "⚙️ Technik",         min: 15, warn: "Ohne Technikwissen können Schäden am Schiff nicht repariert werden." },
    ],
    penalty: { food: 0.08 },
  },

  government: {
    type: "government",
    title: "🏛️ Gesellschaftsform",
    story: "Eure Gemeinschaft wächst. Die ersten Kinder sind geboren, die ersten Konflikte entstehen. Ihr müsst entscheiden, wie ihr euch als Gesellschaft organisiert. Es gibt keine perfekte Antwort — aber manche Formen passen besser zur Reisedauer.",
    options: [
      {
        value: "democracy",
        label: "🗳️ Demokratie",
        desc: "Alle entscheiden gemeinsam. Langsam, aber gerecht und stabil.",
        consequence: "Die Crew bleibt über Generationen motiviert. Konflikte werden friedlich gelöst. Ideal für lange Reisen.",
        goodFor: "long",
      },
      {
        value: "autocracy",
        label: "👑 Autokratie",
        desc: "Ein Anführer trifft schnelle Entscheidungen. Effizient — aber riskant.",
        consequence: "Erste Jahre sehr effizient. Nach zwei Generationen wächst der Unmut, bis es zu einem Rat kommt.",
        goodFor: "short",
      },
      {
        value: "council",
        label: "⚖️ Expertenrat",
        desc: "Wissenschaftler und Ingenieure entscheiden gemeinsam. Sachlich, fair.",
        consequence: "Technisch optimale Entscheidungen, aber geringe emotionale Bindung der Bevölkerung.",
        goodFor: "medium",
      },
    ],
  },
};

// ── Build quest entries for a mission ─────────────────────────────────────────

function buildQuestEntries(shipClass, travelYears_crew, crew) {
  const schedule = QUEST_SCHEDULE[shipClass] || QUEST_SCHEDULE.cruiser;
  return schedule.map(({ fraction, id }) => {
    const def  = QUEST_DEFS[id];
    const year = Math.max(1, Math.round(fraction * travelYears_crew));
    const entry = {
      year,
      fraction,
      icon:     def.title.slice(0, 2),
      text:     def.title.slice(3),
      type:     "quest",
      questId:  id,
      questDef: def,
      resolved: false,
      correct:  null,
    };
    if (id === "reactor") Object.assign(entry, buildReactorData());
    return entry;
  });
}

function buildReactorData() {
  // Randomise target zones slightly so each reactor quest feels different
  const tBase = 55 + Math.floor(Math.random() * 15);  // 55–70
  const mBase = 50 + Math.floor(Math.random() * 15);  // 50–65
  const fBase = 45 + Math.floor(Math.random() * 15);  // 45–60
  return {
    reactorTargets: {
      temp: [tBase, tBase + 20],
      mag:  [mBase, mBase + 20],
      fuel: [fBase, fBase + 20],
    }
  };
}

if (typeof module !== "undefined") {
  module.exports = { QUEST_DEFS, QUEST_SCHEDULE, buildQuestEntries, buildReactorData };
}
