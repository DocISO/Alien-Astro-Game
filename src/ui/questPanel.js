"use strict";

/**
 * Quest Panel UI – renders interactive mini-quests inside the mission logbook.
 * Each quest type has its own renderer. All renderers call onComplete(correct)
 * when the player finishes so the logbook animation can resume.
 */

const QuestPanel = (() => {

  // ── Public entry point ────────────────────────────────────────────────────────

  function show(entry, containerEl, onComplete) {
    containerEl.innerHTML = "";
    containerEl.style.display = "block";

    const def     = entry.questDef;
    const wrapper = document.createElement("div");
    wrapper.className = "quest-panel";

    const header = document.createElement("div");
    header.className = "quest-header";
    header.innerHTML = `
      <span class="quest-title">${def.title}</span>
      <span class="quest-badge">Mission Quest</span>
    `;
    wrapper.appendChild(header);

    if (def.story) {
      const story = document.createElement("p");
      story.className = "quest-story";
      story.textContent = def.story;
      wrapper.appendChild(story);
    }

    containerEl.appendChild(wrapper);

    const done = (correct) => {
      entry.resolved = true;
      entry.correct  = correct;
      onComplete(correct);
    };

    switch (def.type) {
      case "mcq":          renderMCQ(wrapper, entry, done);          break;
      case "pulsar":       renderPulsar(wrapper, entry, done);       break;
      case "reactor":      renderReactor(wrapper, entry, done);      break;
      case "food_calc":    renderFoodCalc(wrapper, entry, done);     break;
      case "swingby":      renderSwingby(wrapper, entry, done);      break;
      case "data_storage": renderDataStorage(wrapper, entry, done);  break;
      case "government":   renderGovernment(wrapper, entry, done);   break;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function makeBtn(text, cls) {
    const b = document.createElement("button");
    b.className = cls || "quest-btn";
    b.textContent = text;
    return b;
  }

  function showExplanation(parent, correct, text) {
    const el = document.createElement("div");
    el.className = `quest-explanation ${correct ? "quest-exp-correct" : "quest-exp-wrong"}`;
    el.innerHTML = text;
    parent.appendChild(el);
    return el;
  }

  function continueBtn(parent, done, correct) {
    const btn = makeBtn("Weiter →", "quest-continue");
    btn.onclick = () => done(correct);
    parent.appendChild(btn);
  }

  // ── Quest 1: MCQ (Dosimeter) ──────────────────────────────────────────────────

  function renderMCQ(wrapper, entry, done) {
    const def = entry.questDef;

    const q = document.createElement("p");
    q.className = "quest-question";
    q.textContent = def.question;
    wrapper.appendChild(q);

    const opts = document.createElement("div");
    opts.className = "quest-options";

    def.options.forEach(opt => {
      const btn = makeBtn(opt.label);
      btn.onclick = () => {
        opts.querySelectorAll(".quest-btn").forEach(b => b.disabled = true);
        const correct = opt.value === def.correct;
        btn.classList.add(correct ? "quest-btn-correct" : "quest-btn-wrong");
        if (!correct) {
          opts.querySelectorAll(".quest-btn").forEach(b => {
            if (b.textContent === def.options.find(o => o.value === def.correct).label) {
              b.classList.add("quest-btn-correct");
            }
          });
        }
        showExplanation(wrapper, correct, def.explanations[opt.value]);
        continueBtn(wrapper, done, correct);
      };
      opts.appendChild(btn);
    });
    wrapper.appendChild(opts);
  }

  // ── Quest 2: Pulsar Navigation ────────────────────────────────────────────────

  function renderPulsar(wrapper, entry, done) {
    const def      = entry.questDef;
    const N        = def.nStars;
    const NPULSARS = def.nPulsars;
    const W = 370, H = 240;

    // Generate stars
    const stars = Array.from({ length: N }, (_, i) => ({
      x: 12 + Math.random() * (W - 24),
      y: 12 + Math.random() * (H - 24),
      r: 1.2 + Math.random() * 1.8,
      alpha: 0.4 + Math.random() * 0.6,
      isPulsar: i < NPULSARS,
    }));
    // Shuffle so pulsars aren't always at indices 0..N-1
    for (let i = stars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stars[i], stars[j]] = [stars[j], stars[i]];
    }

    // Drift for non-pulsars (applied to OLD map)
    const drift = stars.map(s => ({
      dx: s.isPulsar ? 0 : (Math.random() < 0.5 ? 1 : -1) * (6 + Math.random() * 10),
      dy: s.isPulsar ? 0 : (Math.random() < 0.5 ? 1 : -1) * (6 + Math.random() * 10),
    }));

    const task = document.createElement("p");
    task.className = "quest-task";
    task.textContent = def.task;
    wrapper.appendChild(task);

    const mapsRow = document.createElement("div");
    mapsRow.className = "pulsar-maps";
    mapsRow.innerHTML = `
      <div>
        <div class="pulsar-label">📅 Vor 10 Jahren</div>
        <canvas id="pul-old" width="${W}" height="${H}" class="pulsar-canvas"></canvas>
      </div>
      <div>
        <div class="pulsar-label">🔭 Heute — klicke die unbewegten Sterne!</div>
        <canvas id="pul-new" width="${W}" height="${H}" class="pulsar-canvas"></canvas>
      </div>
    `;
    wrapper.appendChild(mapsRow);

    const statusEl = document.createElement("div");
    statusEl.className = "pulsar-status";
    statusEl.innerHTML = `Gefunden: <span id="pul-found">0</span>/${NPULSARS} &nbsp;|&nbsp; Falsch: <span id="pul-err">0</span>`;
    wrapper.appendChild(statusEl);

    function drawMap(id, shifted) {
      const cvs = document.getElementById(id);
      const ctx = cvs.getContext("2d");
      ctx.fillStyle = "#030312";
      ctx.fillRect(0, 0, W, H);
      stars.forEach((s, i) => {
        const x = shifted ? s.x + drift[i].dx : s.x;
        const y = shifted ? s.y + drift[i].dy : s.y;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,215,255,${s.alpha})`;
        ctx.fill();
      });
    }
    drawMap("pul-old", true);
    drawMap("pul-new", false);

    let found = 0, errors = 0;
    const clicked = new Set();
    const newCvs  = document.getElementById("pul-new");

    newCvs.style.cursor = "crosshair";
    newCvs.onclick = (e) => {
      if (found >= NPULSARS) return;
      const rect = newCvs.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let best = -1, bestD = 14;
      stars.forEach((s, i) => {
        if (clicked.has(i)) return;
        const d = Math.hypot(s.x - mx, s.y - my);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best === -1) return;
      clicked.add(best);

      const ctx  = newCvs.getContext("2d");
      const s    = stars[best];
      if (s.isPulsar) {
        found++;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 2;
        ctx.stroke();
        document.getElementById("pul-found").textContent = found;
      } else {
        errors++;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "#ff4444";
        ctx.lineWidth = 2;
        ctx.stroke();
        document.getElementById("pul-err").textContent = errors;
      }

      if (found >= NPULSARS) {
        newCvs.style.cursor = "default";
        const correct = errors <= 2;
        showExplanation(wrapper, correct,
          correct
            ? `✅ Navigation erfolgreich! Pulsare rotieren mit unglaublicher Präzision — manche senden ${(100 + Math.floor(Math.random()*600))} Impulse pro Sekunde. Sie sind die genauesten Uhren im Universum und dienen als kosmisches GPS.`
            : `⚠️ Kalibrierung mit ${errors} Fehlern abgeschlossen. Beim nächsten Mal: Vergleiche beide Karten ruhig Sektor für Sektor — die Pulsare stehen immer exakt gleich.`
        );
        continueBtn(wrapper, done, correct);
      }
    };
  }

  // ── Quest 3: Fusion Reactor Balance ──────────────────────────────────────────

  function renderReactor(wrapper, entry, done) {
    const targets  = entry.reactorTargets;
    let stableTime = 0;
    let stableInterval = null;
    let finished = false;

    const body = document.createElement("div");
    body.className = "reactor-body";
    body.innerHTML = `
      <div class="reactor-viz">
        <canvas id="react-cvs" width="180" height="180"></canvas>
        <div id="react-status" class="reactor-status-label">⚠️ Instabil</div>
      </div>
      <div class="reactor-controls">
        <div class="reactor-row">
          <label>🌡️ Temperatur &nbsp;<span id="rv-t">50</span></label>
          <input type="range" id="rsl-t" class="config-slider" min="0" max="100" value="50">
        </div>
        <div class="reactor-row">
          <label>🧲 Magnetfeld &nbsp;<span id="rv-m">50</span></label>
          <input type="range" id="rsl-m" class="config-slider" min="0" max="100" value="50">
        </div>
        <div class="reactor-row">
          <label>⚗️ Brennstoff &nbsp;<span id="rv-f">50</span></label>
          <input type="range" id="rsl-f" class="config-slider" min="0" max="100" value="50">
        </div>
        <div id="react-hint" class="reactor-hint"></div>
        <div id="react-stable-bar" class="reactor-stable-bar" style="display:none">
          <div id="react-stable-fill" class="reactor-stable-fill"></div>
        </div>
      </div>
    `;
    wrapper.appendChild(body);

    // Timeout give-up button after 90 s
    let giveUpTimer = setTimeout(() => {
      if (finished) return;
      const btn = makeBtn("⚠️ Notabschaltung (Treibstoff −8%)", "quest-btn quest-btn-warn");
      btn.onclick = () => { finished = true; done(false); };
      wrapper.appendChild(btn);
    }, 90000);

    function drawReactor(t, m, f, stable) {
      const cvs = document.getElementById("react-cvs");
      if (!cvs) return;
      const ctx = cvs.getContext("2d");
      const cx = 90, cy = 90;
      ctx.clearRect(0, 0, 180, 180);
      ctx.fillStyle = "#07071a";
      ctx.fillRect(0, 0, 180, 180);

      // Magnetic coils (rings)
      for (let r = 55; r <= 80; r += 8) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.38, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(80,130,255,${0.15 + m / 250})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Plasma core
      const pSize = 18 + f * 0.28;
      const hue   = stable ? 170 : 20 + t * 0.8;
      const grad  = ctx.createRadialGradient(cx, cy, 0, cx, cy, pSize);
      grad.addColorStop(0, `hsla(${hue},100%,75%,1)`);
      grad.addColorStop(0.5, `hsla(${hue},100%,55%,0.7)`);
      grad.addColorStop(1, `hsla(${hue},100%,40%,0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, pSize, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Stability ring
      if (stable) {
        ctx.beginPath();
        ctx.arc(cx, cy, 45, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,255,140,0.6)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    function check() {
      const t  = parseInt(document.getElementById("rsl-t").value);
      const m  = parseInt(document.getElementById("rsl-m").value);
      const f  = parseInt(document.getElementById("rsl-f").value);
      document.getElementById("rv-t").textContent = t;
      document.getElementById("rv-m").textContent = m;
      document.getElementById("rv-f").textContent = f;

      const tOk = t >= targets.temp[0] && t <= targets.temp[1];
      const mOk = m >= targets.mag[0]  && m <= targets.mag[1];
      const fOk = f >= targets.fuel[0] && f <= targets.fuel[1];
      const stable = tOk && mOk && fOk;

      drawReactor(t, m, f, stable);

      const statusEl = document.getElementById("react-status");
      const hintEl   = document.getElementById("react-hint");
      const barWrap  = document.getElementById("react-stable-bar");
      const barFill  = document.getElementById("react-stable-fill");

      if (stable) {
        statusEl.textContent  = "✅ STABIL — Fusion läuft!";
        statusEl.style.color  = "var(--success)";
        barWrap.style.display = "block";
        hintEl.textContent    = "Halte die Balance für 3 Sekunden …";
        if (!stableInterval) {
          stableTime = 0;
          stableInterval = setInterval(() => {
            stableTime += 100;
            barFill.style.width = (stableTime / 3000 * 100) + "%";
            if (stableTime >= 3000) {
              clearInterval(stableInterval);
              clearTimeout(giveUpTimer);
              finished = true;
              showExplanation(wrapper, true,
                "✅ Perfekt! Ein Fusionsreaktor braucht genug Hitze (≥ 100 Mio. °C), ein starkes Magnetfeld das Plasma einzuschließen (Tokamak-Prinzip), und exakt die richtige Brennstoffmenge — zu viel und er wird unkontrollierbar!"
              );
              continueBtn(wrapper, done, true);
            }
          }, 100);
        }
      } else {
        statusEl.textContent  = "⚠️ INSTABIL";
        statusEl.style.color  = "var(--danger)";
        barWrap.style.display = "none";
        if (stableInterval) { clearInterval(stableInterval); stableInterval = null; }
        const hints = [];
        if (!tOk) hints.push(t < targets.temp[0] ? "Temperatur zu niedrig" : "Temperatur zu hoch");
        if (!mOk) hints.push(m < targets.mag[0]  ? "Magnetfeld zu schwach"  : "Magnetfeld zu stark");
        if (!fOk) hints.push(f < targets.fuel[0] ? "Brennstoff zu wenig"    : "Brennstoff zu viel");
        hintEl.textContent = hints.join("  ·  ");
      }
    }

    ["rsl-t", "rsl-m", "rsl-f"].forEach(id =>
      document.getElementById(id).addEventListener("input", check)
    );
    check();
  }

  // ── Quest 4: Food Calculation ─────────────────────────────────────────────────

  function renderFoodCalc(wrapper, entry, done) {
    const d = entry.foodCalc;

    const prob = document.createElement("div");
    prob.className = "calc-problem";
    prob.innerHTML = `
      <p>Eure Crew besteht aktuell aus <strong>${d.initialCrew} Personen</strong>.</p>
      <p>Jede Person braucht <strong>${d.kgPerPerson} kg Kartoffeln</strong> pro Jahr.</p>
      <p>Jedes Jahr werden <strong>${d.births} Kinder</strong> geboren und <strong>${d.deaths} Mensch</strong> stirbt.</p>
      <p class="calc-question">❓ Wie viele Tonnen Kartoffeln braucht ihr in <strong>Jahr 5</strong>?</p>
      <p class="calc-hint">Tipp: Berechne zuerst, wie viele Menschen dann an Bord sind. (1&nbsp;Tonne&nbsp;=&nbsp;1000&nbsp;kg)</p>
    `;
    wrapper.appendChild(prob);

    const row = document.createElement("div");
    row.className = "calc-input-row";
    const input = document.createElement("input");
    input.type        = "number";
    input.id          = "calc-inp";
    input.className   = "calc-input";
    input.placeholder = "Deine Antwort in Tonnen";
    input.min = 0; input.max = 99999;
    const btn = makeBtn("Prüfen ✓");
    row.appendChild(input);
    row.appendChild(btn);
    wrapper.appendChild(row);

    const resultEl = document.createElement("div");
    wrapper.appendChild(resultEl);

    const submit = () => {
      const val     = parseInt(input.value, 10);
      const correct = !isNaN(val) && Math.abs(val - d.answerTons) <= 1;
      btn.disabled  = true;
      input.disabled = true;

      showExplanation(resultEl, correct,
        correct
          ? `✅ Richtig! Jahr 5: ${d.finalPop} Personen × ${d.kgPerPerson} kg ÷ 1000 = <strong>${d.answerTons} t</strong>`
          : `❌ Nicht ganz. In Jahr 5 seid ihr ${d.finalPop} Personen (${d.initialCrew} + ${d.births - d.deaths}×5). Das ergibt ${d.finalPop} × ${d.kgPerPerson} = <strong>${d.answerTons} t</strong>.`
      );
      continueBtn(wrapper, done, correct);
    };
    btn.onclick = submit;
    input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  }

  // ── Quest 5: Swing-by Manöver ─────────────────────────────────────────────────

  function renderSwingby(wrapper, entry, done) {
    const W = 430, H = 310;
    const CX = W / 2, CY = H / 2;
    const STAR_R   = 18;
    const ORBIT_R  = 95;
    const SAFE_MIN = STAR_R + 14;  // 32 px — closer = crash
    const SAFE_MAX = 82;           // too far = no gravity assist
    const planetAng = 2.2;
    const MAX_ATTEMPTS = 2;

    let attempts  = 0;
    let isDrawing = false;
    let drawnPath = [];
    let done2     = false;

    // Deterministic background stars
    const bgStars = Array.from({ length: 65 }, (_, i) => ({
      x: (i * 97 + 13) % W,
      y: (i * 71 + 7)  % H,
    }));

    // ── Instruction ───────────────────────────────────────────────────────────
    const taskEl = document.createElement("p");
    taskEl.className = "quest-task";
    taskEl.innerHTML =
      "Zeichne mit der Maus einen Flugweg <strong>vom Bildrand herein, kurz am Stern vorbei, dann zum Planeten</strong>. " +
      "Zu nah = Absturz · Zu weit = kein Bremseffekt";
    wrapper.appendChild(taskEl);

    const attEl = document.createElement("div");
    attEl.className = "swingby-attempts";
    attEl.textContent = `Versuch 1 / ${MAX_ATTEMPTS}`;
    wrapper.appendChild(attEl);

    // ── Canvas ────────────────────────────────────────────────────────────────
    const cvs = document.createElement("canvas");
    cvs.width  = W;
    cvs.height = H;
    cvs.className = "swingby-canvas";
    cvs.style.cursor = "crosshair";
    wrapper.appendChild(cvs);
    const ctx = cvs.getContext("2d");

    // ── Feedback ──────────────────────────────────────────────────────────────
    const feedEl = document.createElement("div");
    feedEl.className = "swingby-feedback";
    wrapper.appendChild(feedEl);

    // ── Draw helpers ──────────────────────────────────────────────────────────
    function drawBase() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#030312";
      ctx.fillRect(0, 0, W, H);

      // BG stars
      bgStars.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 0.9, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(200,215,255,0.3)";
        ctx.fill();
      });

      // Zone rings (subtle guides)
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(CX, CY, SAFE_MIN, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,80,80,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(CX, CY, SAFE_MAX, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(80,255,150,0.35)";
      ctx.stroke();
      ctx.setLineDash([]);

      // Planet orbit
      ctx.beginPath();
      ctx.arc(CX, CY, ORBIT_R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(80,180,80,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Star glow + core
      const sg = ctx.createRadialGradient(CX, CY, 0, CX, CY, STAR_R * 2);
      sg.addColorStop(0, "#fff8d0");
      sg.addColorStop(0.35, "#ffcc44");
      sg.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(CX, CY, STAR_R * 2, 0, Math.PI * 2);
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(CX, CY, STAR_R, 0, Math.PI * 2);
      ctx.fillStyle = "#fff8d0";
      ctx.fill();

      // Planet
      const px = CX + Math.cos(planetAng) * ORBIT_R;
      const py = CY + Math.sin(planetAng) * ORBIT_R;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#4488ff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 13, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(150,200,255,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Legend
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(255,80,80,0.6)";  ctx.fillText("── Zu nah", 6, H - 30);
      ctx.fillStyle = "rgba(0,255,136,0.7)";  ctx.fillText("── Ideal",  6, H - 18);
      ctx.fillStyle = "rgba(0,180,255,0.6)";  ctx.fillText("── Zu weit",6, H - 6);
    }

    function drawUserPath(path, closestIdx) {
      if (path.length < 2) return;
      // Color each segment by distance to star
      for (let i = 1; i < path.length; i++) {
        const d = Math.hypot(path[i].x - CX, path[i].y - CY);
        ctx.beginPath();
        ctx.moveTo(path[i-1].x, path[i-1].y);
        ctx.lineTo(path[i].x, path[i].y);
        ctx.strokeStyle = d < SAFE_MIN ? "#ff4444"
                        : d <= SAFE_MAX ? "#00ff88"
                        : "#00aaff";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      // Closest-point marker + distance line
      if (closestIdx >= 0) {
        const cp = path[closestIdx];
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 7, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffcc00";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cp.x, cp.y);
        ctx.lineTo(CX, CY);
        ctx.strokeStyle = "rgba(255,200,0,0.35)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    function drawCorrectPath(pts) {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = "#ffcc00";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Ship marker at end
      const last = pts[pts.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffcc00";
      ctx.fill();
    }

    drawBase();

    // ── Mouse events ──────────────────────────────────────────────────────────
    function getPos(e) {
      const r = cvs.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top)  * (H / r.height),
      };
    }

    cvs.addEventListener("mousedown", e => {
      if (done2) return;
      isDrawing = true;
      drawnPath = [getPos(e)];
    });

    cvs.addEventListener("mousemove", e => {
      if (!isDrawing) return;
      drawnPath.push(getPos(e));
      drawBase();
      drawUserPath(drawnPath, -1);
    });

    function finishDraw() {
      if (!isDrawing) return;
      isDrawing = false;
      if (drawnPath.length < 15) { drawnPath = []; return; }
      analyze();
    }
    cvs.addEventListener("mouseup",    finishDraw);
    cvs.addEventListener("mouseleave", finishDraw);

    // ── Analysis ──────────────────────────────────────────────────────────────
    function analyze() {
      attempts++;
      attEl.textContent = `Versuch ${attempts} / ${MAX_ATTEMPTS}`;

      // Find closest point to star
      let minDist = Infinity, minIdx = 0;
      drawnPath.forEach((p, i) => {
        const d = Math.hypot(p.x - CX, p.y - CY);
        if (d < minDist) { minDist = d; minIdx = i; }
      });

      // Start at edge?
      const s0 = drawnPath[0];
      const edgeDist = Math.min(s0.x, W - s0.x, s0.y, H - s0.y);
      const startsEdge = edgeDist < 90;

      const tooClose = minDist < SAFE_MIN;
      const tooFar   = minDist > SAFE_MAX;
      const correct  = startsEdge && !tooClose && !tooFar;

      // Redraw with analysis
      drawBase();
      drawUserPath(drawnPath, minIdx);

      // Feedback rows
      feedEl.innerHTML = "";
      const distFromSurface = Math.round(minDist - STAR_R);

      [
        {
          ok: startsEdge,
          text: startsEdge
            ? "Flugbahn startet außerhalb des Systems ✓"
            : "⚠ Starte deinen Flugweg am Rand des Bildes!",
        },
        {
          ok: !tooClose && !tooFar,
          text: tooClose
            ? `⚠ Zu nah! Nächster Punkt lag ${distFromSurface} px vom Sternrand — Absturzgefahr. Mindestabstand: ${Math.round(SAFE_MIN - STAR_R)} px`
            : tooFar
            ? `⚠ Zu weit! Nächster Punkt: ${distFromSurface} px — Schwerkraft zu schwach. Maximalabstand: ${Math.round(SAFE_MAX - STAR_R)} px`
            : `Idealer Abstand: ${distFromSurface} px vom Sternrand — Schwerkraft nutzbar ✓`,
        },
      ].forEach(r => {
        const row = document.createElement("div");
        row.className = "swingby-fb-row " + (r.ok ? "fb-ok" : "fb-err");
        row.textContent = r.text;
        feedEl.appendChild(row);
      });

      if (correct || attempts >= MAX_ATTEMPTS) {
        done2 = true;
        cvs.style.cursor = "default";
        // Explanation text
        const expEl = document.createElement("div");
        expEl.className = `quest-explanation ${correct ? "quest-exp-correct" : "quest-exp-wrong"}`;
        expEl.innerHTML = correct
          ? "✅ Perfekt! Die Schwerkraft des Sterns hat das Schiff abgebremst und auf Kurs gebracht — ohne Treibstoff. Genauso nutzte die Sonde Voyager&nbsp;2 die Planeten des Sonnensystems!"
          : "❌ Nicht ganz — hier ist der korrekte Swing-by:";
        wrapper.appendChild(expEl);

        // Animate correct path
        const correctPts = computeCorrectPath();
        let step = 0;
        const anim = setInterval(() => {
          step = Math.min(step + 3, correctPts.length);
          drawBase();
          if (!correct) drawUserPath(drawnPath, minIdx);  // keep user path visible
          drawCorrectPath(correctPts.slice(0, step));
          if (step >= correctPts.length) {
            clearInterval(anim);
            continueBtn(wrapper, done, correct);
          }
        }, 20);

      } else {
        // Retry button
        const retryBtn = makeBtn("🔄 Nochmal zeichnen (Versuch 2)", "quest-btn");
        retryBtn.onclick = () => {
          drawnPath = [];
          feedEl.innerHTML = "";
          retryBtn.remove();
          drawBase();
          cvs.style.cursor = "crosshair";
        };
        feedEl.appendChild(retryBtn);
      }
    }

    // ── Ideal trajectory ──────────────────────────────────────────────────────
    function computeCorrectPath() {
      const AD = 55;  // ideal approach distance (middle of safe zone)
      const pts = [];
      const entX = 28, entY = 28;
      const dx = CX - entX, dy = CY - entY;
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const perpX = -uy, perpY = ux;
      const aimX = CX + perpX * AD, aimY = CY + perpY * AD;

      // Straight approach
      for (let i = 0; i <= 45; i++)
        pts.push({ x: entX + (aimX - entX) * i / 45, y: entY + (aimY - entY) * i / 45 });

      // Hyperbolic arc
      const periAng = Math.atan2(aimY - CY, aimX - CX);
      const sweep   = Math.PI * 1.4;
      for (let i = 1; i <= 60; i++) {
        const ang = periAng + sweep * i / 60;
        pts.push({ x: CX + Math.cos(ang) * AD, y: CY + Math.sin(ang) * AD });
      }

      // Exit toward planet
      const exitAng = periAng + sweep;
      const exX = CX + Math.cos(exitAng) * AD;
      const exY = CY + Math.sin(exitAng) * AD;
      const plX = CX + Math.cos(planetAng) * ORBIT_R;
      const plY = CY + Math.sin(planetAng) * ORBIT_R;
      for (let i = 1; i <= 42; i++)
        pts.push({ x: exX + (plX - exX) * i / 42, y: exY + (plY - exY) * i / 42 });

      return pts;
    }
  }

  // ── Quest 6: Data Storage Allocation ─────────────────────────────────────────

  function renderDataStorage(wrapper, entry, done) {
    const def   = entry.questDef;
    const TOTAL = 100;
    let   used  = 0;

    const grid = document.createElement("div");
    grid.className = "alloc-grid";

    def.categories.forEach(cat => {
      const initVal = Math.floor(TOTAL / def.categories.length);
      const row = document.createElement("div");
      row.className = "alloc-row";
      row.innerHTML = `
        <span class="alloc-label">${cat.label}</span>
        <input type="range" class="config-slider alloc-slider" id="alloc-${cat.id}"
               min="0" max="70" value="${initVal}" data-id="${cat.id}">
        <span class="alloc-val" id="alloc-v-${cat.id}">${initVal}</span>
      `;
      grid.appendChild(row);
    });
    wrapper.appendChild(grid);

    const remEl = document.createElement("div");
    remEl.className = "alloc-remaining";
    remEl.innerHTML = `Verbleibend: <strong id="alloc-rem">0</strong> / ${TOTAL}`;
    wrapper.appendChild(remEl);

    const warnEl = document.createElement("div");
    warnEl.className = "alloc-warn";
    wrapper.appendChild(warnEl);

    const confBtn = makeBtn("Bestätigen");
    wrapper.appendChild(confBtn);

    function update() {
      used = def.categories.reduce((sum, cat) =>
        sum + parseInt(document.getElementById(`alloc-${cat.id}`).value), 0
      );
      const rem = TOTAL - used;
      document.getElementById("alloc-rem").textContent = rem;
      remEl.style.color = rem !== 0 ? "var(--danger)" : "var(--success)";
      confBtn.disabled  = rem !== 0;
      // Live warnings
      const issues = def.categories.filter(cat =>
        parseInt(document.getElementById(`alloc-${cat.id}`).value) < cat.min
      );
      warnEl.innerHTML = issues.map(c =>
        `<div class="alloc-issue">⚠️ ${c.label}: zu wenig — ${c.warn}</div>`
      ).join("");
    }

    document.querySelectorAll(".alloc-slider").forEach(sl => {
      sl.addEventListener("input", () => {
        const id = sl.dataset.id;
        document.getElementById(`alloc-v-${id}`).textContent = sl.value;
        update();
      });
    });
    update();

    confBtn.onclick = () => {
      const allocs  = {};
      def.categories.forEach(cat =>
        allocs[cat.id] = parseInt(document.getElementById(`alloc-${cat.id}`).value)
      );
      entry.questResult = allocs;
      const issues  = def.categories.filter(cat => allocs[cat.id] < cat.min);
      const correct = issues.length === 0;

      confBtn.disabled = true;
      document.querySelectorAll(".alloc-slider").forEach(sl => sl.disabled = true);

      if (correct) {
        showExplanation(wrapper, true,
          "✅ Gute Balance! Die Crew hat Zugang zu Medizin, Ernährungswissen, Technik und Kultur. Dieses Wissen wird über Generationen weitergegeben."
        );
      } else {
        const msgs = issues.map(c => `<li>${c.warn}</li>`).join("");
        showExplanation(wrapper, false,
          `⚠️ Einige Bereiche wurden vernachlässigt:<ul>${msgs}</ul>Die Auswirkungen werden die nächste Generation spüren.`
        );
      }
      continueBtn(wrapper, done, correct);
    };
  }

  // ── Quest 7: Government Choice ────────────────────────────────────────────────

  function renderGovernment(wrapper, entry, done) {
    const def    = entry.questDef;
    const tYears = entry._travelYears;  // injected by travelPlanner

    const cards = document.createElement("div");
    cards.className = "gov-cards";

    def.options.forEach(opt => {
      const card = document.createElement("div");
      card.className = "gov-card";
      card.innerHTML = `
        <div class="gov-icon">${opt.label.slice(0, 2)}</div>
        <div class="gov-name">${opt.label.slice(3)}</div>
        <div class="gov-desc">${opt.desc}</div>
      `;
      card.onclick = () => {
        entry.questResult = opt.value;
        cards.querySelectorAll(".gov-card").forEach(c => {
          c.classList.remove("gov-selected");
          c.onclick = null;
        });
        card.classList.add("gov-selected");

        showExplanation(wrapper, true,
          `ℹ️ ${opt.consequence} <em>Die Auswirkungen werdet ihr in einigen Jahren erleben …</em>`
        );
        continueBtn(wrapper, done, true);
      };
      cards.appendChild(card);
    });
    wrapper.appendChild(cards);
  }

  return { show };
})();
