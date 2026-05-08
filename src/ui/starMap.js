/**
 * Module 1 UI – Star Map
 * Renders 1000 stars on an HTML5 Canvas.
 * Handles hover, selection, zoom preview, and the "Untersuchen" workflow.
 */

"use strict";

const StarMapUI = (() => {
  let canvas, ctx;
  let stars          = [];
  let selectedStar   = null;
  let hoveredStar    = null;
  let activeCurve    = null;  // currently displayed light curve
  let chartCanvas, chartCtx;

  // Zoom state
  const zoom = { active: false, cx: 0, cy: 0, radius: 80, scale: 4 };

  // ── Initialisation ──────────────────────────────────────────────────────────

  function init(mapCanvasId, chartCanvasId) {
    canvas     = document.getElementById(mapCanvasId);
    chartCanvas = document.getElementById(chartCanvasId);
    ctx        = canvas.getContext("2d");
    chartCtx   = chartCanvas.getContext("2d");

    stars = generateStarCatalog(1000, canvas.width, canvas.height);
    GameState.set("stars", stars);

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click",     onCanvasClick);

    document.getElementById("btn-investigate")
      .addEventListener("click", onInvestigateClick);

    render();
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Deep space background gradient
    const bg = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, canvas.width * 0.8
    );
    bg.addColorStop(0, "#0a0a1a");
    bg.addColorStop(1, "#000008");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all stars
    stars.forEach(s => drawStar(s, false));

    // Highlight hovered star
    if (hoveredStar) drawStarHighlight(hoveredStar, "#ffffff44", 14);

    // Highlight selected star
    if (selectedStar) drawStarHighlight(selectedStar, "#00ffcc", 16);

    // Zoom lens overlay
    if (zoom.active) drawZoomLens();

    requestAnimationFrame(render);
  }

  function drawStar(star, dimmed) {
    const r = 1 + star.brightness * 2.5;
    const alpha = dimmed ? 0.3 : 0.6 + star.brightness * 0.4;

    // Glow
    const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, r * 3);
    glow.addColorStop(0, star.color + "cc");
    glow.addColorStop(1, star.color + "00");
    ctx.beginPath();
    ctx.arc(star.x, star.y, r * 3, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.globalAlpha = alpha * 0.5;
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(star.x, star.y, r, 0, Math.PI * 2);
    ctx.fillStyle = star.color;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Mark investigated stars
    if (star.investigated) {
      ctx.beginPath();
      ctx.arc(star.x, star.y, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = star.exoplanetData ? "#00ff88" : "#ff6644";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  function drawStarHighlight(star, color, radius) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawZoomLens() {
    const { cx, cy, radius, scale } = zoom;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Clear the lens area and redraw stars scaled around cursor
    ctx.clearRect(cx - radius, cy - radius, radius * 2, radius * 2);
    const bg2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    bg2.addColorStop(0, "#0d0d22");
    bg2.addColorStop(1, "#000008");
    ctx.fillStyle = bg2;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    stars.forEach(s => {
      const dx = s.x - cx, dy = s.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) drawStar(s, false);
    });

    ctx.restore();

    // Lens border
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#00ccff88";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── Event Handlers ───────────────────────────────────────────────────────────

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;

    zoom.cx = mx;
    zoom.cy = my;
    zoom.active = true;

    // Find closest star within 20px
    hoveredStar = null;
    let minDist  = 20;
    stars.forEach(s => {
      const d = Math.hypot(s.x - mx, s.y - my);
      if (d < minDist) { minDist = d; hoveredStar = s; }
    });

    updateTooltip(hoveredStar, e);
  }

  function onCanvasClick(e) {
    if (!hoveredStar) return;
    selectedStar = hoveredStar;
    GameState.set("selectedStar", selectedStar);

    // Update info panel
    document.getElementById("star-name").textContent     = selectedStar.name;
    document.getElementById("star-class").textContent    = selectedStar.stellarClass;
    document.getElementById("star-temp").textContent     = selectedStar.temperature.toLocaleString() + " K";
    document.getElementById("star-lum").textContent      = selectedStar.luminosity + " L☉";
    document.getElementById("star-dist").textContent     = selectedStar.distance + " Lj";
    document.getElementById("btn-investigate").disabled  = false;
    document.getElementById("chart-placeholder").style.display = "flex";
    chartCtx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);

    // Bug 1 fix: hide transit banner whenever a new star is selected
    document.getElementById("interpretation-panel").style.display = "none";
  }

  function onInvestigateClick() {
    if (!selectedStar) return;
    const btn = document.getElementById("btn-investigate");
    btn.disabled = true;

    const delay = 1000 + Math.random() * 2000;
    startLoadingBar(delay, () => {
      activeCurve = generateLightCurve(selectedStar);
      selectedStar.investigated = true;

      drawLightCurve(activeCurve);

      if (activeCurve.type === "transit") {
        // Auto-confirm transit — player sees the obvious dip and proceeds
        selectedStar.exoplanetData = activeCurve.transitParams;
        GameState.discoverPlanet(selectedStar, activeCurve.transitParams);
        GameState.set("analysisResult", {
          star:          selectedStar,
          transitParams: activeCurve.transitParams,
        });
        document.getElementById("btn-analyse-nav").disabled = false;
        showTransitBanner(selectedStar.name, activeCurve.transitParams);
        GameState.addToScore(300, `Transit entdeckt: ${selectedStar.name}`);
      } else {
        const msg = activeCurve.type === "noise"
          ? "Nur Sternvariabilität — kein Planet."
          : "Kein Signal — nächster Stern!";
        showFeedbackToast(msg, "info");
        GameState.addToScore(20, "Stern untersucht");
      }

      updateScoreDisplay();
      btn.disabled = false;
    });
  }

  // ── Loading Bar ──────────────────────────────────────────────────────────────

  function startLoadingBar(durationMs, callback) {
    const bar       = document.getElementById("loading-bar-fill");
    const container = document.getElementById("loading-bar");
    container.style.display = "block";
    bar.style.width = "0%";
    const start = performance.now();

    function step(now) {
      const pct = Math.min(100, ((now - start) / durationMs) * 100);
      bar.style.width = pct + "%";
      if (pct < 100) {
        requestAnimationFrame(step);
      } else {
        container.style.display = "none";
        callback();
      }
    }
    requestAnimationFrame(step);
  }

  // ── Light Curve Chart ────────────────────────────────────────────────────────

  function drawLightCurve(curve) {
    // Hide the placeholder text once a real curve is drawn
    document.getElementById("chart-placeholder").style.display = "none";
    const W = chartCanvas.width, H = chartCanvas.height;
    chartCtx.clearRect(0, 0, W, H);

    // Background
    chartCtx.fillStyle = "#080818";
    chartCtx.fillRect(0, 0, W, H);

    const pad    = { top: 30, right: 20, bottom: 40, left: 55 };
    const plotW  = W - pad.left - pad.right;
    const plotH  = H - pad.top - pad.bottom;
    const fluxes = curve.flux;
    const times  = curve.time;

    // Y axis range
    const minF = Math.min(...fluxes) - 0.0005;
    const maxF = Math.max(...fluxes) + 0.0005;

    function px(t) { return pad.left + (t / times[times.length - 1]) * plotW; }
    function py(f) { return pad.top  + plotH - ((f - minF) / (maxF - minF)) * plotH; }

    // Grid
    chartCtx.strokeStyle = "#1a1a3a";
    chartCtx.lineWidth   = 1;
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (i / 5) * plotH;
      chartCtx.beginPath();
      chartCtx.moveTo(pad.left, y);
      chartCtx.lineTo(pad.left + plotW, y);
      chartCtx.stroke();
    }

    // Axes
    chartCtx.strokeStyle = "#334";
    chartCtx.lineWidth   = 1;
    chartCtx.strokeRect(pad.left, pad.top, plotW, plotH);

    // Axis labels
    chartCtx.fillStyle  = "#8899bb";
    chartCtx.font       = "11px monospace";
    chartCtx.textAlign  = "right";
    for (let i = 0; i <= 5; i++) {
      const f = minF + (1 - i / 5) * (maxF - minF);
      chartCtx.fillText(f.toFixed(4), pad.left - 5, pad.top + (i / 5) * plotH + 4);
    }
    chartCtx.textAlign = "center";
    for (let d = 0; d <= 30; d += 5) {
      const x = px(d);
      chartCtx.fillText(d, x, H - 8);
    }

    // Axis titles
    chartCtx.fillStyle = "#aabbcc";
    chartCtx.font      = "12px sans-serif";
    chartCtx.fillText("Zeit (Tage)", W / 2, H - 2);
    chartCtx.save();
    chartCtx.translate(12, H / 2);
    chartCtx.rotate(-Math.PI / 2);
    chartCtx.fillText("Rel. Helligkeit", 0, 0);
    chartCtx.restore();

    // Plot line
    const color = curve.type === "transit" ? "#00ffcc"
                : curve.type === "noise"   ? "#ffaa44"
                : "#4488ff";
    chartCtx.beginPath();
    chartCtx.strokeStyle = color;
    chartCtx.lineWidth   = 1.5;
    times.forEach((t, i) => {
      i === 0 ? chartCtx.moveTo(px(t), py(fluxes[i]))
              : chartCtx.lineTo(px(t), py(fluxes[i]));
    });
    chartCtx.stroke();

    // Title
    chartCtx.fillStyle = "#ccddff";
    chartCtx.font      = "13px monospace";
    chartCtx.textAlign = "center";
    chartCtx.fillText(`Lichtkurve: ${selectedStar.name}`, W / 2, 18);
  }

  // ── Transit Banner ────────────────────────────────────────────────────────────

  function showTransitBanner(starName, params) {
    const panel = document.getElementById("interpretation-panel");
    panel.style.display = "block";
    panel.innerHTML = `
      <div class="transit-found">
        <div class="transit-icon">🪐</div>
        <div class="transit-title">TRANSIT ENTDECKT!</div>
        <div class="transit-sub">${starName}</div>
        <div class="transit-detail">
          Periode: ${params.period_days} Tage &nbsp;|&nbsp;
          Tiefe: ${(params.depth * 100).toFixed(2)}% &nbsp;|&nbsp;
          Radius: ~${params.Rp_earth} R⊕
        </div>
        <div class="transit-hint">→ Klicke "Planeten analysieren" um fortzufahren</div>
      </div>
    `;
    showFeedbackToast(`Transit bei ${starName}! +300 Punkte`, "success");
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function updateTooltip(star, e) {
    const tip = document.getElementById("star-tooltip");
    if (!star) { tip.style.display = "none"; return; }
    tip.style.display = "block";
    tip.style.left    = (e.clientX + 15) + "px";
    tip.style.top     = (e.clientY - 30) + "px";
    tip.textContent   = `${star.name}  [${star.stellarClass}]  ${star.distance} Lj`;
  }

  function showFeedbackToast(msg, type) {
    const toast = document.getElementById("feedback-toast");
    toast.textContent   = msg;
    toast.className     = "toast " + (type === "info" ? "info" : type);
    toast.style.opacity = 1;
    setTimeout(() => toast.style.opacity = 0, 3500);
  }

  function updateScoreDisplay() {
    document.getElementById("score-display").textContent =
      "Punkte: " + GameState.get("score").toLocaleString();
  }

  return { init };
})();
