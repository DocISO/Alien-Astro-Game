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

    // Grid layout — identical in both canvases
    const COLS = 5, ROWS = 4;
    const COL_LABELS = "ABCDE";
    const cellW = W / COLS, cellH = H / ROWS;

    // Generate stars — kept away from grid-label margins
    const PAD = 18;
    const stars = Array.from({ length: N }, (_, i) => ({
      x: PAD + Math.random() * (W - PAD * 2),
      y: PAD + Math.random() * (H - PAD * 2),
      r: 1.3 + Math.random() * 1.7,
      alpha: 0.45 + Math.random() * 0.55,
      isPulsar: i < NPULSARS,
    }));
    // Shuffle so pulsars aren't always at indices 0..N-1
    for (let i = stars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stars[i], stars[j]] = [stars[j], stars[i]];
    }

    // Drift for non-pulsars — larger so movement is clearly visible
    const drift = stars.map(s => ({
      dx: s.isPulsar ? 0 : (Math.random() < 0.5 ? 1 : -1) * (14 + Math.random() * 16),
      dy: s.isPulsar ? 0 : (Math.random() < 0.5 ? 1 : -1) * (10 + Math.random() * 14),
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

    const hintEl = document.createElement("div");
    hintEl.className = "pulsar-grid-hint";
    hintEl.textContent = "Tipp: Vergleiche Sektor für Sektor (A1, A2 …). Pulsare stehen in beiden Karten exakt gleich.";
    wrapper.appendChild(hintEl);

    const statusEl = document.createElement("div");
    statusEl.className = "pulsar-status";
    statusEl.innerHTML = `Gefunden: <span id="pul-found">0</span>/${NPULSARS} &nbsp;|&nbsp; Falsch: <span id="pul-err">0</span>`;
    wrapper.appendChild(statusEl);

    function drawGrid(ctx) {
      // Dashed grid lines
      ctx.save();
      ctx.strokeStyle = "rgba(90,120,180,0.30)";
      ctx.lineWidth   = 0.8;
      ctx.setLineDash([3, 5]);
      for (let c = 1; c < COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cellW, 0);
        ctx.lineTo(c * cellW, H);
        ctx.stroke();
      }
      for (let r = 1; r < ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cellH);
        ctx.lineTo(W, r * cellH);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Column letters (top)
      ctx.fillStyle   = "rgba(130,160,220,0.55)";
      ctx.font        = "bold 10px monospace";
      ctx.textAlign   = "center";
      ctx.textBaseline = "top";
      for (let c = 0; c < COLS; c++) {
        ctx.fillText(COL_LABELS[c], (c + 0.5) * cellW, 3);
      }

      // Row numbers (left)
      ctx.textAlign    = "left";
      ctx.textBaseline = "middle";
      for (let r = 0; r < ROWS; r++) {
        ctx.fillText(r + 1, 3, (r + 0.5) * cellH);
      }
      ctx.restore();
    }

    function drawMap(id, shifted) {
      const cvs = document.getElementById(id);
      const ctx = cvs.getContext("2d");
      ctx.fillStyle = "#030312";
      ctx.fillRect(0, 0, W, H);

      // Grid drawn first — identical in both maps
      drawGrid(ctx);

      // Stars
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

  // ── Quest 3: Fusion Reactor Balance (dynamic) ────────────────────────────────

  function renderReactor(wrapper, entry, done) {
    // Physics state — all values 0–100
    let T = 62, M = 70, F = 57;
    let stableTicks = 0;
    let tickInterval = null;
    let animFrame    = null;
    let finished     = false;

    // OK zones (all three in range → stable)
    const T_OK  = [55, 82], M_OK  = [50, 78], F_OK  = [38, 72];
    // Warn zones — needle turns orange, status shows "KRITISCH"
    const T_WRN = [32, 90], M_WRN = [26, 88], F_WRN = [18, 84];
    // Danger zones — breaching this triggers KI intervention
    const T_DNG = [12, 97], M_DNG = [10, 95], F_DNG = [8, 90];

    const STABLE_NEEDED = 20; // ticks at 1300 ms ≈ 26 s

    const body = document.createElement("div");
    body.className = "reactor-body";
    body.innerHTML = `
      <div class="reactor-viz">
        <canvas id="react-cvs" width="190" height="190"></canvas>
        <div id="react-status" class="reactor-status-label">⚠️ Instabil</div>
      </div>
      <div class="reactor-controls">
        <div class="rparam" id="rp-t">
          <div class="rparam-head">
            <span>🌡️ Temperatur</span>
            <span class="rparam-val" id="rv-t">62</span>
          </div>
          <div class="rparam-gauge"><div class="rparam-track">
            <div class="rparam-warn" id="rwrn-t"></div>
            <div class="rparam-ok"   id="rok-t"></div>
            <div class="rparam-needle" id="rnd-t"></div>
          </div></div>
          <div class="rparam-btns">
            <button class="rparam-btn" id="rbtn-t-dn">−</button>
            <button class="rparam-btn" id="rbtn-t-up">+</button>
          </div>
        </div>
        <div class="rparam" id="rp-m">
          <div class="rparam-head">
            <span>🧲 Magnetfeld</span>
            <span class="rparam-val" id="rv-m">70</span>
          </div>
          <div class="rparam-gauge"><div class="rparam-track">
            <div class="rparam-warn" id="rwrn-m"></div>
            <div class="rparam-ok"   id="rok-m"></div>
            <div class="rparam-needle" id="rnd-m"></div>
          </div></div>
          <div class="rparam-btns">
            <button class="rparam-btn" id="rbtn-m-dn">−</button>
            <button class="rparam-btn" id="rbtn-m-up">+</button>
          </div>
        </div>
        <div class="rparam" id="rp-f">
          <div class="rparam-head">
            <span>⚗️ Brennstoff</span>
            <span class="rparam-val" id="rv-f">57</span>
          </div>
          <div class="rparam-gauge"><div class="rparam-track">
            <div class="rparam-warn" id="rwrn-f"></div>
            <div class="rparam-ok"   id="rok-f"></div>
            <div class="rparam-needle" id="rnd-f"></div>
          </div></div>
          <div class="rparam-btns">
            <button class="rparam-btn" id="rbtn-f-dn">−</button>
            <button class="rparam-btn" id="rbtn-f-up">+</button>
          </div>
        </div>
        <div class="reactor-stable-row">
          <span id="react-hint" class="reactor-hint">Bringe alle Parameter in die grüne Zone und halte sie stabil.</span>
          <div id="react-stable-bg" class="reactor-stable-bg" style="display:none">
            <div id="react-stable-fill" class="reactor-stable-fill"></div>
          </div>
        </div>
      </div>
    `;
    wrapper.appendChild(body);

    // ── Canvas renderer ──────────────────────────────────────────────────────
    let plasmaPhase = 0;
    function drawReactor() {
      const cvs = document.getElementById("react-cvs");
      if (!cvs) return;
      const ctx = cvs.getContext("2d");
      const cx = 95, cy = 95;
      ctx.clearRect(0, 0, 190, 190);
      ctx.fillStyle = "#07071a";
      ctx.fillRect(0, 0, 190, 190);

      // Magnetic coil rings — brightness driven by M
      for (let r = 55; r <= 82; r += 9) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.36, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(80,130,255,${0.10 + M / 300})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Plasma core — flickers with phase, color shifts with T
      plasmaPhase += 0.18;
      const flicker = 0.9 + 0.1 * Math.sin(plasmaPhase * 2.3) + 0.05 * Math.sin(plasmaPhase * 5.1);
      const pSize   = (16 + F * 0.26) * flicker;
      const inOK    = T >= T_OK[0] && T <= T_OK[1] && M >= M_OK[0] && M <= M_OK[1] && F >= F_OK[0] && F <= F_OK[1];
      const hue     = inOK ? 160 + 20 * Math.sin(plasmaPhase * 0.5) : 15 + T * 0.7;
      const grad    = ctx.createRadialGradient(cx, cy, 0, cx, cy, pSize);
      grad.addColorStop(0,   `hsla(${hue},100%,80%,1)`);
      grad.addColorStop(0.5, `hsla(${hue},100%,55%,0.7)`);
      grad.addColorStop(1,   `hsla(${hue},100%,35%,0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, pSize, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Outer stability ring
      if (inOK) {
        ctx.beginPath();
        ctx.arc(cx, cy, 48, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,255,140,${0.4 + 0.3 * Math.sin(plasmaPhase)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      animFrame = requestAnimationFrame(drawReactor);
    }

    // ── Gauge renderer ───────────────────────────────────────────────────────
    function updateGauges() {
      const params = [
        { id: "t", val: T, ok: T_OK, wrn: T_WRN },
        { id: "m", val: M, ok: M_OK, wrn: M_WRN },
        { id: "f", val: F, ok: F_OK, wrn: F_WRN },
      ];
      params.forEach(({ id, val, ok, wrn }) => {
        const valEl    = document.getElementById(`rv-${id}`);
        const needleEl = document.getElementById(`rnd-${id}`);
        const okEl     = document.getElementById(`rok-${id}`);
        const wrnEl    = document.getElementById(`rwrn-${id}`);
        if (!valEl) return;
        valEl.textContent   = Math.round(val);
        needleEl.style.left = val + "%";
        okEl.style.left     = ok[0]  + "%";
        okEl.style.width    = (ok[1]  - ok[0])  + "%";
        if (wrnEl) {
          wrnEl.style.left  = wrn[0] + "%";
          wrnEl.style.width = (wrn[1] - wrn[0]) + "%";
        }
        const inOK   = val >= ok[0]  && val <= ok[1];
        const inWarn = val >= wrn[0] && val <= wrn[1];
        const color  = inOK ? "var(--success)" : inWarn ? "var(--warn)" : "var(--danger)";
        valEl.style.color             = color;
        needleEl.style.background     = color;
      });
    }

    // ── Physics tick ─────────────────────────────────────────────────────────
    function tick() {
      if (finished) return;

      // Natural drift — slow enough to react to
      T += 0.45 + Math.random() * 0.08;   // heat builds up
      M -= 0.32 + Math.random() * 0.06;   // coils slowly decay
      F -= 0.22 + Math.random() * 0.05;   // fuel consumed

      // Hidden cross-coupling (undocumented to player)
      M -= (T - 68) * 0.020;
      T += (64 - M) * 0.015;

      T = Math.max(0, Math.min(100, T));
      M = Math.max(0, Math.min(100, M));
      F = Math.max(0, Math.min(100, F));

      updateGauges();
      updateStatus();

      // Check danger
      const tDanger = T < T_DNG[0] || T > T_DNG[1];
      const mDanger = M < M_DNG[0] || M > M_DNG[1];
      const fDanger = F < F_DNG[0] || F > F_DNG[1];
      if (tDanger || mDanger || fDanger) {
        triggerKI();
        return;
      }

      // Check stable
      const inOK = T >= T_OK[0] && T <= T_OK[1] && M >= M_OK[0] && M <= M_OK[1] && F >= F_OK[0] && F <= F_OK[1];
      if (inOK) {
        stableTicks++;
        const pct = Math.min(100, stableTicks / STABLE_NEEDED * 100);
        const bg   = document.getElementById("react-stable-bg");
        const fill = document.getElementById("react-stable-fill");
        if (bg)   bg.style.display   = "block";
        if (fill) fill.style.width   = pct + "%";
        if (stableTicks >= STABLE_NEEDED) {
          clearInterval(tickInterval);
          cancelAnimationFrame(animFrame);
          finished = true;
          showExplanation(wrapper, true,
            "✅ Perfekt! Ein Fusionsreaktor braucht genug Hitze (über 100 Mio. °C), ein starkes Magnetfeld, das das Plasma einschließt (Tokamak-Prinzip), und genau die richtige Brennstoffmenge. Die Parameter beeinflussen sich gegenseitig — das ist der Trick!"
          );
          continueBtn(wrapper, done, true);
        }
      } else {
        stableTicks = 0;
        const bg = document.getElementById("react-stable-bg");
        if (bg) bg.style.display = "none";
      }
    }

    function updateStatus() {
      const statusEl = document.getElementById("react-status");
      const hintEl   = document.getElementById("react-hint");
      if (!statusEl) return;
      const inOK   = T >= T_OK[0]  && T <= T_OK[1]  && M >= M_OK[0]  && M <= M_OK[1]  && F >= F_OK[0]  && F <= F_OK[1];
      const inWarn = T >= T_WRN[0] && T <= T_WRN[1] && M >= M_WRN[0] && M <= M_WRN[1] && F >= F_WRN[0] && F <= F_WRN[1];
      if (inOK) {
        statusEl.textContent = "✅ STABIL — Fusion läuft!";
        statusEl.style.color = "var(--success)";
        if (hintEl) hintEl.textContent = "Halten! Alle Parameter in der grünen Zone …";
      } else if (inWarn) {
        statusEl.textContent = "⚠️ INSTABIL — gegensteuern!";
        statusEl.style.color = "var(--warn)";
        if (hintEl) {
          const hints = [];
          if (T < T_OK[0]) hints.push("T zu niedrig"); else if (T > T_OK[1]) hints.push("T zu hoch");
          if (M < M_OK[0]) hints.push("M zu schwach"); else if (M > M_OK[1]) hints.push("M zu stark");
          if (F < F_OK[0]) hints.push("F zu wenig");  else if (F > F_OK[1]) hints.push("F zu viel");
          hintEl.textContent = hints.join("  ·  ") || "Justiere die Parameter …";
        }
      } else {
        statusEl.textContent = "🔴 KRITISCH — sofort handeln!";
        statusEl.style.color = "var(--danger)";
        if (hintEl) {
          const hints = [];
          if (T < T_WRN[0]) hints.push("T viel zu niedrig!"); else if (T > T_WRN[1]) hints.push("T viel zu hoch!");
          if (M < M_WRN[0]) hints.push("M viel zu schwach!"); else if (M > M_WRN[1]) hints.push("M viel zu stark!");
          if (F < F_WRN[0]) hints.push("F viel zu wenig!");  else if (F > F_WRN[1]) hints.push("F viel zu viel!");
          hintEl.textContent = hints.join("  ·  ") || "Sofort korrigieren!";
        }
      }
    }

    // ── KI intervention on danger breach ─────────────────────────────────────
    function triggerKI() {
      clearInterval(tickInterval);
      finished = true;

      const statusEl = document.getElementById("react-status");
      if (statusEl) {
        statusEl.textContent = "🤖 KI greift ein!";
        statusEl.style.color = "var(--warn)";
      }
      disableButtons();

      // Animate parameters back to safe values
      let step = 0;
      const tTarget = 68, mTarget = 64, fTarget = 55;
      const recover = setInterval(() => {
        T += (tTarget - T) * 0.25;
        M += (mTarget - M) * 0.25;
        F += (fTarget - F) * 0.25;
        updateGauges();
        step++;
        if (step >= 14) {
          clearInterval(recover);
          cancelAnimationFrame(animFrame);
          showExplanation(wrapper, false,
            "⚠️ Die Bordcomputer-KI hat eingegriffen und den Reaktor stabilisiert — ein Parameter ist in den Gefahrenbereich geraten. Fusionsreaktoren sind empfindlich: Temperatur und Magnetfeld beeinflussen sich gegenseitig!"
          );
          continueBtn(wrapper, done, false);
        }
      }, 120);
    }

    function disableButtons() {
      ["rbtn-t-up","rbtn-t-dn","rbtn-m-up","rbtn-m-dn","rbtn-f-up","rbtn-f-dn"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
      });
    }

    // ── Button event handlers ─────────────────────────────────────────────────
    function clamp(v) { return Math.max(0, Math.min(100, v)); }

    document.getElementById("rbtn-t-up").addEventListener("click", () => {
      if (finished) return;
      T = clamp(T + 5);
      M = clamp(M + 5 * 0.12); // hidden nudge
      updateGauges(); updateStatus();
    });
    document.getElementById("rbtn-t-dn").addEventListener("click", () => {
      if (finished) return;
      T = clamp(T - 5);
      updateGauges(); updateStatus();
    });
    document.getElementById("rbtn-m-up").addEventListener("click", () => {
      if (finished) return;
      M = clamp(M + 5);
      T = clamp(T + 5 * 0.10); // hidden nudge
      updateGauges(); updateStatus();
    });
    document.getElementById("rbtn-m-dn").addEventListener("click", () => {
      if (finished) return;
      M = clamp(M - 5);
      updateGauges(); updateStatus();
    });
    document.getElementById("rbtn-f-up").addEventListener("click", () => {
      if (finished) return;
      F = clamp(F + 5);
      updateGauges(); updateStatus();
    });
    document.getElementById("rbtn-f-dn").addEventListener("click", () => {
      if (finished) return;
      F = clamp(F - 5);
      updateGauges(); updateStatus();
    });

    // Start everything
    updateGauges();
    updateStatus();
    drawReactor();
    tickInterval = setInterval(tick, 1300);
  }

  // ── Quest 4: Swing-by Manöver (multiple choice) ───────────────────────────────

  function renderSwingby(wrapper, entry, done) {
    const W = 450, H = 280;
    const STAR_X = 295, STAR_Y = 140, STAR_R = 20;

    // Three path options — shuffled so correct isn't always the same label
    const DEFS = [
      {
        type: "correct", color: "#00e676",
        // Sweeps around star from top-left, exits bottom-right — classic slingshot arc
        seg: [10, 28, 90, -8, 405, 268, 440, 272],
        wrongText: null,
      },
      {
        type: "crash", color: "#ff5252",
        // Heads almost straight into the star
        seg: [10, 115, 145, 122, 260, 137, 277, 141],
        wrongText: "Zu nah am Stern — das Schiff würde in der Korona verglühen.",
      },
      {
        type: "far", color: "#448aff",
        // Barely deflected, passes well below star
        seg: [10, 222, 150, 216, 340, 210, 440, 206],
        wrongText: "Zu weit vom Stern — die Schwerkraft ist zu schwach für einen Bremseffekt.",
      },
    ];

    // Shuffle
    for (let i = DEFS.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [DEFS[i], DEFS[j]] = [DEFS[j], DEFS[i]];
    }
    DEFS.forEach((d, i) => { d.label = "ABC"[i]; });
    const correctIdx = DEFS.findIndex(d => d.type === "correct");
    let answered = false;

    // ── Canvas ────────────────────────────────────────────────────────────────
    const cvs = document.createElement("canvas");
    cvs.width = W; cvs.height = H;
    cvs.className = "swingby-canvas";
    wrapper.appendChild(cvs);
    const ctx = cvs.getContext("2d");

    // ── Buttons ───────────────────────────────────────────────────────────────
    const btnRow = document.createElement("div");
    btnRow.className = "swingby-btn-row";
    const btns = DEFS.map((d, i) => {
      const b = document.createElement("button");
      b.className = "swingby-option-btn";
      b.style.borderColor = d.color;
      b.style.color       = d.color;
      b.textContent = `Pfad ${d.label}`;
      b.addEventListener("click", () => onSelect(i));
      btnRow.appendChild(b);
      return b;
    });
    wrapper.appendChild(btnRow);

    // ── Helpers ───────────────────────────────────────────────────────────────
    function bezierPt(seg, t) {
      const [x0,y0,x1,y1,x2,y2,x3,y3] = seg;
      const m = 1 - t;
      return {
        x: m**3*x0 + 3*m**2*t*x1 + 3*m*t**2*x2 + t**3*x3,
        y: m**3*y0 + 3*m**2*t*y1 + 3*m*t**2*y2 + t**3*y3,
      };
    }

    function drawArrowHead(p1, p2, color) {
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const L = 10;
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - L*Math.cos(angle-0.42), p2.y - L*Math.sin(angle-0.42));
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - L*Math.cos(angle+0.42), p2.y - L*Math.sin(angle+0.42));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    function drawScene(dimIdx) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#030312";
      ctx.fillRect(0, 0, W, H);

      // Paths drawn first (star drawn on top covers crash path inside)
      DEFS.forEach((d, i) => {
        ctx.globalAlpha = (dimIdx === i) ? 0.18 : 1.0;
        ctx.beginPath();
        ctx.moveTo(d.seg[0], d.seg[1]);
        ctx.bezierCurveTo(d.seg[2], d.seg[3], d.seg[4], d.seg[5], d.seg[6], d.seg[7]);
        ctx.strokeStyle = d.color;
        ctx.lineWidth   = 2.5;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // Star glow (drawn on top, covers crash path inside star)
      const glow = ctx.createRadialGradient(STAR_X, STAR_Y, 0, STAR_X, STAR_Y, STAR_R * 3.5);
      glow.addColorStop(0, "rgba(255,230,60,0.55)");
      glow.addColorStop(1, "rgba(255,130,0,0)");
      ctx.beginPath();
      ctx.arc(STAR_X, STAR_Y, STAR_R * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Star core
      ctx.beginPath();
      ctx.arc(STAR_X, STAR_Y, STAR_R, 0, Math.PI * 2);
      ctx.fillStyle = "#ffe844";
      ctx.fill();

      // Star label
      ctx.fillStyle = "rgba(255,230,100,0.65)";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Zielstern", STAR_X, STAR_Y + STAR_R + 13);

      // Path labels, arrows, crash marker
      DEFS.forEach((d, i) => {
        const alpha = (dimIdx === i) ? 0.18 : 1.0;
        ctx.globalAlpha = alpha;

        // Label at path start
        ctx.fillStyle  = d.color;
        ctx.font       = "bold 12px monospace";
        ctx.textAlign  = "left";
        ctx.fillText(`Pfad ${d.label}`, d.seg[0] + 5, d.seg[1] - 10);

        if (d.type === "crash") {
          // Explosion at star surface
          ctx.font = "18px serif";
          ctx.textAlign = "center";
          ctx.fillText("💥", STAR_X - STAR_R - 1, STAR_Y + 4);
        } else {
          // Arrow head at end of path
          drawArrowHead(bezierPt(d.seg, 0.93), bezierPt(d.seg, 1.0), d.color);
          ctx.fillStyle = d.color;
          ctx.font = "10px monospace";
          ctx.textAlign = "right";
          ctx.fillText("→ Ziel", W - 4, d.seg[7] - 7);
        }
        ctx.globalAlpha = 1;
      });
    }

    drawScene(-1);

    // ── Selection handler ─────────────────────────────────────────────────────
    function onSelect(idx) {
      if (answered) return;
      answered = true;
      btns.forEach(b => b.disabled = true);

      const isCorrect   = (idx === correctIdx);
      const correctDef  = DEFS[correctIdx];
      const selectedDef = DEFS[idx];

      // Dim the wrong choice
      drawScene(isCorrect ? -1 : idx);

      if (isCorrect) {
        showExplanation(wrapper, true,
          "✅ Richtig! Der Swing-by nutzt die Schwerkraft des Sterns als kostenlosen Bremsmotor. Das Schiff passiert den Stern nah genug, damit die Gravitation es ablenkt — ohne Treibstoff zu verbrauchen. Genau so funktionierte Voyager 2, als es alle vier Gasriesen des Sonnensystems nutzte."
        );
      } else {
        showExplanation(wrapper, false,
          `❌ ${selectedDef.wrongText} Pfad ${correctDef.label} ist der ideale Swing-by: nah genug für starke Gravitation, weit genug um nicht zu verbrennen.`
        );
      }
      continueBtn(wrapper, done, isCorrect);
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
