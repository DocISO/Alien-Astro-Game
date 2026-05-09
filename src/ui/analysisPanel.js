/**
 * Module 2 UI – Exoplanet Analysis Panel
 * Visualises the star-planet system and computed orbital parameters.
 */

"use strict";

const AnalysisPanelUI = (() => {
  let simCanvas, simCtx;
  let animHandle = null;
  let planetAngle = 0;        // orbital animation state
  let currentResult = null;

  // ── Init ────────────────────────────────────────────────────────────────────

  function init(simCanvasId) {
    simCanvas = document.getElementById(simCanvasId);
    simCtx    = simCanvas.getContext("2d");

    document.getElementById("btn-run-analysis")
      .addEventListener("click", onAnalyseClick);

    document.getElementById("btn-travel")
      .addEventListener("click", onTravelClick);
  }

  // ── Analysis Trigger ─────────────────────────────────────────────────────────

  function onAnalyseClick() {
    const data = GameState.get("analysisResult");
    if (!data) return;

    document.getElementById("btn-run-analysis").disabled = true;
    // Clear previous results so the old planet is never shown while loading
    document.getElementById("analysis-results").style.display = "none";
    document.getElementById("btn-travel").disabled = true;

    const delay = 2500 + Math.random() * 2000;

    startAnalysisBar(delay, () => {
      const result = analysePlanet(data.transitParams, data.star);
      currentResult = result;

      // Roll for analysis error (15% chance of corrupted data)
      const analysisError = Math.random() < 0.15;
      if (analysisError) {
        const perturbedResult = perturbResult(result);
        GameState.log("Warnung: Messfehler! Daten unzuverlässig.");
        displayResults(perturbedResult, true);
      } else {
        displayResults(result, false);
      }

      GameState.set("currentPlanet", currentResult);
      // Bug 2 fix: re-enable button so the next found planet can be analysed
      document.getElementById("btn-run-analysis").disabled = false;
      document.getElementById("btn-travel").disabled = false;
      startOrbitalSimulation(result, data.star);
    });
  }

  /**
   * Adds ±20% random error to key parameters to simulate measurement noise.
   */
  function perturbResult(r) {
    function perturb(v, pct = 0.2) {
      return parseFloat((v * (1 + (Math.random() - 0.5) * pct)).toFixed(4));
    }
    return Object.assign({}, r, {
      period_days:     perturb(r.period_days),
      semiMajorAxis_AU: perturb(r.semiMajorAxis_AU),
      eqTemperature_K: Math.round(perturb(r.eqTemperature_K, 0.3)),
      radius_earth:    perturb(r.radius_earth),
      mass_earth:      perturb(r.mass_earth),
    });
  }

  // ── Results Display ──────────────────────────────────────────────────────────

  function displayResults(r, hasError) {
    const panel = document.getElementById("analysis-results");
    panel.style.display = "block";

    const hzColor = r.hzStatus === "habitable" ? "#00ff88"
                  : r.hzStatus === "inner"     ? "#ff6644"
                  : "#4488ff";

    const habitIcon = r.habitabilityScore >= 70 ? "🌍"
                    : r.habitabilityScore >= 40 ? "🪐"
                    : "💀";

    panel.innerHTML = `
      ${hasError ? '<div class="error-banner">⚠ Messfehler — Werte ungenau</div>' : ""}
      <h3 class="result-title">${r.starName} – Exoplanet</h3>
      <table class="result-table">
        <tr><td>Typ</td><td>${r.classification}</td></tr>
        <tr><td>Umlaufperiode</td><td>${r.period_days} Tage</td></tr>
        <tr><td>Orbitradius</td><td>${r.semiMajorAxis_AU} AU</td></tr>
        <tr><td>Planetenradius</td><td>${r.radius_earth} R⊕</td></tr>
        <tr><td>Planetenmasse</td><td>${r.mass_earth} M⊕</td></tr>
        <tr><td>Gleichgew.-Temp.</td><td>${r.eqTemperature_K} K</td></tr>
        <tr><td>Lebenszone</td>
          <td style="color:${hzColor}">${r.hzStatus === "habitable" ? "✓ In der Zone" : r.hzStatus === "inner" ? "✗ Zu heiß" : "✗ Zu kalt"}</td>
        </tr>
        <tr><td>Habitabilitätswert</td><td>${habitIcon} ${r.habitabilityScore}/100</td></tr>
      </table>
    `;

  }

  // ── Orbital Simulation ───────────────────────────────────────────────────────

  function startOrbitalSimulation(result, star) {
    if (animHandle) cancelAnimationFrame(animHandle);
    planetAngle = 0;
    animateOrbit(result, star);
  }

  function animateOrbit(result, star) {
    drawOrbitScene(result, star);
    planetAngle += (2 * Math.PI) / (result.period_days * 60); // 60fps
    if (planetAngle > 2 * Math.PI) planetAngle -= 2 * Math.PI;
    animHandle = requestAnimationFrame(() => animateOrbit(result, star));
  }

  function drawOrbitScene(result, star) {
    const W = simCanvas.width, H = simCanvas.height;
    simCtx.clearRect(0, 0, W, H);

    // Background
    simCtx.fillStyle = "#060614";
    simCtx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;

    // Scale: entire habitable zone outer edge should fit in 90% of half-width
    const hzOuter_px = (W * 0.42) * (result.habitableZone.outer /
                        Math.max(result.habitableZone.outer, result.semiMajorAxis_AU) * 1.1);
    const pxPerAU    = hzOuter_px / result.habitableZone.outer;

    // Habitable zone ring
    const hzInner_px = result.habitableZone.inner * pxPerAU;
    const hzOuter_px2= result.habitableZone.outer * pxPerAU;

    simCtx.beginPath();
    simCtx.arc(cx, cy, hzOuter_px2, 0, Math.PI * 2);
    simCtx.arc(cx, cy, hzInner_px,  0, Math.PI * 2, true);
    simCtx.fillStyle = "#00ff2210";
    simCtx.fill();
    simCtx.beginPath();
    simCtx.arc(cx, cy, hzOuter_px2, 0, Math.PI * 2);
    simCtx.strokeStyle = "#00ff2230";
    simCtx.lineWidth = 1;
    simCtx.stroke();
    simCtx.beginPath();
    simCtx.arc(cx, cy, hzInner_px, 0, Math.PI * 2);
    simCtx.stroke();

    // Orbit path
    const orbitR = result.semiMajorAxis_AU * pxPerAU;
    simCtx.beginPath();
    simCtx.arc(cx, cy, orbitR, 0, Math.PI * 2);
    simCtx.strokeStyle = "#334466";
    simCtx.setLineDash([4, 4]);
    simCtx.lineWidth = 1;
    simCtx.stroke();
    simCtx.setLineDash([]);

    // Star
    const starR = Math.max(8, Math.min(30, star.radius * 10));
    const starGlow = simCtx.createRadialGradient(cx, cy, 0, cx, cy, starR * 2.5);
    starGlow.addColorStop(0, star.color + "ff");
    starGlow.addColorStop(1, star.color + "00");
    simCtx.beginPath();
    simCtx.arc(cx, cy, starR * 2.5, 0, Math.PI * 2);
    simCtx.fillStyle = starGlow;
    simCtx.fill();
    simCtx.beginPath();
    simCtx.arc(cx, cy, starR, 0, Math.PI * 2);
    simCtx.fillStyle = star.color;
    simCtx.fill();

    // Planet
    const px_p = cx + orbitR * Math.cos(planetAngle);
    const py_p = cy + orbitR * Math.sin(planetAngle);
    const planetR = Math.max(3, Math.min(12, result.radius_earth * 3));

    // Planet glow color by hz status
    const pColor = result.hzStatus === "habitable" ? "#00ff88"
                 : result.hzStatus === "inner"     ? "#ff4422"
                 : "#4488ff";

    const pGlow = simCtx.createRadialGradient(px_p, py_p, 0, px_p, py_p, planetR * 3);
    pGlow.addColorStop(0, pColor + "cc");
    pGlow.addColorStop(1, pColor + "00");
    simCtx.beginPath();
    simCtx.arc(px_p, py_p, planetR * 3, 0, Math.PI * 2);
    simCtx.fillStyle = pGlow;
    simCtx.fill();
    simCtx.beginPath();
    simCtx.arc(px_p, py_p, planetR, 0, Math.PI * 2);
    simCtx.fillStyle = pColor;
    simCtx.fill();

    // Labels
    simCtx.fillStyle = "#8899aa";
    simCtx.font      = "11px monospace";
    simCtx.textAlign = "center";
    simCtx.fillText("Lebenszone", cx + hzOuter_px2 - 30, cy - 5);
    simCtx.fillStyle = "#ccddee";
    simCtx.fillText(result.classification, px_p, py_p - planetR - 6);
  }

  // ── Loading Bar ──────────────────────────────────────────────────────────────

  function startAnalysisBar(durationMs, callback) {
    const bar       = document.getElementById("analysis-bar-fill");
    const container = document.getElementById("analysis-bar");
    container.style.display = "block";
    bar.style.width = "0%";
    const start = performance.now();

    function step(now) {
      const pct = Math.min(100, ((now - start) / durationMs) * 100);
      bar.style.width = pct + "%";
      if (pct < 100) requestAnimationFrame(step);
      else { container.style.display = "none"; callback(); }
    }
    requestAnimationFrame(step);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  function onTravelClick() {
    const planet = GameState.get("currentPlanet");
    if (!planet) return;
    // Pass planet data to travel module
    GameState.set("travelTarget", planet);
    showPanel("travel-panel");
    TravelPlannerUI.loadTarget(planet);
  }

  return { init };
})();
