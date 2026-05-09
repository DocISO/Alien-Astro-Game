/**
 * Module 3 UI – Interstellar Travel Planner
 * Ship class and crew size determine speed automatically.
 * Mission always succeeds — outcome shown as a child-friendly logbook.
 */

"use strict";

const TravelPlannerUI = (() => {
  let targetPlanet = null;
  let distance     = 0;

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    document.getElementById("btn-launch").addEventListener("click", onLaunchClick);
    document.getElementById("btn-examples").addEventListener("click", showExamples);
  }

  // ── Load Target from Module 2 ─────────────────────────────────────────────────

  function loadTarget(planet) {
    targetPlanet = planet;
    const stars  = GameState.get("stars");
    const star   = stars.find(s => s.name === planet.starName) || { distance: 20 };
    distance     = star.distance;
    GameState.set("travelDistance", distance);

    document.getElementById("travel-target-name").textContent = planet.starName;
    document.getElementById("travel-distance").textContent    = distance + " Lj";
    document.getElementById("travel-class").textContent       = planet.classification;

    // Reset logbook from previous mission
    document.getElementById("logbook-panel").style.display = "none";
    document.getElementById("logbook-entries").innerHTML   = "";
    document.getElementById("btn-launch").disabled         = false;

    renderShipSelector();
  }

  // ── Ship Selector ─────────────────────────────────────────────────────────────

  function renderShipSelector() {
    const avail  = availableClasses(distance);
    const rec    = getRecommendation(distance);

    document.getElementById("colony-required-banner").style.display =
      distance > COLONY_MIN_DIST ? "block" : "none";

    document.getElementById("ship-cards").innerHTML =
      Object.entries(SHIP_CLASSES).map(([key, def]) => {
        const locked = !avail.includes(key);
        const isRec  = rec.shipClass === key;
        return `
          <div class="ship-card ${locked ? "ship-locked" : ""} ${isRec ? "ship-recommended" : ""}"
               data-class="${key}"
               onclick="${locked ? "" : `TravelPlannerUI.selectShip('${key}')`}">
            <div class="ship-card-emoji">${def.emoji}</div>
            <div class="ship-card-label">${def.label}</div>
            <div class="ship-card-speed">${(def.baseSpeed*100).toFixed(0)}%c → ${(def.minSpeed*100).toFixed(0)}%c</div>
            <div class="ship-card-crew">Crew ${def.minCrew}–${def.maxCrew}</div>
            <div class="ship-card-desc">${def.description}</div>
            ${isRec   ? '<div class="ship-rec-badge">Empfohlen</div>'     : ""}
            ${locked  ? '<div class="ship-locked-badge">Nicht verfügbar</div>' : ""}
          </div>`;
      }).join("");

    selectShip(rec.shipClass, rec.crew);
  }

  function selectShip(shipClass, presetCrew) {
    document.querySelectorAll(".ship-card").forEach(c => c.classList.remove("ship-selected"));
    const card = document.querySelector(`.ship-card[data-class="${shipClass}"]`);
    if (card) card.classList.add("ship-selected");

    const def    = SHIP_CLASSES[shipClass];
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
    const def        = SHIP_CLASSES[shipClass];
    const v          = crewToSpeed(def, crew);
    const crewRatio  = (crew - def.minCrew) / (def.maxCrew - def.minCrew);

    document.getElementById("crew-value").textContent    = crew + " Personen";
    document.getElementById("speed-derived").textContent = (v * 100).toFixed(2) + "% c";

    const bar = document.getElementById("balance-bar-fill");
    bar.style.width      = (crewRatio * 100).toFixed(0) + "%";
    bar.style.background = crewRatio < 0.4 ? "var(--accent)"
                         : crewRatio < 0.7 ? "var(--warn)"
                         : "var(--danger)";
    document.getElementById("balance-label-speed").style.fontWeight = crewRatio < 0.5 ? "700" : "400";
    document.getElementById("balance-label-crew").style.fontWeight  = crewRatio > 0.5 ? "700" : "400";
  }

  // ── Live Preview ──────────────────────────────────────────────────────────────

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
    renderResult(calculateMission({ shipClass, crew, distance }));
  }

  function getSelectedClass() {
    const sel = document.querySelector(".ship-card.ship-selected");
    return sel ? sel.dataset.class : null;
  }

  function onCrewChange(value) {
    const shipClass = getSelectedClass();
    if (!shipClass) return;
    const crew = parseInt(value, 10);
    updateCrewDisplay(shipClass, crew);
    updatePreview(shipClass, crew);
  }

  // ── Render Mission Summary ────────────────────────────────────────────────────

  function renderResult(r) {
    const tColor = r.travelYears_earth < 100 ? "var(--success)"
                 : r.travelYears_earth < 300 ? "var(--warn)"
                 : "var(--danger)";
    const saved  = r.timeSaved_years;

    document.getElementById("travel-years-earth").textContent = r.travelYears_earth.toLocaleString() + " Jahre";
    document.getElementById("travel-years-earth").style.color = tColor;
    document.getElementById("travel-years-crew").textContent  = r.travelYears_crew.toLocaleString() + " Jahre";
    document.getElementById("travel-years-crew").style.color  = "var(--accent2)";
    document.getElementById("travel-lorentz").textContent     = "γ = " + r.lorentzGamma.toFixed(4);
    document.getElementById("travel-saved").textContent       =
      saved > 0 ? `−${saved} J Proviant gespart` : "kein messbarer Unterschied";
    document.getElementById("travel-saved").style.color =
      saved >= 5 ? "var(--success)" : saved >= 1 ? "var(--accent2)" : "var(--text-dim)";
    document.getElementById("travel-arrival").textContent  = "Ankunft ca. " + r.arrivalYear;
    document.getElementById("travel-generations").textContent =
      r.generations > 1 ? `${r.generations} Generationen` : "Eine Generation";
    document.getElementById("travel-speed").textContent    = (r.input.speedFrac * 100).toFixed(2) + "% c";

    document.getElementById("res-fuel").textContent     = r.resources.fuel.toLocaleString();
    document.getElementById("res-food").textContent     = r.resources.food.toLocaleString();
    document.getElementById("res-medical").textContent  = r.resources.medical.toLocaleString();
    document.getElementById("res-parts").textContent    = r.resources.spareParts.toLocaleString();
    document.getElementById("res-total").textContent    = r.resources.totalMass.toLocaleString();

    const b = r.buildStats;
    document.getElementById("build-years").textContent =
      b.years + (b.years >= 80 ? " Jahre ⚠ Generationenprojekt" : " Jahre");
    document.getElementById("build-workers").textContent =
      b.workers >= 1_000_000
        ? (b.workers / 1_000_000).toFixed(1).replace(".", ",") + " Mio. Personen"
        : (Math.round(b.workers / 1000) * 1000).toLocaleString() + " Personen";
    document.getElementById("build-cost").textContent =
      b.costB >= 1000
        ? (b.costB / 1000).toFixed(1).replace(".", ",") + " Bio. €"
        : b.costB.toLocaleString() + " Mrd. €";
    document.getElementById("build-note").textContent = b.note;

    GameState.set("currentMission", r);
  }

  // ── Launch + Logbook ──────────────────────────────────────────────────────────

  function onLaunchClick() {
    const shipClass = getSelectedClass();
    const crew      = parseInt(document.getElementById("crew-slider").value, 10);
    if (!shipClass || validateConfig(shipClass, crew, distance)) return;

    const mission = GameState.get("currentMission");
    document.getElementById("btn-launch").disabled         = true;
    document.getElementById("logbook-panel").style.display = "block";
    document.getElementById("logbook-entries").innerHTML   = "";

    GameState.log(`${SHIP_CLASSES[shipClass].emoji} Mission gestartet → ${targetPlanet?.starName}`);

    const storyEntries = generateMissionLog(
      shipClass, crew, distance,
      mission.travelYears_earth, mission.travelYears_crew, mission.generations,
      targetPlanet?.starName || "Zielplanet"
    );

    // Build quest entries and inject travel years for government quest
    const questEntries = buildQuestEntries(shipClass, mission.travelYears_crew, crew);
    questEntries.forEach(q => { q._travelYears = mission.travelYears_crew; });

    // Merge and sort all entries by year
    const allEntries = [...storyEntries, ...questEntries].sort((a, b) => a.year - b.year);

    // Animate sequentially — pauses on quest entries until player resolves them
    animateSequential(allEntries, mission);
  }

  function animateSequential(entries, mission) {
    let idx = 0;

    function next() {
      if (idx >= entries.length) {
        setTimeout(() => finishMission(mission), 800);
        return;
      }
      const entry = entries[idx++];

      if (entry.type === "quest") {
        // Render quest header in logbook
        appendQuestHeader(entry, mission.travelYears_earth);
        // Render interactive quest panel
        const container = document.getElementById("logbook-entries");
        const questEl   = document.createElement("div");
        questEl.className = "quest-embed";
        container.appendChild(questEl);
        questEl.scrollIntoView({ behavior: "smooth", block: "nearest" });

        QuestPanel.show(entry, questEl, (correct) => {
          applyQuestConsequence(correct, entry, mission, container);
          // Collapse panel to a summary line
          questEl.innerHTML = `<div class="quest-resolved">${correct ? "✅" : "⚠️"} ${entry.questDef.title} — ${correct ? "bestanden" : "nicht bestanden"}</div>`;
          setTimeout(next, 700);
        });
      } else {
        appendLogEntry(entry, mission.travelYears_earth);
        setTimeout(next, 620);
      }
    }

    next();
  }

  function applyQuestConsequence(correct, entry, mission, container) {
    const def = entry.questDef;
    if (correct) {
      if (def.bonus) GameState.addToScore(def.bonus, `Quest: ${def.title}`);
      document.getElementById("score-display").textContent =
        "Punkte: " + GameState.get("score").toLocaleString();
    } else if (def.penalty) {
      // Apply resource penalty and log it
      const res = mission.resources;
      const msgs = Object.entries(def.penalty).map(([key, frac]) => {
        const loss = Math.round((res[key] || 0) * frac);
        if (loss > 0) {
          res[key] = Math.max(0, (res[key] || 0) - loss);
          const labels = { food: "Nahrung", fuel: "Treibstoff", medical: "Medizin" };
          return `${labels[key] || key} −${loss.toLocaleString()} t`;
        }
        return null;
      }).filter(Boolean);
      if (msgs.length) {
        const penaltyDiv = document.createElement("div");
        penaltyDiv.className = "log-entry log-problem";
        penaltyDiv.innerHTML = `
          <span class="log-year">Konsequenz</span>
          <span class="log-icon">📉</span>
          <span class="log-text">${msgs.join(" · ")}</span>
        `;
        container.appendChild(penaltyDiv);
      }
    }
  }

  function appendLogEntry(entry, totalYears) {
    const container = document.getElementById("logbook-entries");
    const div       = document.createElement("div");
    div.className   = `log-entry log-${entry.type}`;
    const yearLabel = yearTag(entry.year, totalYears);
    div.innerHTML = `
      <span class="log-year">${yearLabel}</span>
      <span class="log-icon">${entry.icon}</span>
      <span class="log-text">${entry.text}</span>
    `;
    container.appendChild(div);
    div.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function appendQuestHeader(entry, totalYears) {
    const container = document.getElementById("logbook-entries");
    const div       = document.createElement("div");
    div.className   = "log-entry log-quest-header";
    div.innerHTML = `
      <span class="log-year">${yearTag(entry.year, totalYears)}</span>
      <span class="log-icon">🎯</span>
      <span class="log-text"><strong>MISSION:</strong> ${entry.questDef.title}</span>
    `;
    container.appendChild(div);
    div.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function yearTag(year, totalYears) {
    return year === 0 ? "Start" : year >= totalYears ? "Ankunft" : `Jahr ${year}`;
  }

  function finishMission(mission) {
    const bonus = Math.max(300, Math.round(10000 / mission.travelYears_earth));
    GameState.addToScore(bonus, `Mission zu ${targetPlanet?.starName} abgeschlossen`);

    const footer = document.createElement("div");
    footer.className = "log-finish";
    footer.innerHTML = `
      <div class="log-finish-title">Mission abgeschlossen!</div>
      <div class="log-finish-bonus">+${bonus} Punkte</div>
    `;
    document.getElementById("logbook-entries").appendChild(footer);
    footer.scrollIntoView({ behavior: "smooth" });

    document.getElementById("btn-launch").disabled = false;
    document.getElementById("score-display").textContent =
      "Punkte: " + GameState.get("score").toLocaleString();
  }

  // ── Example Missions ──────────────────────────────────────────────────────────

  function showExamples() {
    const examples = getExampleMissions(distance || 20);
    const panel    = document.getElementById("examples-panel");
    panel.style.display = "block";
    panel.innerHTML = "<h4>Beispiel-Missionen</h4>" + examples.map(r => {
      const tColor = r.travelYears < 150 ? "#0f8" : r.travelYears < 400 ? "#fc0" : "#f44";
      return `
        <div class="example-mission">
          <span class="ex-class">${r.input.shipEmoji} ${r.input.shipLabel}</span>
          <span style="color:${tColor}">${r.travelYears.toLocaleString()} J</span>
          <span>${r.input.crew} Crew</span>
          <span>${(r.input.speedFrac * 100).toFixed(1)}%c</span>
          <span>${r.generations} Gen.</span>
        </div>`;
    }).join("");
  }

  return { init, loadTarget, selectShip, onCrewChange };
})();
