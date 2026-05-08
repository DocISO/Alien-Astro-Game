/**
 * Module 3 UI – Interstellar Travel Planner
 * Ship class and crew size determine speed automatically.
 * Distance locks unavailable classes and forces colony ship when needed.
 */

"use strict";

const TravelPlannerUI = (() => {
  let targetPlanet = null;
  let distance     = 0;

  // ── Init ────────────────────────────────────────────────────────────────────

  function init() {
    document.getElementById("btn-launch").addEventListener("click", onLaunchClick);
    document.getElementById("btn-examples").addEventListener("click", showExamples);
  }

  // ── Load Target from Module 2 ────────────────────────────────────────────────

  function loadTarget(planet) {
    targetPlanet = planet;
    const stars  = GameState.get("stars");
    const star   = stars.find(s => s.name === planet.starName) || { distance: 20 };
    distance     = star.distance;
    GameState.set("travelDistance", distance);

    document.getElementById("travel-target-name").textContent = planet.starName;
    document.getElementById("travel-distance").textContent    = distance + " Lj";
    document.getElementById("travel-class").textContent       = planet.classification;

    renderShipSelector();
  }

  // ── Ship Selector ─────────────────────────────────────────────────────────────

  function renderShipSelector() {
    const avail  = availableClasses(distance);
    const rec    = getRecommendation(distance);
    const colony = distance > COLONY_MIN_DIST;

    // Colony-required banner
    const banner = document.getElementById("colony-required-banner");
    banner.style.display = colony ? "block" : "none";

    // Build ship cards
    const container = document.getElementById("ship-cards");
    container.innerHTML = Object.entries(SHIP_CLASSES).map(([key, def]) => {
      const locked  = !avail.includes(key);
      const isRec   = rec.shipClass === key;
      return `
        <div class="ship-card ${locked ? "ship-locked" : ""} ${isRec ? "ship-recommended" : ""}"
             data-class="${key}"
             onclick="${locked ? "" : `TravelPlannerUI.selectShip('${key}')`}">
          <div class="ship-card-emoji">${def.emoji}</div>
          <div class="ship-card-label">${def.label}</div>
          <div class="ship-card-speed">${(def.baseSpeed*100).toFixed(0)}%c → ${(def.minSpeed*100).toFixed(0)}%c</div>
          <div class="ship-card-crew">Crew ${def.minCrew}–${def.maxCrew}</div>
          <div class="ship-card-desc">${def.description}</div>
          ${isRec ? '<div class="ship-rec-badge">Empfohlen</div>' : ""}
          ${locked ? '<div class="ship-locked-badge">Nicht verfügbar</div>' : ""}
        </div>
      `;
    }).join("");

    // Auto-select recommendation
    selectShip(rec.shipClass, rec.crew);
  }

  function selectShip(shipClass, presetCrew) {
    // Highlight selected card
    document.querySelectorAll(".ship-card").forEach(c => c.classList.remove("ship-selected"));
    const card = document.querySelector(`.ship-card[data-class="${shipClass}"]`);
    if (card) card.classList.add("ship-selected");

    const def = SHIP_CLASSES[shipClass];

    // Update crew slider bounds
    const slider = document.getElementById("crew-slider");
    slider.min   = def.minCrew;
    slider.max   = def.maxCrew;
    const crew   = presetCrew !== undefined
      ? Math.max(def.minCrew, Math.min(def.maxCrew, presetCrew))
      : Math.round(def.minCrew + (def.maxCrew - def.minCrew) * 0.25);
    slider.value = crew;

    updateCrewDisplay(shipClass, crew);
    updatePreview(shipClass, crew);
  }

  function updateCrewDisplay(shipClass, crew) {
    const def = SHIP_CLASSES[shipClass];
    const v   = crewToSpeed(def, crew);
    document.getElementById("crew-value").textContent   = crew + " Personen";
    document.getElementById("speed-derived").textContent = (v * 100).toFixed(2) + "% c";

    // Balance bar: left = speed, right = crew weight
    const crewRatio = (crew - def.minCrew) / (def.maxCrew - def.minCrew);
    const bar = document.getElementById("balance-bar-fill");
    bar.style.width = (crewRatio * 100).toFixed(0) + "%";
    bar.style.background = crewRatio < 0.4 ? "var(--accent)"
                         : crewRatio < 0.7 ? "var(--warn)"
                         : "var(--danger)";
    document.getElementById("balance-label-speed").style.fontWeight = crewRatio < 0.5 ? "700" : "400";
    document.getElementById("balance-label-crew").style.fontWeight  = crewRatio > 0.5 ? "700" : "400";
  }

  // ── Live Preview ─────────────────────────────────────────────────────────────

  function updatePreview(shipClass, crew) {
    if (!shipClass) return;
    const err = validateConfig(shipClass, crew, distance);
    const errEl = document.getElementById("config-error");
    if (err) {
      errEl.textContent   = err;
      errEl.style.display = "block";
      document.getElementById("btn-launch").disabled = true;
      return;
    }
    errEl.style.display = "none";
    document.getElementById("btn-launch").disabled = false;

    const result = calculateMission({ shipClass, crew, distance });
    renderResult(result);
  }

  function getSelectedClass() {
    const sel = document.querySelector(".ship-card.ship-selected");
    return sel ? sel.dataset.class : null;
  }

  // ── Render Result ────────────────────────────────────────────────────────────

  function renderResult(r) {
    const tColor = r.travelYears < 100  ? "var(--success)"
                 : r.travelYears < 300  ? "var(--warn)"
                 : "var(--danger)";
    const rColor = r.riskPercent  < 20  ? "var(--success)"
                 : r.riskPercent  < 50  ? "var(--warn)"
                 : "var(--danger)";

    document.getElementById("travel-years").textContent = r.travelYears.toLocaleString() + " Jahre";
    document.getElementById("travel-years").style.color = tColor;
    document.getElementById("travel-arrival").textContent     = "Ankunft ca. " + r.arrivalYear;
    document.getElementById("travel-generations").textContent =
      r.generations > 1 ? `${r.generations} Generationen` : "Eine Generation";
    document.getElementById("travel-speed").textContent = (r.input.speedFrac * 100).toFixed(2) + "% c";

    document.getElementById("res-fuel").textContent     = r.resources.fuel.toLocaleString();
    document.getElementById("res-food").textContent     = r.resources.food.toLocaleString();
    document.getElementById("res-medical").textContent  = r.resources.medical.toLocaleString();
    document.getElementById("res-parts").textContent    = r.resources.spareParts.toLocaleString();
    document.getElementById("res-total").textContent    = r.resources.totalMass.toLocaleString();

    const riskEl = document.getElementById("travel-risk");
    riskEl.textContent   = r.riskPercent + "%";
    riskEl.style.color   = rColor;
    document.getElementById("risk-bar-fill").style.width      = r.riskPercent + "%";
    document.getElementById("risk-bar-fill").style.background = rColor;

    GameState.set("currentMission", r);
  }

  // ── Launch Sequence ──────────────────────────────────────────────────────────

  function onLaunchClick() {
    const shipClass = getSelectedClass();
    const crew      = parseInt(document.getElementById("crew-slider").value, 10);
    if (!shipClass || validateConfig(shipClass, crew, distance)) return;

    document.getElementById("btn-launch").disabled   = true;
    document.getElementById("outcome-panel").style.display = "none";
    GameState.log(`Mission: ${SHIP_CLASSES[shipClass].emoji} ${SHIP_CLASSES[shipClass].label} → ${targetPlanet?.starName}`);

    const steps = [
      "Triebwerke hochgefahren…",
      "Navigationssystem kalibriert…",
      "Lebenserhaltung aktiv…",
      "Warpantrieb wird gezündet…",
      "Abflug!",
    ];
    const log = document.getElementById("launch-log");
    log.innerHTML = "";
    log.style.display = "block";

    steps.forEach((step, i) => {
      setTimeout(() => {
        const line = document.createElement("div");
        line.className   = "launch-step";
        line.textContent = `[T+${i + 1}s] ${step}`;
        log.appendChild(line);
        line.scrollIntoView({ behavior: "smooth" });
        if (i === steps.length - 1) setTimeout(revealOutcome, 1500);
      }, i * 900);
    });
  }

  function revealOutcome() {
    const mission = GameState.get("currentMission");
    const panel   = document.getElementById("outcome-panel");
    panel.style.display = "block";

    if (mission.missionFails) {
      panel.innerHTML = `
        <h3 class="outcome-fail">Mission Gescheitert</h3>
        <p class="outcome-cause">${mission.failureCause}</p>
        <p>Zurückgelegte Strecke: ~${Math.round(mission.input.distance_ly * 0.3)} Lj</p>
      `;
      GameState.addToScore(-300, "Mission gescheitert: " + mission.failureCause);
    } else {
      const bonus = Math.max(200, Math.round(8000 / mission.travelYears));
      GameState.addToScore(bonus, `Erfolgreiche Mission zu ${targetPlanet?.starName}`);
      panel.innerHTML = `
        <h3 class="outcome-success">Mission Erfolgreich! ${mission.input.shipEmoji}</h3>
        <p>${mission.input.shipLabel} erreichte <strong>${targetPlanet?.starName}</strong><br>
           nach <strong>${mission.travelYears.toLocaleString()} Jahren</strong>
           (${mission.generations} Generation${mission.generations > 1 ? "en" : ""}).</p>
        <p>Ankunftsjahr: <strong>${mission.arrivalYear}</strong></p>
        <p class="bonus-text">+${bonus} Punkte</p>
      `;
    }
    document.getElementById("btn-launch").disabled = false;
    document.getElementById("score-display").textContent =
      "Punkte: " + GameState.get("score").toLocaleString();
  }

  // ── Example Missions ─────────────────────────────────────────────────────────

  function showExamples() {
    const examples = getExampleMissions(distance || 20);
    const panel    = document.getElementById("examples-panel");
    panel.style.display = "block";
    panel.innerHTML = "<h4>Beispiel-Missionen</h4>" + examples.map(r => {
      const tColor = r.travelYears < 150 ? "#0f8" : r.travelYears < 400 ? "#fc0" : "#f44";
      const rColor = r.riskPercent  < 30  ? "#0f8" : r.riskPercent  < 60  ? "#fc0" : "#f44";
      return `
        <div class="example-mission">
          <span class="ex-class">${r.input.shipEmoji} ${r.input.shipLabel}</span>
          <span style="color:${tColor}">${r.travelYears.toLocaleString()} J</span>
          <span>${r.input.crew} Crew</span>
          <span>${(r.input.speedFrac * 100).toFixed(1)}%c</span>
          <span style="color:${rColor}">Risiko ${r.riskPercent}%</span>
        </div>`;
    }).join("");
  }

  function onCrewChange(value) {
    const shipClass = getSelectedClass();
    if (!shipClass) return;
    const crew = parseInt(value, 10);
    updateCrewDisplay(shipClass, crew);
    updatePreview(shipClass, crew);
  }

  // Public API
  return { init, loadTarget, selectShip, onCrewChange };
})();
