/**
 * Module 3 UI – Interstellar Travel Planner
 * Player configures ship class, crew size, and speed.
 * Shows computed travel time, resources, risk, and a countdown launch sequence.
 */

"use strict";

const TravelPlannerUI = (() => {
  let targetPlanet = null;

  // ── Init ────────────────────────────────────────────────────────────────────

  function init() {
    document.getElementById("ship-class").addEventListener("change", updatePreview);
    document.getElementById("crew-count").addEventListener("input",  updatePreview);
    document.getElementById("speed-frac").addEventListener("input",  updatePreview);
    document.getElementById("btn-launch").addEventListener("click",  onLaunchClick);
    document.getElementById("btn-examples").addEventListener("click", showExamples);
  }

  // ── Load Target Planet from Module 2 ────────────────────────────────────────

  function loadTarget(planet) {
    targetPlanet = planet;

    // Derive distance: planets store star data via starName → look up in catalog
    const stars   = GameState.get("stars");
    const star     = stars.find(s => s.name === planet.starName) || { distance: 20 };
    GameState.set("travelDistance", star.distance);

    document.getElementById("travel-target-name").textContent = planet.starName;
    document.getElementById("travel-distance").textContent    = star.distance + " Lj";
    document.getElementById("travel-class").textContent       = planet.classification;

    updatePreview();
  }

  // ── Live Preview ─────────────────────────────────────────────────────────────

  function updatePreview() {
    const cfg = getConfig();
    if (!cfg) return;

    const err = validateConfig(cfg.shipClass, cfg.crew);
    if (err) {
      document.getElementById("config-error").textContent  = err;
      document.getElementById("config-error").style.display = "block";
      document.getElementById("btn-launch").disabled        = true;
      return;
    }
    document.getElementById("config-error").style.display = "none";
    document.getElementById("btn-launch").disabled         = false;

    const result = calculateMission(cfg);
    renderResult(result);
  }

  function getConfig() {
    const distance = GameState.get("travelDistance");
    if (!distance) return null;
    return {
      shipClass: document.getElementById("ship-class").value,
      crew:      parseInt(document.getElementById("crew-count").value, 10) || 1,
      speedFrac: parseFloat(document.getElementById("speed-frac").value) || 0.05,
      distance,
    };
  }

  // ── Render Result ────────────────────────────────────────────────────────────

  function renderResult(r) {
    const riskColor = r.riskPercent < 20 ? "#00ff88"
                    : r.riskPercent < 50 ? "#ffcc00"
                    : "#ff4422";

    document.getElementById("travel-years").textContent =
      r.travelYears.toLocaleString() + " Jahre";
    document.getElementById("travel-arrival").textContent =
      "Ankunft ca. " + r.arrivalYear;
    document.getElementById("travel-generations").textContent =
      r.generations > 1 ? `${r.generations} Generationen` : "Eine Generation";
    document.getElementById("travel-speed").textContent =
      (r.input.speedFrac * 100).toFixed(2) + "% c";

    document.getElementById("res-fuel").textContent       = r.resources.fuel.toLocaleString();
    document.getElementById("res-food").textContent       = r.resources.food.toLocaleString();
    document.getElementById("res-medical").textContent    = r.resources.medical.toLocaleString();
    document.getElementById("res-parts").textContent      = r.resources.spareParts.toLocaleString();
    document.getElementById("res-total").textContent      = r.resources.totalMass.toLocaleString();

    const riskEl = document.getElementById("travel-risk");
    riskEl.textContent   = r.riskPercent + "%";
    riskEl.style.color   = riskColor;

    // Risk bar
    const riskBar = document.getElementById("risk-bar-fill");
    riskBar.style.width      = r.riskPercent + "%";
    riskBar.style.background = riskColor;

    GameState.set("currentMission", r);
  }

  // ── Launch Sequence ──────────────────────────────────────────────────────────

  function onLaunchClick() {
    const cfg = getConfig();
    if (!cfg || validateConfig(cfg.shipClass, cfg.crew)) return;

    document.getElementById("btn-launch").disabled = true;
    GameState.log(`Mission gestartet: ${cfg.shipClass.toUpperCase()} → ${targetPlanet?.starName}`);

    // Dramatic 5-step countdown
    const steps = [
      "Triebwerke hochgefahren…",
      "Navigationssystem kalibriert…",
      "Lebenserhaltung aktiv…",
      "Warpgeschwindigkeit wird erreicht…",
      "Abflug!",
    ];
    const log = document.getElementById("launch-log");
    log.innerHTML = "";
    log.style.display = "block";

    steps.forEach((step, i) => {
      setTimeout(() => {
        const line = document.createElement("div");
        line.className = "launch-step";
        line.textContent = `[T+${i + 1}s] ${step}`;
        log.appendChild(line);
        line.scrollIntoView({ behavior: "smooth" });

        if (i === steps.length - 1) {
          setTimeout(() => revealMissionOutcome(), 1500);
        }
      }, i * 900);
    });
  }

  function revealMissionOutcome() {
    const mission = GameState.get("currentMission");
    const panel   = document.getElementById("outcome-panel");
    panel.style.display = "block";

    if (mission.missionFails) {
      panel.innerHTML = `
        <h3 class="outcome-fail">Mission Gescheitert</h3>
        <p class="outcome-cause">${mission.failureCause}</p>
        <p>Reisezeit erreicht: ${Math.round(mission.travelYears * 0.3)} Jahre</p>
      `;
      GameState.addToScore(-300, "Mission gescheitert: " + mission.failureCause);
    } else {
      const bonus = Math.max(100, Math.round(5000 / mission.travelYears));
      GameState.addToScore(bonus, `Erfolgreiche Mission zu ${targetPlanet?.starName}`);
      panel.innerHTML = `
        <h3 class="outcome-success">Mission Erfolgreich!</h3>
        <p>Das Schiff erreichte ${targetPlanet?.starName} nach
           <strong>${mission.travelYears.toLocaleString()} Jahren</strong>.</p>
        <p>Ankunftsjahr: <strong>${mission.arrivalYear}</strong></p>
        <p>+${Math.max(100, Math.round(5000 / mission.travelYears))} Punkte</p>
      `;
    }
    document.getElementById("btn-launch").disabled = false;
    updateScoreDisplay();
  }

  // ── Example Missions ─────────────────────────────────────────────────────────

  function showExamples() {
    const distance = GameState.get("travelDistance") || 20;
    const examples = getExampleMissions(distance);
    const panel    = document.getElementById("examples-panel");
    panel.style.display = "block";

    panel.innerHTML = "<h4>Beispiel-Missionen</h4>" + examples.map(r => `
      <div class="example-mission">
        <span class="ex-class">${r.input.shipLabel}</span>
        <span>${r.travelYears.toLocaleString()} J</span>
        <span>Crew ${r.input.crew}</span>
        <span>${(r.input.speedFrac * 100).toFixed(2)}%c</span>
        <span style="color:${r.riskPercent < 30 ? '#0f8' : r.riskPercent < 60 ? '#fc0' : '#f44'}">
          Risiko ${r.riskPercent}%</span>
      </div>
    `).join("");
  }

  function updateScoreDisplay() {
    document.getElementById("score-display").textContent =
      "Punkte: " + GameState.get("score").toLocaleString();
  }

  return { init, loadTarget };
})();
